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

create or replace function public.increment_event_activity_qr_version(
  p_activity_id uuid
)
returns public.event_activities
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.event_activities
  set
    qr_version = qr_version + 1,
    updated_at = clock_timestamp()
  where id = p_activity_id
  returning *;
$$;

revoke all on function public.increment_event_activity_qr_version(uuid)
  from public, anon, authenticated;
grant execute on function public.increment_event_activity_qr_version(uuid)
  to service_role;

create or replace function public.record_event_activity_attendance(
  p_activity_id uuid,
  p_qr_version integer,
  p_participant_account_id uuid,
  p_registration_id uuid,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_accuracy_meters double precision default null,
  p_position_collected_at timestamptz default null
)
returns table (
  status text,
  activity_title text,
  checked_in_at timestamptz,
  distance_meters double precision
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  activity public.event_activities%rowtype;
  participant public.participant_accounts%rowtype;
  registration public.registrations%rowtype;
  existing_attendance public.event_activity_attendances%rowtype;
  inserted_attendance public.event_activity_attendances%rowtype;
  window_starts_at timestamptz;
  window_ends_at timestamptz;
  measured_distance double precision := null;
  current_time timestamptz := clock_timestamp();
begin
  select * into activity
  from public.event_activities
  where id = p_activity_id
  for update;

  if not found or activity.is_active = false or activity.requires_qr = false then
    raise exception 'EVENT_ATTENDANCE_ACTIVITY_UNAVAILABLE';
  end if;
  if activity.qr_version <> p_qr_version then
    raise exception 'EVENT_ATTENDANCE_QR_REVOKED';
  end if;

  select * into participant
  from public.participant_accounts
  where id = p_participant_account_id
    and registration_id = p_registration_id;

  if not found or participant.access_status <> 'active' or participant.user_id is null then
    raise exception 'EVENT_ATTENDANCE_PARTICIPANT_UNAUTHORIZED';
  end if;

  select * into registration
  from public.registrations
  where id = p_registration_id;

  if not found or registration.payment_status <> 'paid' then
    raise exception 'EVENT_ATTENDANCE_REGISTRATION_UNPAID';
  end if;

  window_starts_at := (activity.activity_date + activity.starts_at) at time zone 'America/Fortaleza';
  window_ends_at := (activity.activity_date + activity.ends_at) at time zone 'America/Fortaleza';
  if current_time < window_starts_at - interval '30 minutes'
    or current_time > window_ends_at + interval '30 minutes' then
    raise exception 'EVENT_ATTENDANCE_OUTSIDE_WINDOW';
  end if;

  if activity.verify_location then
    if p_latitude is null or p_longitude is null or p_accuracy_meters is null
      or p_position_collected_at is null then
      raise exception 'EVENT_ATTENDANCE_LOCATION_REQUIRED';
    end if;
    if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
      raise exception 'EVENT_ATTENDANCE_LOCATION_INVALID';
    end if;
    if p_accuracy_meters < 0 or p_accuracy_meters > 100 then
      raise exception 'EVENT_ATTENDANCE_LOCATION_INACCURATE';
    end if;
    if p_position_collected_at < current_time - interval '2 minutes'
      or p_position_collected_at > current_time + interval '30 seconds' then
      raise exception 'EVENT_ATTENDANCE_LOCATION_STALE';
    end if;

    measured_distance := 6371000 * 2 * asin(sqrt(least(1, greatest(0,
      power(sin(radians(p_latitude - activity.latitude) / 2), 2)
      + cos(radians(activity.latitude)) * cos(radians(p_latitude))
      * power(sin(radians(p_longitude - activity.longitude) / 2), 2)
    ))));
    if measured_distance > activity.radius_meters then
      raise exception 'EVENT_ATTENDANCE_OUTSIDE_GEOFENCE';
    end if;
  else
    p_latitude := null;
    p_longitude := null;
    p_accuracy_meters := null;
    p_position_collected_at := null;
  end if;

  insert into public.event_activity_attendances (
    activity_id,
    participant_account_id,
    registration_id,
    qr_version,
    latitude,
    longitude,
    accuracy_meters,
    position_collected_at,
    distance_meters
  ) values (
    activity.id,
    participant.id,
    registration.id,
    activity.qr_version,
    p_latitude,
    p_longitude,
    p_accuracy_meters,
    p_position_collected_at,
    measured_distance
  )
  on conflict (activity_id, participant_account_id) do nothing
  returning * into inserted_attendance;

  if inserted_attendance.id is not null then
    return query select
      'recorded'::text,
      activity.title,
      inserted_attendance.checked_in_at,
      inserted_attendance.distance_meters;
    return;
  end if;

  select * into existing_attendance
  from public.event_activity_attendances
  where activity_id = activity.id
    and participant_account_id = participant.id;

  return query select
    'already_recorded'::text,
    activity.title,
    existing_attendance.checked_in_at,
    existing_attendance.distance_meters;
end;
$$;

revoke all on function public.record_event_activity_attendance(
  uuid, integer, uuid, uuid, double precision, double precision, double precision, timestamptz
) from public, anon, authenticated;
grant execute on function public.record_event_activity_attendance(
  uuid, integer, uuid, uuid, double precision, double precision, double precision, timestamptz
) to service_role;

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
