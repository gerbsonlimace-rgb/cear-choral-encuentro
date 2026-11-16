-- Persist the upsert result before returning it from the composite RPC.
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
declare
  saved_plan public.lodging_plan;
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
  returning * into saved_plan;

  return saved_plan;
end;
$$;

revoke all on function public.replace_lodging_plan(integer, integer, uuid[], jsonb, jsonb, jsonb, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.replace_lodging_plan(integer, integer, uuid[], jsonb, jsonb, jsonb, jsonb, integer)
  to service_role;
