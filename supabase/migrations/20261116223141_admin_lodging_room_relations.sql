begin;

create table public.lodging_rooms (
  id uuid primary key default gen_random_uuid(),
  room_key text not null unique,
  choir_name text not null,
  room_index integer not null,
  room_type text not null,
  capacity integer not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lodging_rooms_key_check check (char_length(btrim(room_key)) between 1 and 300),
  constraint lodging_rooms_choir_name_check check (char_length(btrim(choir_name)) between 1 and 255),
  constraint lodging_rooms_index_check check (room_index between 1 and 100000),
  constraint lodging_rooms_type_check check (room_type in ('auto', 'extra')),
  constraint lodging_rooms_capacity_check check (capacity between 1 and 100),
  constraint lodging_rooms_choir_index_unique unique (choir_name, room_index)
    deferrable initially deferred
);

alter table public.lodging_rooms enable row level security;
revoke all on public.lodging_rooms from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.lodging_rooms to service_role;

alter table public.registrations
  add column if not exists lodging_room_id uuid
    references public.lodging_rooms(id) on delete set null,
  add column if not exists admin_lodging_opt_out boolean not null default false;

alter table public.registrations
  drop constraint if exists registrations_admin_lodging_opt_out_check;
alter table public.registrations
  add constraint registrations_admin_lodging_opt_out_check
  check (not admin_lodging_opt_out or lodging_room_id is null);

create index if not exists registrations_lodging_room_id_idx
  on public.registrations (lodging_room_id)
  where lodging_room_id is not null;

create or replace function public.clear_cancelled_registration_lodging_room()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.cancelled_at is not null then
    new.lodging_room_id := null;
    new.admin_lodging_opt_out := false;
  end if;
  return new;
end;
$$;

drop trigger if exists clear_cancelled_registration_lodging_room on public.registrations;
create trigger clear_cancelled_registration_lodging_room
  before insert or update of cancelled_at on public.registrations
  for each row execute function public.clear_cancelled_registration_lodging_room();
revoke all on function public.clear_cancelled_registration_lodging_room() from public, anon, authenticated;
comment on column public.registrations.lodging_room_id is
  'Room assigned to this registration in the normalized lodging plan.';
comment on column public.registrations.admin_lodging_opt_out is
  'Whether this eligible registration voluntarily opted out of event lodging.';

-- Backfill relational rooms and registration links from the saved JSON plan.
do $$
declare
  saved_plan public.lodging_plan;
begin
  select * into saved_plan from public.lodging_plan where id is true;
  if not found then
    return;
  end if;

  with choir_demand as (
    select
      coalesce(registration.choir_name, 'Sem coro') as choir_name,
      ceil(count(*) filter (where registration.voice_part in ('tenor', 'baixo'))::numeric / greatest(saved_plan.room_capacity, 1))::integer as men_rooms,
      ceil(count(*) filter (where registration.voice_part in ('soprano', 'contralto'))::numeric / greatest(saved_plan.room_capacity, 1))::integer as women_rooms
    from public.registrations as registration
    where registration.cancelled_at is null
      and registration.registration_price_cents is distinct from 8000
      and not (registration.id = any(saved_plan.no_lodging_registration_ids))
    group by coalesce(registration.choir_name, 'Sem coro')
  ),
  room_rows as (
    select
      demand.choir_name || '::' || generated.room_index::text as room_key,
      demand.choir_name,
      generated.room_index + 1 as room_index,
      'auto'::text as room_type,
      greatest(saved_plan.room_capacity, 1) as capacity,
      exists (
        select 1 from jsonb_array_elements_text(saved_plan.hidden_rooms) as hidden(room_key)
        where hidden.room_key = demand.choir_name || '::' || generated.room_index::text
      ) as hidden
    from choir_demand as demand
    cross join lateral generate_series(0, demand.men_rooms + demand.women_rooms - 1) as generated(room_index)
    union all
    select
      extra.choir_name || '::extra::' || room.value as room_key,
      extra.choir_name,
      (coalesce(demand.men_rooms + demand.women_rooms, 0) + room.ordinality)::integer as room_index,
      'extra'::text as room_type,
      greatest(saved_plan.room_capacity, 1) as capacity,
      exists (
        select 1 from jsonb_array_elements_text(saved_plan.hidden_rooms) as hidden(room_key)
        where hidden.room_key = extra.choir_name || '::extra::' || room.value
      ) as hidden
    from jsonb_each(saved_plan.extra_rooms) as extra(choir_name, rooms)
    cross join lateral jsonb_array_elements_text(extra.rooms) with ordinality as room(value, ordinality)
    left join choir_demand as demand on demand.choir_name = extra.choir_name
  )
  insert into public.lodging_rooms (room_key, choir_name, room_index, room_type, capacity, hidden)
  select room_key, choir_name, room_index, room_type, capacity, hidden from room_rows
  on conflict (room_key) do update set
    choir_name = excluded.choir_name,
    room_index = excluded.room_index,
    room_type = excluded.room_type,
    capacity = excluded.capacity,
    hidden = excluded.hidden,
    updated_at = now();

  update public.registrations as registration
  set lodging_room_id = case
        when registration.registration_price_cents = 8000
          or registration.id = any(saved_plan.no_lodging_registration_ids) then null
        else (
          select room.id
          from public.lodging_rooms as room
          where room.room_key = saved_plan.assignments ->> registration.id::text
            and room.choir_name = coalesce(registration.choir_name, 'Sem coro')
            and not room.hidden
        )
      end,
      admin_lodging_opt_out = registration.registration_price_cents is distinct from 8000
        and registration.id = any(saved_plan.no_lodging_registration_ids)
  where registration.cancelled_at is null;
