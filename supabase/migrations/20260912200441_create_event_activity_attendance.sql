create table public.event_activities (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 160),
  activity_date date not null check (activity_date between date '2026-11-20' and date '2026-11-22'),
  starts_at time,
  ends_at time,
  location text check (location is null or char_length(btrim(location)) <= 500),
  description text check (description is null or char_length(btrim(description)) <= 500),
  category text not null check (
    category in ('welcome', 'celebration', 'meal', 'conference', 'music', 'visit')
  ),
  sort_order integer not null default 0 check (sort_order between 0 and 999),
  is_active boolean not null default true,
  requires_qr boolean not null default false,
  verify_location boolean not null default false,
  latitude double precision,
  longitude double precision,
  radius_meters integer,
  qr_version integer not null default 1 check (qr_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_activities_end_requires_start_check check (
    ends_at is null or starts_at is not null
  ),
  constraint event_activities_time_order_check check (
    starts_at is null or ends_at is null or ends_at > starts_at
  ),
  constraint event_activities_qr_window_check check (
    requires_qr = false or (starts_at is not null and ends_at is not null)
  ),
  constraint event_activities_location_requires_qr_check check (
    verify_location = false or requires_qr = true
  ),
  constraint event_activities_location_configuration_check check (
    (
      verify_location = true
      and latitude is not null
      and longitude is not null
      and radius_meters between 10 and 5000
    )
    or (
      verify_location = false
      and latitude is null
      and longitude is null
      and radius_meters is null
    )
  ),
  constraint event_activities_latitude_check check (
    latitude is null or latitude between -90 and 90
  ),
  constraint event_activities_longitude_check check (
    longitude is null or longitude between -180 and 180
  )
);

create index event_activities_program_idx
  on public.event_activities (is_active, activity_date, sort_order, starts_at, id);
create index event_activities_qr_required_idx
  on public.event_activities (activity_date, starts_at, ends_at)
  where is_active = true and requires_qr = true;

alter table public.event_activities enable row level security;
revoke all on public.event_activities from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.event_activities to service_role;

create table public.event_activity_attendances (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.event_activities(id) on delete restrict,
  participant_account_id uuid not null references public.participant_accounts(id) on delete restrict,
  registration_id uuid not null references public.registrations(id) on delete restrict,
  qr_version integer not null check (qr_version > 0),
  checked_in_at timestamptz not null default clock_timestamp(),
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  accuracy_meters double precision check (accuracy_meters is null or accuracy_meters >= 0),
  position_collected_at timestamptz,
  distance_meters double precision check (distance_meters is null or distance_meters >= 0),
  unique (activity_id, participant_account_id)
);

create index event_activity_attendances_registration_idx
  on public.event_activity_attendances (registration_id, checked_in_at desc);
create index event_activity_attendances_activity_idx
  on public.event_activity_attendances (activity_id, checked_in_at desc);

alter table public.event_activity_attendances enable row level security;
revoke all on public.event_activity_attendances from public, anon, authenticated, service_role;
grant select, insert on public.event_activity_attendances to service_role;

insert into public.event_activities
  (title, activity_date, starts_at, ends_at, category, sort_order, is_active, requires_qr, verify_location)
values
  ('Credenciamento', '2026-11-20', '16:00', '18:00', 'welcome', 10, true, false, false),
  ('Vésperas', '2026-11-20', '18:00', null, 'celebration', 20, true, false, false),
  ('Jantar', '2026-11-20', '18:30', null, 'meal', 30, true, false, false),
  ('Abertura oficial', '2026-11-20', '19:30', null, 'welcome', 40, true, false, false),
  ('1ª Conferência', '2026-11-20', '20:00', '21:00', 'conference', 50, true, false, false),
  ('Completas', '2026-11-20', null, null, 'celebration', 60, true, false, false),
  ('Santa Missa', '2026-11-21', '07:00', null, 'celebration', 70, true, false, false),
  ('Café da manhã', '2026-11-21', '08:00', null, 'meal', 80, true, false, false),
  ('2ª Conferência', '2026-11-21', '09:00', null, 'conference', 90, true, false, false),
  ('Coffee break', '2026-11-21', '10:00', null, 'meal', 100, true, false, false),
  ('3ª Conferência', '2026-11-21', '10:30', null, 'conference', 110, true, false, false),
  ('Ensaio 1', '2026-11-21', '11:30', null, 'music', 120, true, false, false),
  ('Almoço', '2026-11-21', '12:30', null, 'meal', 130, true, false, false),
  ('4ª Conferência', '2026-11-21', '14:00', null, 'conference', 140, true, false, false),
  ('Ensaio 2', '2026-11-21', '15:00', null, 'music', 150, true, false, false),
  ('Coffee break', '2026-11-21', '16:00', null, 'meal', 160, true, false, false),
  ('Visita ao Santuário', '2026-11-21', null, null, 'visit', 170, true, false, false),
  ('Concerto na Catedral', '2026-11-21', '20:00', null, 'music', 180, true, false, false),
  ('Jantar', '2026-11-21', null, null, 'meal', 190, true, false, false),
  ('Laudes', '2026-11-22', '07:30', null, 'celebration', 200, true, false, false),
  ('Café da manhã', '2026-11-22', '08:00', null, 'meal', 210, true, false, false),
  ('Ensaio 3', '2026-11-22', '09:00', null, 'music', 220, true, false, false),
  ('Missa Solene na Catedral', '2026-11-22', '10:00', null, 'celebration', 230, true, false, false),
  ('Almoço e despedida', '2026-11-22', '12:00', null, 'meal', 240, true, false, false);
