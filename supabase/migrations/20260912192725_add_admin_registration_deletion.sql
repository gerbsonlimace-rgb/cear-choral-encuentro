create function public.delete_admin_registration(
  p_registration_id uuid,
  p_admin_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_photo_path text;
begin
  if not exists (
    select 1
    from public.admin_users
    where user_id = p_admin_user_id
      and revoked_at is null
  ) then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  select photo_path
  into v_photo_path
  from public.registrations
  where id = p_registration_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Registration not found';
  end if;

  delete from public.participant_access_events
  where registration_id = p_registration_id;

  delete from public.participant_accounts
  where registration_id = p_registration_id;

  delete from public.registration_complement_payments
  where registration_id = p_registration_id;

  delete from public.registrations
  where id = p_registration_id;

  return v_photo_path;
end
$$;

revoke all on function public.delete_admin_registration(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.delete_admin_registration(uuid, uuid)
  to service_role;
