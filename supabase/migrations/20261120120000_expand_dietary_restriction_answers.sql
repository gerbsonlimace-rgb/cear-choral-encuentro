begin;

alter table public.registrations
  add column if not exists dietary_restriction_types text[] not null default '{}'::text[],
  add column if not exists dietary_restriction_other text;

comment on column public.registrations.dietary_restriction_types is
  'Selected dietary restriction categories; populated when dietary_restriction is true.';
comment on column public.registrations.dietary_restriction_other is
  'Free-text details for the other dietary restriction category.';

drop function if exists public.save_public_attendance_logistics(text, boolean, boolean);

create or replace function public.save_public_attendance_logistics(
  p_token text,
  p_dietary_restriction boolean,
  p_dietary_restriction_types text[],
  p_dietary_restriction_other text,
  p_uses_event_van boolean
)
returns table(
  dietary_restriction boolean,
  dietary_restriction_types text[],
  dietary_restriction_other text,
  uses_event_van boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_registration_id uuid;
  v_dietary_restriction boolean;
  v_dietary_restriction_types text[];
  v_dietary_restriction_other text;
  v_uses_event_van boolean;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then
    raise exception 'PUBLIC_LOGISTICS_INVALID_CARD' using errcode = 'P0001';
  end if;

  if p_dietary_restriction is null or p_uses_event_van is null or p_dietary_restriction_types is null then
    raise exception 'PUBLIC_LOGISTICS_INVALID_ANSWERS' using errcode = 'P0001';
  end if;

  if p_dietary_restriction then
    if cardinality(p_dietary_restriction_types) = 0 then
      raise exception 'PUBLIC_LOGISTICS_SELECT_RESTRICTION' using errcode = 'P0001';
    end if;

    if exists (
      select 1 from unnest(p_dietary_restriction_types) as selected(value)
      where selected.value not in (
        'sem_lactose', 'sem_gluten', 'vegetariana', 'vegana',
        'amendoim_castanhas', 'ovo', 'soja', 'peixes_frutos_do_mar', 'outra'
      )
    ) then
      raise exception 'PUBLIC_LOGISTICS_INVALID_RESTRICTION' using errcode = 'P0001';
    end if;

    if exists (
      select 1 from unnest(p_dietary_restriction_types) as selected(value)
      group by selected.value having count(*) > 1
    ) then
      raise exception 'PUBLIC_LOGISTICS_DUPLICATE_RESTRICTION' using errcode = 'P0001';
    end if;

    if array_position(p_dietary_restriction_types, 'outra') is not null
      and nullif(btrim(p_dietary_restriction_other), '') is null then
      raise exception 'PUBLIC_LOGISTICS_DESCRIBE_OTHER_RESTRICTION' using errcode = 'P0001';
    end if;

    if array_position(p_dietary_restriction_types, 'outra') is null
      and p_dietary_restriction_other is not null then
      raise exception 'PUBLIC_LOGISTICS_UNEXPECTED_RESTRICTION_DETAILS' using errcode = 'P0001';
    end if;

    if char_length(coalesce(btrim(p_dietary_restriction_other), '')) > 280 then
      raise exception 'PUBLIC_LOGISTICS_RESTRICTION_DETAILS_TOO_LONG' using errcode = 'P0001';
    end if;
  elsif cardinality(p_dietary_restriction_types) > 0 or p_dietary_restriction_other is not null then
    raise exception 'PUBLIC_LOGISTICS_UNEXPECTED_RESTRICTION_DETAILS' using errcode = 'P0001';
  end if;

  select r.id into v_registration_id
  from public.registrations r
  join public.registration_attendance_cards c on c.registration_id = r.id
  where c.token = p_token
    and r.payment_status = 'paid'
    and r.cancelled_at is null
  for update of r;

  if not found then
    raise exception 'PUBLIC_LOGISTICS_INELIGIBLE_CARD' using errcode = 'P0001';
  end if;

  update public.registrations r
  set dietary_restriction = p_dietary_restriction,
      dietary_restriction_types = case when p_dietary_restriction then p_dietary_restriction_types else '{}'::text[] end,
      dietary_restriction_other = case when p_dietary_restriction and array_position(p_dietary_restriction_types, 'outra') is not null
        then nullif(btrim(p_dietary_restriction_other), '') else null end,
      uses_event_van = p_uses_event_van
  where r.id = v_registration_id
  returning r.dietary_restriction, r.dietary_restriction_types, r.dietary_restriction_other, r.uses_event_van
  into v_dietary_restriction, v_dietary_restriction_types, v_dietary_restriction_other, v_uses_event_van;

  return query select v_dietary_restriction, v_dietary_restriction_types, v_dietary_restriction_other, v_uses_event_van;
end;
$$;

revoke all on function public.save_public_attendance_logistics(text, boolean, text[], text, boolean)
  from public, anon, authenticated;
grant execute on function public.save_public_attendance_logistics(text, boolean, text[], text, boolean)
  to service_role;

commit;
