-- Lodging plan for the administration lodging screen.
-- A single singleton row holds the whole plan so one write replaces every
-- allocation atomically and no partial plan can ever be read.
create table public.lodging_plan (
  id boolean not null default true,
  rooms_available integer not null default 0,
  room_capacity integer not null default 3,
  no_lodging_registration_ids uuid[] not null default '{}',
  assignments jsonb not null default '{}'::jsonb,
  extra_rooms jsonb not null default '{}'::jsonb,
  hidden_rooms jsonb not null default '[]'::jsonb,
  extra_people jsonb not null default '[]'::jsonb,
  extra_room_counter integer not null default 100000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lodging_plan_singleton_check check (id = true),
  constraint lodging_plan_singleton_unique unique (id),
  constraint lodging_plan_rooms_available_check check (rooms_available >= 0),
  constraint lodging_plan_room_capacity_check check (room_capacity > 0),
  constraint lodging_plan_extra_room_counter_check check (extra_room_counter >= 100000)
);

alter table public.lodging_plan enable row level security;
revoke all on public.lodging_plan from anon, authenticated;
revoke all on public.lodging_plan from public, service_role;
grant select, insert, update on public.lodging_plan to service_role;

-- The plan is replaced in a single statement, so a failed save never leaves a
-- half-written allocation behind.
create or replace function public.replace_lodging_plan(
  p_rooms_available integer,
  p_room_capacity integer,
  p_no_lodging_registration_ids uuid[],
  p_assignments jsonb,
  p_extra_rooms jsonb,
  p_hidden_rooms jsonb,
  p_extra_people jsonb,
  p_extra_room_counter integer
) returns public.lodging_plan
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.lodging_plan (
    id,
    rooms_available,
    room_capacity,
    no_lodging_registration_ids,
    assignments,
    extra_rooms,
    hidden_rooms,
    extra_people,
    extra_room_counter,
    updated_at
  ) values (
    true,
    greatest(coalesce(p_rooms_available, 0), 0),
    greatest(coalesce(p_room_capacity, 3), 1),
    coalesce(p_no_lodging_registration_ids, '{}'),
    coalesce(p_assignments, '{}'::jsonb),
    coalesce(p_extra_rooms, '{}'::jsonb),
    coalesce(p_hidden_rooms, '[]'::jsonb),
    coalesce(p_extra_people, '[]'::jsonb),
    greatest(coalesce(p_extra_room_counter, 100000), 100000),
    now()
  )
  on conflict (id) do update set
    rooms_available = excluded.rooms_available,
    room_capacity = excluded.room_capacity,
    no_lodging_registration_ids = excluded.no_lodging_registration_ids,
    assignments = excluded.assignments,
    extra_rooms = excluded.extra_rooms,
    hidden_rooms = excluded.hidden_rooms,
    extra_people = excluded.extra_people,
    extra_room_counter = excluded.extra_room_counter,
    updated_at = now()
  returning *;
end;
$$;

revoke all on function public.replace_lodging_plan(integer, integer, uuid[], jsonb, jsonb, jsonb, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.replace_lodging_plan(integer, integer, uuid[], jsonb, jsonb, jsonb, jsonb, integer)
  to service_role;

-- Photos of the people added by hand live in the private bucket, never inline.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lodging-photos', 'lodging-photos', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Only server functions protected by requireAdmin use the service-role client.
-- No browser-facing table or Storage policy is granted.
