alter table public.choir_regents
  add column password_change_operation_previous_required boolean;

update public.choir_regents
set password_change_operation_previous_required = password_change_required
where password_change_operation_kind is not null
  and password_change_retry_token_hash is not null;

alter table public.choir_regents
  drop constraint choir_regents_password_change_operation_state_check,
  add constraint choir_regents_password_change_operation_state_check check (
    (password_change_operation_kind is null) =
      (password_change_retry_token_hash is null)
    and (password_change_operation_kind is null) =
      (password_change_operation_previous_required is null)
  ),
  add constraint choir_regents_password_change_operation_previous_gate_check check (
    password_change_operation_kind <> 'regent'
    or password_change_operation_previous_required
  );

create or replace function public.claim_choir_regent_password_operation(
  p_membership_id uuid,
  p_user_id uuid,
  p_operation_kind text,
  p_operation_hash text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  claimed_id uuid;
begin
  if p_operation_kind not in ('admin', 'regent')
    or p_operation_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  update public.choir_regents
  set password_change_operation_previous_required = password_change_required,
      password_change_required =
        case when p_operation_kind = 'admin' then true else password_change_required end,
      password_change_operation_kind = p_operation_kind,
      password_change_retry_token_hash = p_operation_hash
  where id = p_membership_id
    and user_id = p_user_id
    and revoked_at is null
    and password_change_operation_kind is null
    and password_change_retry_token_hash is null
    and password_change_operation_previous_required is null
    and (p_operation_kind = 'admin' or password_change_required)
  returning id into claimed_id;

  return claimed_id is not null;
end;
$$;

create or replace function public.finish_choir_regent_password_operation(
  p_membership_id uuid,
  p_user_id uuid,
  p_operation_kind text,
  p_operation_hash text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  finished_id uuid;
begin
  update public.choir_regents
  set password_change_required = (p_operation_kind = 'admin'),
      password_change_operation_kind = null,
      password_change_retry_token_hash = null,
      password_change_operation_previous_required = null
  where id = p_membership_id
    and user_id = p_user_id
    and revoked_at is null
    and password_change_operation_kind = p_operation_kind
    and password_change_retry_token_hash = p_operation_hash
  returning id into finished_id;

  return finished_id is not null;
end;
$$;

create or replace function public.release_choir_regent_password_operation(
  p_membership_id uuid,
  p_user_id uuid,
  p_operation_kind text,
  p_operation_hash text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  released_id uuid;
begin
  update public.choir_regents
  set password_change_required =
        case when p_operation_kind = 'admin'
          then password_change_operation_previous_required
          else password_change_required
        end,
      password_change_operation_kind = null,
      password_change_retry_token_hash = null,
      password_change_operation_previous_required = null
  where id = p_membership_id
    and user_id = p_user_id
    and revoked_at is null
    and password_change_operation_kind = p_operation_kind
    and password_change_retry_token_hash = p_operation_hash
  returning id into released_id;

  return released_id is not null;
end;
$$;

revoke all on function public.claim_choir_regent_password_operation(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.finish_choir_regent_password_operation(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.release_choir_regent_password_operation(uuid, uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.claim_choir_regent_password_operation(uuid, uuid, text, text)
  to service_role;
grant execute on function public.finish_choir_regent_password_operation(uuid, uuid, text, text)
  to service_role;
grant execute on function public.release_choir_regent_password_operation(uuid, uuid, text, text)
  to service_role;
