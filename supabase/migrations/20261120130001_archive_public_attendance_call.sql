create table if not exists public.event_activity_attendance_archives (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.event_activities(id) on delete restrict,
  activity_title text not null,
  activity_date date not null,
  archived_by_registration_id uuid references public.registrations(id) on delete set null,
  archived_at timestamptz not null default clock_timestamp(),
  attendance_count integer not null check (attendance_count >= 0),
  attendance_rows jsonb not null check (jsonb_typeof(attendance_rows) = 'array')
);

create index if not exists event_activity_attendance_archives_activity_idx
  on public.event_activity_attendance_archives (activity_id, archived_at desc);

alter table public.event_activity_attendance_archives enable row level security;
revoke all on public.event_activity_attendance_archives from public, anon, authenticated, service_role;
grant select, insert on public.event_activity_attendance_archives to service_role;

create or replace function public.archive_public_attendance_call(
  p_activity_id uuid,
  p_archived_by_registration_id uuid
)
returns table(archived_count integer, revision text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  activity public.event_activities%rowtype;
  rows jsonb;
  row_count integer;
begin
  select * into activity from public.event_activities where id = p_activity_id for update;
  if not found or not activity.is_active or not activity.requires_qr then
    raise exception using errcode = '22023', message = 'Chamada indisponível para arquivamento.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.checked_in_at, a.id), '[]'::jsonb), count(*)::integer
    into rows, row_count
    from public.event_activity_attendances a
    where a.activity_id = p_activity_id;

  insert into public.event_activity_attendance_archives (
    activity_id, activity_title, activity_date, archived_by_registration_id, attendance_count, attendance_rows
  ) values (
    activity.id, activity.title, activity.activity_date, p_archived_by_registration_id, row_count, rows
  );

  delete from public.event_activity_attendances where activity_id = p_activity_id;
  update public.event_activities set qr_version = qr_version + 1, updated_at = clock_timestamp()
    where id = p_activity_id;

  return query select row_count, to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
end;
$$;

revoke all on function public.archive_public_attendance_call(uuid, uuid) from public, anon, authenticated;
grant execute on function public.archive_public_attendance_call(uuid, uuid) to service_role;
