create table public.participant_accounts (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete restrict,
  user_id uuid references auth.users(id) on delete restrict,
  access_status text not null default 'pending'
    check (access_status in ('active', 'pending', 'conflict')),
  provisioned_at timestamptz,
  last_error_code text,
  provisioning_claim_id uuid,
  provisioning_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participant_accounts_active_state_check check (
    (access_status = 'active' and user_id is not null and provisioned_at is not null
      and last_error_code is null and provisioning_claim_id is null
      and provisioning_started_at is null)
    or (access_status <> 'active' and user_id is null and provisioned_at is null)
  )
);

create unique index participant_accounts_registration_uidx
  on public.participant_accounts (registration_id);
create unique index participant_accounts_user_uidx
  on public.participant_accounts (user_id) where user_id is not null;
create index participant_accounts_attention_idx
  on public.participant_accounts (access_status, updated_at)
  where access_status in ('pending', 'conflict');

alter table public.participant_accounts enable row level security;
revoke all on public.participant_accounts from public, anon, authenticated, service_role;
grant select, insert, update on public.participant_accounts to service_role;

create table public.participant_access_events (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete restrict,
  participant_account_id uuid references public.participant_accounts(id) on delete restrict,
  event_type text not null,
  admin_user_id uuid references auth.users(id) on delete restrict,
  error_code text,
  created_at timestamptz not null default now(),
  constraint participant_access_events_error_code_check check (
    error_code is null or error_code ~ '^[A-Z][A-Z0-9_]{0,63}$'
  )
);

create index participant_access_events_registration_idx
  on public.participant_access_events (registration_id, created_at);
create index participant_access_events_account_idx
  on public.participant_access_events (participant_account_id);
create index participant_access_events_admin_idx
  on public.participant_access_events (admin_user_id);

alter table public.participant_access_events enable row level security;
revoke all on public.participant_access_events from public, anon, authenticated, service_role;
grant select, insert on public.participant_access_events to service_role;

-- The caller owns the opaque claim UUID and must compare it when finalizing or
-- releasing the lease. Neither audit events nor participant responses carry it.
create function public.claim_participant_provisioning(
  p_registration_id uuid,
  p_claim_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claimed_at timestamptz;
begin
  if p_claim_id is null then
    return false;
  end if;

  -- Lock the stable parent even when the account does not exist yet. This also
  -- serializes with payment updates so eligibility is checked under that lock.
  perform 1 from public.registrations as registration
  where registration.id = p_registration_id
    and registration.payment_status = 'paid'
  for update;
  if not found then
    return false;
  end if;

  insert into public.participant_accounts (registration_id)
  values (p_registration_id)
  on conflict (registration_id) do nothing;

  -- Read the wall clock after acquiring the lock, not the transaction start.
  v_claimed_at := clock_timestamp();
  update public.participant_accounts as account
  set provisioning_claim_id = p_claim_id,
      provisioning_started_at = v_claimed_at,
      updated_at = v_claimed_at
  where account.registration_id = p_registration_id
    and account.access_status <> 'active'
    and (
      account.provisioning_claim_id is null
      or account.provisioning_started_at <= v_claimed_at - interval '10 minutes'
    );
  return found;
end;
$$;

revoke all on function public.claim_participant_provisioning(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_participant_provisioning(uuid, uuid)
  to service_role;
