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

insert into public.event_registration_settings (id)
values (true);

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

create unique index choirs_normalized_name_uidx
  on public.choirs (lower(btrim(name)));

alter table public.event_registration_settings enable row level security;
alter table public.choirs enable row level security;

revoke all on public.event_registration_settings from anon, authenticated;
revoke all on public.event_registration_settings from service_role;
grant select, insert, update on public.event_registration_settings to service_role;

revoke all on public.choirs from anon, authenticated;
revoke all on public.choirs from service_role;
grant select, insert, update on public.choirs to service_role;

alter table public.registrations
  drop constraint if exists registrations_diocese_check;

alter table public.registrations
  add column choir_name text;

update public.registrations
set choir_name = diocese
where choir_name is null;

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

alter table public.registrations
  alter column choir_name set not null,
  add constraint registrations_choir_names_match_check check (diocese = choir_name);

alter table public.registrations
  add column choir_id uuid references public.choirs(id) on delete restrict,
  add column pricing_type text,
  add column standard_price_cents integer,
  add column registration_price_cents integer,
  add column shirt_price_cents integer,
  add constraint registrations_pricing_type_check
    check (pricing_type is null or pricing_type in ('standard', 'promotional')),
  add constraint registrations_standard_price_check
    check (standard_price_cents is null or standard_price_cents > 0),
  add constraint registrations_registration_price_check
    check (registration_price_cents is null or registration_price_cents > 0),
  add constraint registrations_shirt_price_check
    check (shirt_price_cents is null or shirt_price_cents > 0),
  add constraint registrations_pricing_snapshot_check
    check (
      (
        choir_id is null
        and pricing_type is null
        and standard_price_cents is null
        and registration_price_cents is null
        and shirt_price_cents is null
      )
      or
      (
        choir_id is not null
        and pricing_type is not null
        and standard_price_cents is not null
        and registration_price_cents is not null
        and (
          (pricing_type = 'standard' and registration_price_cents = standard_price_cents)
          or
          (pricing_type = 'promotional' and registration_price_cents < standard_price_cents)
        )
      )
    ),
  add constraint registrations_shirt_price_snapshot_check
    check (
      pricing_type is null
      or (include_shirt and shirt_price_cents is not null)
      or (not include_shirt and shirt_price_cents is null)
    );
