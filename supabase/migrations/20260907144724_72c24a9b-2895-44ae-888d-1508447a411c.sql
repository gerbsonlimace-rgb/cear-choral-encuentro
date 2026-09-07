create table public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  constraint admin_users_revocation_actor_check
    check (revoked_by is null or revoked_at is not null),
  constraint admin_users_revocation_time_check
    check (revoked_at is null or revoked_at >= granted_at)
);

create unique index admin_users_active_user_uidx
  on public.admin_users (user_id)
  where revoked_at is null;

alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated, service_role;
grant select on public.admin_users to service_role;

create table public.admin_access_events (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null,
  payment_status_filter text,
  search_used boolean not null,
  result_count integer not null,
  created_at timestamptz not null default now(),
  constraint admin_access_events_type_check
    check (event_type = 'registrations.export_csv'),
  constraint admin_access_events_status_check
    check (
      payment_status_filter is null
      or payment_status_filter in ('pending', 'paid', 'legacy')
    ),
  constraint admin_access_events_result_count_check
    check (result_count >= 0)
);

alter table public.admin_access_events enable row level security;
revoke all on public.admin_access_events from anon, authenticated, service_role;
grant select, insert on public.admin_access_events to service_role;