end;
$$;

create or replace function public.replace_lodging_plan_with_rooms(
  p_rooms_available integer,
  p_room_capacity integer,
  p_no_lodging_registration_ids uuid[],
  p_assignments jsonb,
  p_extra_rooms jsonb,
  p_hidden_rooms jsonb,
  p_extra_people jsonb,
  p_extra_room_counter integer,
  p_rooms jsonb,
  p_placements jsonb
) returns public.lodging_plan
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_plan public.lodging_plan;
  placement_count integer;
  active_registration_count integer;
begin
  if p_rooms is null or jsonb_typeof(p_rooms) is distinct from 'array'
    or p_placements is null or jsonb_typeof(p_placements) is distinct from 'array' then
    raise exception 'Invalid lodging room plan';
  end if;
  if jsonb_array_length(p_rooms) > 10000 or jsonb_array_length(p_placements) > 20000 then
    raise exception 'Lodging room plan exceeds the supported size';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin_lodging_plan', 0));
  lock table public.registrations in share row exclusive mode;

  if exists (
    select 1
    from jsonb_to_recordset(p_rooms) as room(room_key text, choir_name text, room_index integer, room_type text, capacity integer, hidden boolean)
    where room.room_key is null or char_length(btrim(room.room_key)) not between 1 and 300
      or room.choir_name is null or char_length(btrim(room.choir_name)) not between 1 and 255
      or room.room_index is null or room.room_index not between 1 and 100000
      or room.room_type is null or room.room_type not in ('auto', 'extra')
      or room.capacity is null or room.capacity not between 1 and 100
      or room.hidden is null
  ) or exists (
    select 1 from jsonb_to_recordset(p_rooms) as room(room_key text, choir_name text, room_index integer, room_type text, capacity integer, hidden boolean)
    group by room.room_key having count(*) > 1
  ) or exists (
    select 1 from jsonb_to_recordset(p_rooms) as room(room_key text, choir_name text, room_index integer, room_type text, capacity integer, hidden boolean)
    group by room.choir_name, room.room_index having count(*) > 1
  ) then
    raise exception 'Invalid lodging room data';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_placements) as placement(registration_id text, choir_name text, room_key text, opted_out boolean)
    where placement.registration_id is null
      or placement.registration_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or placement.choir_name is null or char_length(btrim(placement.choir_name)) not between 1 and 255
      or placement.opted_out is null
      or (placement.room_key is not null and char_length(placement.room_key) not between 1 and 300)
      or (placement.opted_out and placement.room_key is not null)
  ) or exists (
    select 1 from jsonb_to_recordset(p_placements) as placement(registration_id text, choir_name text, room_key text, opted_out boolean)
    group by placement.registration_id having count(*) > 1
  ) then
    raise exception 'Invalid lodging registration placement';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_placements) as placement(registration_id text, choir_name text, room_key text, opted_out boolean)
    where placement.room_key is not null
      and not exists (
        select 1 from jsonb_to_recordset(p_rooms) as room(room_key text, choir_name text, room_index integer, room_type text, capacity integer, hidden boolean)
        where room.room_key = placement.room_key
          and room.choir_name = placement.choir_name
          and room.hidden is false
      )
  ) then
    raise exception 'A registration references an unavailable room';
  end if;

  select count(*) into active_registration_count
  from public.registrations as registration where registration.cancelled_at is null;
  select jsonb_array_length(p_placements) into placement_count;

  if placement_count <> active_registration_count
    or exists (
      select 1
      from jsonb_to_recordset(p_placements) as placement(registration_id text, choir_name text, room_key text, opted_out boolean)
      left join public.registrations as registration
        on registration.id::text = placement.registration_id and registration.cancelled_at is null
      where registration.id is null
    )
    or exists (
      select 1 from public.registrations as registration
      where registration.cancelled_at is null and not exists (
        select 1 from jsonb_to_recordset(p_placements) as placement(registration_id text, choir_name text, room_key text, opted_out boolean)
        where placement.registration_id = registration.id::text
      )
    )
    or exists (
      select 1
      from jsonb_to_recordset(p_placements) as placement(registration_id text, choir_name text, room_key text, opted_out boolean)
      join public.registrations as registration on registration.id::text = placement.registration_id
      where registration.cancelled_at is null
        and coalesce(registration.choir_name, 'Sem coro') <> placement.choir_name
    ) then
    raise exception 'The registration list changed; reload the lodging page and try again';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_placements) as placement(registration_id text, choir_name text, room_key text, opted_out boolean)
    join public.registrations as registration on registration.id::text = placement.registration_id
    where registration.cancelled_at is null
      and registration.registration_price_cents = 8000
      and (placement.room_key is not null or placement.opted_out)
  ) then
    raise exception 'Registrations without lodging cannot be assigned to a room';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_placements) as placement(registration_id text, choir_name text, room_key text, opted_out boolean)
    join public.registrations as registration on registration.id::text = placement.registration_id
    where registration.cancelled_at is null
      and placement.opted_out is distinct from (
        registration.registration_price_cents is distinct from 8000
        and registration.id = any(coalesce(p_no_lodging_registration_ids, '{}'::uuid[]))
      )
  ) then
    raise exception 'The lodging opt-out list does not match the active registration placements';
  end if;

  delete from public.lodging_rooms as existing
  where not exists (
    select 1 from jsonb_to_recordset(p_rooms) as room(room_key text, choir_name text, room_index integer, room_type text, capacity integer, hidden boolean)
    where room.room_key = existing.room_key
  );

  insert into public.lodging_rooms (room_key, choir_name, room_index, room_type, capacity, hidden)
  select room.room_key, room.choir_name, room.room_index, room.room_type, room.capacity, room.hidden
  from jsonb_to_recordset(p_rooms) as room(room_key text, choir_name text, room_index integer, room_type text, capacity integer, hidden boolean)
  on conflict (room_key) do update set
    choir_name = excluded.choir_name,
    room_index = excluded.room_index,
    room_type = excluded.room_type,
    capacity = excluded.capacity,
    hidden = excluded.hidden,
    updated_at = now();

  saved_plan := public.replace_lodging_plan(
    p_rooms_available,
    p_room_capacity,
    p_no_lodging_registration_ids,
    p_assignments,
    p_extra_rooms,
    p_hidden_rooms,
    p_extra_people,
    p_extra_room_counter
  );

  update public.registrations as registration
  set lodging_room_id = room.id,
      admin_lodging_opt_out = placement.opted_out
  from jsonb_to_recordset(p_placements) as placement(registration_id text, choir_name text, room_key text, opted_out boolean)
  left join public.lodging_rooms as room
    on room.room_key = placement.room_key and room.choir_name = placement.choir_name
  where registration.id::text = placement.registration_id
    and registration.cancelled_at is null;

  return saved_plan;
end;
$$;

revoke all on function public.replace_lodging_plan_with_rooms(integer, integer, uuid[], jsonb, jsonb, jsonb, jsonb, integer, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_lodging_plan_with_rooms(integer, integer, uuid[], jsonb, jsonb, jsonb, jsonb, integer, jsonb, jsonb)
  to service_role;

comment on table public.lodging_rooms is
  'Normalized lodging rooms linked to registrations through registrations.lodging_room_id.';
comment on function public.replace_lodging_plan_with_rooms(integer, integer, uuid[], jsonb, jsonb, jsonb, jsonb, integer, jsonb, jsonb) is
  'Atomically saves the lodging editor plan, normalized room rows and registration-to-room links.';

commit;
