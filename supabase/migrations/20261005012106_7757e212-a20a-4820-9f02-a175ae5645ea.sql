create or replace function public.delete_admin_registration_confirmed(
  p_registration_id uuid,
  p_admin_user_id uuid,
  p_cpf text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reg record;
  v_user uuid;
begin
  if not exists (select 1 from public.admin_users where user_id = p_admin_user_id and revoked_at is null) then
    raise exception using errcode = '42501', message = 'Administrator access required';
  end if;

  select id, cpf, photo_path, manual_receipt_path into v_reg
  from public.registrations where id = p_registration_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Registration not found';
  end if;

  if coalesce(regexp_replace(v_reg.cpf, '\D', '', 'g'), '') = ''
     or regexp_replace(v_reg.cpf, '\D', '', 'g') <> regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g') then
    raise exception using errcode = '22023', message = 'CPF confirmation mismatch';
  end if;

  select user_id into v_user from public.participant_accounts where registration_id = p_registration_id limit 1;

  delete from public.event_activity_attendances where registration_id = p_registration_id;
  delete from public.participant_access_events where registration_id = p_registration_id;
  delete from public.participant_accounts where registration_id = p_registration_id;
  delete from public.registration_complement_payments where registration_id = p_registration_id;
  delete from public.registration_superseded_checkouts where registration_id = p_registration_id;
  delete from public.registrations where id = p_registration_id;

  return jsonb_build_object(
    'photo_path', v_reg.photo_path,
    'manual_receipt_path', v_reg.manual_receipt_path,
    'participant_user_id', v_user
  );
end
$$;

revoke all on function public.delete_admin_registration_confirmed(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.delete_admin_registration_confirmed(uuid, uuid, text) to service_role;