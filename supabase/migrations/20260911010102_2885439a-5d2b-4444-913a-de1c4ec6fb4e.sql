create table public.event_registration_settings (
  id boolean not null default true,
  standard_price_cents integer,
  promotional_price_cents integer,
  shirt_price_cents integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_registration_settings_singleton_check check (id = true),
  constraint event_registration_settings_singleton_unique unique (id),
  constraint event_registration_settings_standard_price_check
    check (standard_price_cents is null or standard_price_cents > 0),
  constraint event_registration_settings_promotional_price_check
    check (promotional_price_cents is null or promotional_price_cents > 0),
  constraint event_registration_settings_shirt_price_check
    check (shirt_price_cents is null or shirt_price_cents > 0),
  constraint event_registration_settings_price_order_check
    check (
      standard_price_cents is null
      or promotional_price_cents is null
      or promotional_price_cents < standard_price_cents
    )
);

insert into public.event_registration_settings (id) values (true);

create table public.choirs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  uses_promotional_price boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint choirs_name_check
    check (name = btrim(name) and char_length(name) between 2 and 120)
);

create unique index choirs_normalized_name_uidx on public.choirs (lower(btrim(name)));

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cpf text,
  email text,
  phone text not null,
  city text,
  institution text,
  role text,
  observations text,
  birth_date date not null,
  diocese text not null,
  choir_name text not null,
  choir_id uuid references public.choirs(id) on delete restrict,
  pricing_type text,
  standard_price_cents integer,
  registration_price_cents integer,
  shirt_price_cents integer,
  include_shirt boolean not null default false,
  shirt_size text,
  amount_cents integer,
  payment_status text not null default 'pending',
  order_nsu uuid,
  checkout_url text,
  infinitepay_invoice_slug text,
  infinitepay_transaction_nsu text,
  payment_method text,
  installments integer,
  paid_amount_cents integer,
  receipt_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  constraint registrations_cpf_digits_check check (cpf is null or cpf ~ '^[0-9]{11}$'),
  constraint registrations_role_check check (role is null or role in (
    'participant','listener','musician','choir_member',
    'singer','conductor','liturgist','priest','other')),
  constraint registrations_choir_names_match_check check (diocese = choir_name),
  constraint registrations_shirt_selection_check check (
    (include_shirt and shirt_size is not null and shirt_size in ('P','M','G','GG','XG'))
    or (not include_shirt and shirt_size is null)),
  constraint registrations_amount_check check (amount_cents is null or amount_cents > 0),
  constraint registrations_payment_status_check check (payment_status in ('legacy','pending','paid')),
  constraint registrations_order_required_check check (
    (payment_status = 'legacy' and order_nsu is null and amount_cents is null)
    or (payment_status in ('pending','paid') and order_nsu is not null and amount_cents is not null and amount_cents > 0)),
  constraint registrations_payment_method_check check (payment_method is null or payment_method in ('pix','credit_card')),
  constraint registrations_installments_check check (installments is null or installments > 0),
  constraint registrations_paid_amount_check check (paid_amount_cents is null or paid_amount_cents > 0),
  constraint registrations_paid_details_check check (
    payment_status <> 'paid'
    or (infinitepay_transaction_nsu is not null and payment_method is not null
        and installments is not null and paid_amount_cents is not null
        and paid_amount_cents >= amount_cents and paid_at is not null)),
  constraint registrations_standard_price_check check (standard_price_cents is null or standard_price_cents > 0),
  constraint registrations_registration_price_check check (registration_price_cents is null or registration_price_cents > 0),
  constraint registrations_shirt_price_check check (shirt_price_cents is null or shirt_price_cents > 0),
  constraint registrations_pricing_snapshot_check check (
    (choir_id is null and pricing_type is null and standard_price_cents is null
     and registration_price_cents is null and shirt_price_cents is null)
    or (choir_id is not null and pricing_type is not null and standard_price_cents is not null
        and registration_price_cents is not null
        and ((pricing_type = 'standard' and registration_price_cents = standard_price_cents)
             or (pricing_type = 'promotional' and registration_price_cents < standard_price_cents)))),
  constraint registrations_shirt_price_snapshot_check check (
    pricing_type is null
    or (include_shirt and shirt_price_cents is not null)
    or (not include_shirt and shirt_price_cents is null)),
  constraint registrations_pricing_type_check check (pricing_type is null or pricing_type in ('standard','promotional'))
);

create unique index registrations_order_nsu_uidx on public.registrations (order_nsu) where order_nsu is not null;
create unique index registrations_infinitepay_transaction_nsu_uidx on public.registrations (infinitepay_transaction_nsu) where infinitepay_transaction_nsu is not null;

create or replace function public.sync_registration_choir_names()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.choir_name is null then
    new.choir_name := new.diocese;
  elsif new.diocese is null then
    new.diocese := new.choir_name;
  end if;
  return new;
end;
$$;

create trigger sync_registration_choir_names_before_write
before insert or update of diocese, choir_name on public.registrations
for each row execute function public.sync_registration_choir_names();

create table public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  constraint admin_users_revocation_actor_check check (revoked_by is null or revoked_at is not null),
  constraint admin_users_revocation_time_check check (revoked_at is null or revoked_at >= granted_at)
);

create unique index admin_users_active_user_uidx on public.admin_users (user_id) where revoked_at is null;

create table public.admin_access_events (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null,
  payment_status_filter text,
  search_used boolean not null,
  result_count integer not null,
  created_at timestamptz not null default now(),
  constraint admin_access_events_type_check check (event_type = 'registrations.export_csv'),
  constraint admin_access_events_status_check check (
    payment_status_filter is null or payment_status_filter in ('pending','paid','legacy')),
  constraint admin_access_events_result_count_check check (result_count >= 0)
);

alter table public.event_registration_settings enable row level security;
alter table public.choirs enable row level security;
alter table public.registrations enable row level security;
alter table public.admin_users enable row level security;
alter table public.admin_access_events enable row level security;

revoke all on public.event_registration_settings from anon, authenticated, service_role;
revoke all on public.choirs from anon, authenticated, service_role;
revoke all on public.registrations from anon, authenticated, service_role;
revoke all on public.admin_users from anon, authenticated, service_role;
revoke all on public.admin_access_events from anon, authenticated, service_role;

grant select, insert, update on public.event_registration_settings to service_role;
grant select, insert, update on public.choirs to service_role;
grant select, insert, update on public.registrations to service_role;
grant select on public.admin_users to service_role;
grant select, insert on public.admin_access_events to service_role;