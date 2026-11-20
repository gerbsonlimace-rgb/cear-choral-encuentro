begin;

alter table public.registrations
  add column if not exists dietary_restriction boolean,
  add column if not exists uses_event_van boolean;

comment on column public.registrations.dietary_restriction is
  'Participant answer to the event dietary-restriction question; NULL means not answered.';
comment on column public.registrations.uses_event_van is
  'Participant answer to the event shuttle/van question; NULL means not answered.';

create or replace function public.save_public_attendance_logistics(
  p_token text,
  p_dietary_restriction boolean,
  p_uses_event_van boolean
)
returns table(dietary_restriction boolean, uses_event_van boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_registration_id uuid;
  v_dietary_restriction boolean;
  v_uses_event_van boolean;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then
    raise exception 'PUBLIC_LOGISTICS_INVALID_CARD' using errcode = 'P0001';
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
      uses_event_van = p_uses_event_van
  where r.id = v_registration_id
  returning r.dietary_restriction, r.uses_event_van
  into v_dietary_restriction, v_uses_event_van;

  return query select v_dietary_restriction, v_uses_event_van;
end;
$$;

revoke all on function public.save_public_attendance_logistics(text, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.save_public_attendance_logistics(text, boolean, boolean)
  to service_role;

commit;
