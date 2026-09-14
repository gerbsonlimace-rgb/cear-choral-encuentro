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

  if not found or registration.payment_status <> 'paid' then
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
