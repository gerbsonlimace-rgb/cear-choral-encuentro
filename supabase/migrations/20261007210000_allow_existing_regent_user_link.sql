-- Preserve the existing five-argument function for callers that still create
-- temporary passwords. This overload lets the server choose whether the new
-- membership must change its password, while retaining the atomic replacement.
create or replace function public.replace_active_choir_regent(
  p_choir_id uuid,
  p_user_id uuid,
  p_email text,
  p_name text,
  p_granted_by uuid,
  p_password_change_required boolean
)
returns public.choir_regents
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_regent public.choir_regents;
  v_changed_at timestamptz;
begin
  perform 1 from public.choirs as choir where choir.id = p_choir_id for update;
  if not found then
    raise exception 'Choir not found' using errcode = '23503';
  end if;

  v_changed_at := clock_timestamp();
  update public.choir_regents
  set revoked_at = v_changed_at, revoked_by = p_granted_by
  where choir_id = p_choir_id and revoked_at is null;

  insert into public.choir_regents (
    choir_id, user_id, email, name, password_change_required, granted_at, granted_by
  ) values (
    p_choir_id, p_user_id, lower(btrim(p_email)), btrim(p_name),
    p_password_change_required, v_changed_at, p_granted_by
  ) returning * into v_regent;

  return v_regent;
end;
$$;

revoke all on function public.replace_active_choir_regent(uuid, uuid, text, text, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.replace_active_choir_regent(uuid, uuid, text, text, uuid, boolean)
  to service_role;
