begin;

create table public.registration_attendance_cards (
  registration_id uuid primary key references public.registrations(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  constraint registration_attendance_cards_token_check check (token ~ '^[a-f0-9]{64}$')
);
alter table public.registration_attendance_cards enable row level security;
revoke all on public.registration_attendance_cards from public, anon, authenticated;
grant select, insert on public.registration_attendance_cards to service_role;

insert into public.registration_attendance_cards (registration_id)
select id from public.registrations where cancelled_at is null;

create function public.create_registration_attendance_card()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.registration_attendance_cards (registration_id) values (new.id)
    on conflict (registration_id) do nothing;
  return new;
end;
$$;
revoke all on function public.create_registration_attendance_card() from public, anon, authenticated;
grant execute on function public.create_registration_attendance_card() to service_role;
create trigger registration_attendance_card_after_insert after insert on public.registrations
for each row execute function public.create_registration_attendance_card();

-- Registration is the durable identity, even before the participant creates an Auth account.
alter table public.event_activity_attendances alter column participant_account_id drop not null;
create unique index event_activity_attendances_registration_unique
  on public.event_activity_attendances(activity_id, registration_id);

create function public.prepare_attendance_cards(p_registration_ids uuid[])
returns table(registration_id uuid, token text)
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.registration_attendance_cards (registration_id)
    select r.id from public.registrations r
    where r.id = any(p_registration_ids) and r.cancelled_at is null
    on conflict on constraint registration_attendance_cards_pkey do nothing;
  return query select c.registration_id, c.token
    from public.registration_attendance_cards c join public.registrations r on r.id = c.registration_id
    where r.id = any(p_registration_ids) and r.cancelled_at is null;
end;
$$;

create function public.public_attendance_overview()
returns table(id uuid, title text, activity_date date, starts_at time, ends_at time,
  total_confirmed integer, attended integer, revision text)
language sql stable security invoker set search_path = '' as $$
  with eligible as materialized (
    select r.id from public.registrations r where r.payment_status = 'paid' and r.cancelled_at is null
  ), totals as (select count(*)::integer n from eligible),
  counts as (
    select a.activity_id, count(*)::integer n from public.event_activity_attendances a
    join eligible e on e.id = a.registration_id group by a.activity_id
  )
  select e.id, e.title, e.activity_date, e.starts_at, e.ends_at, totals.n,
    coalesce(counts.n,0), to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  from public.event_activities e cross join totals left join counts on counts.activity_id = e.id
  where e.is_active and e.requires_qr order by e.activity_date,e.sort_order,e.id;
$$;

create function public.record_public_attendance(p_activity_id uuid, p_token text)
returns table(status text, participant_name text, checked_in_at timestamptz,
  total_confirmed integer, attended integer, revision text)
language plpgsql security invoker set search_path = '' as $$
declare
  activity public.event_activities%rowtype;
  registration public.registrations%rowtype;
  v_attendance public.event_activity_attendances%rowtype;
  v_inserted boolean;
  v_revision text;
begin
  select * into activity from public.event_activities where id = p_activity_id for update;
  if not found or not activity.is_active or not activity.requires_qr then
    return query select 'activity_unavailable'::text,null::text,null::timestamptz,0,0,''::text; return;
  end if;
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then
    return query select 'invalid_card'::text,null::text,null::timestamptz,0,0,''::text; return;
  end if;
  select r.* into registration from public.registrations r
    join public.registration_attendance_cards c on c.registration_id=r.id
    where c.token = p_token for share of r;
  if not found then
    return query select 'invalid_card'::text,null::text,null::timestamptz,0,0,''::text; return;
  end if;
  if registration.payment_status <> 'paid' or registration.cancelled_at is not null then
    return query select 'ineligible'::text,null::text,null::timestamptz,0,0,''::text; return;
  end if;
  insert into public.event_activity_attendances(activity_id,registration_id,participant_account_id,qr_version)
  values(activity.id,registration.id,
    (select a.id from public.participant_accounts a where a.registration_id=registration.id limit 1),activity.qr_version)
  on conflict (activity_id,registration_id) do nothing returning * into v_attendance;
  v_inserted := found;
  if not v_inserted then
    select a.* into v_attendance from public.event_activity_attendances a
    where a.activity_id=activity.id and a.registration_id=registration.id;
  end if;
  v_revision := to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  return query select case when v_inserted then 'recorded' else 'already_recorded' end,
    coalesce(nullif(btrim(registration.badge_name),''),registration.name),v_attendance.checked_in_at,
    (select count(*)::integer from public.registrations r where r.payment_status='paid' and r.cancelled_at is null),
    (select count(*)::integer from public.event_activity_attendances a
      join public.registrations r on r.id=a.registration_id
      where a.activity_id=activity.id and r.payment_status='paid' and r.cancelled_at is null),v_revision;
end;
$$;

revoke all on function public.prepare_attendance_cards(uuid[]),public.public_attendance_overview(),
  public.record_public_attendance(uuid,text) from public, anon, authenticated;
grant execute on function public.prepare_attendance_cards(uuid[]),public.public_attendance_overview(),
  public.record_public_attendance(uuid,text) to service_role;

-- The previous authenticated RPC follows below, with the same registration-level conflict key.
-- Activity schedules are informational; valid QR check-ins are accepted at any time.
-- Keep server-only access, QR revocation, payment, location and duplicate checks.
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
  measured_distance double precision := null;
  v_checked_at timestamptz := clock_timestamp();
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

  if not found or registration.payment_status <> 'paid' or registration.cancelled_at is not null then
    raise exception 'EVENT_ATTENDANCE_REGISTRATION_UNPAID';
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
    if p_position_collected_at < v_checked_at - interval '2 minutes'
      or p_position_collected_at > v_checked_at + interval '30 seconds' then
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
  on conflict (activity_id, registration_id) do nothing
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
    and registration_id = registration.id;

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

commit;
