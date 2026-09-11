alter table public.choir_regents
  add column password_change_candidate_fingerprint text,
  add column password_change_operation_stage text;

update public.choir_regents
set password_change_operation_stage = 'legacy'
where password_change_operation_kind = 'regent';

update public.choir_regents
set password_change_operation_stage = 'claimed'
where password_change_operation_kind = 'admin';

alter table public.choir_regents
  drop constraint choir_regents_password_change_operation_state_check,
  add constraint choir_regents_password_change_operation_state_check check (
    (password_change_operation_kind is null) =
      (password_change_retry_token_hash is null)
    and (password_change_operation_kind is null) =
      (password_change_operation_previous_required is null)
    and (password_change_operation_kind is null) =
      (password_change_operation_stage is null)
  ),
  add constraint choir_regents_password_change_operation_stage_check check (
    password_change_operation_stage is null
    or password_change_operation_stage in ('claimed', 'candidate_verified', 'retryable', 'legacy')
  ),
  add constraint choir_regents_password_change_candidate_format_check check (
    password_change_candidate_fingerprint is null
    or password_change_candidate_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  add constraint choir_regents_password_change_candidate_state_check check (
    (
      password_change_operation_kind is null
      and password_change_operation_stage is null
      and password_change_candidate_fingerprint is null
    )
    or (
      password_change_operation_kind = 'admin'
      and password_change_operation_stage = 'claimed'
      and password_change_candidate_fingerprint is null
    )
    or (
      password_change_operation_kind = 'regent'
      and (
        (
          password_change_operation_stage = 'legacy'
          and password_change_candidate_fingerprint is null
        )
        or (
          password_change_operation_stage in ('claimed', 'candidate_verified', 'retryable')
          and password_change_candidate_fingerprint is not null
        )
      )
    )
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
      password_change_retry_token_hash = p_operation_hash,
      password_change_operation_stage =
        case when p_operation_kind = 'admin' then 'claimed' else 'legacy' end,
      password_change_candidate_fingerprint = null
  where id = p_membership_id
    and user_id = p_user_id
    and revoked_at is null
    and password_change_operation_kind is null
    and password_change_retry_token_hash is null
    and password_change_operation_previous_required is null
    and password_change_operation_stage is null
    and password_change_candidate_fingerprint is null
    and (p_operation_kind = 'admin' or password_change_required)
  returning id into claimed_id;

  return claimed_id is not null;
end;
$$;

create or replace function public.claim_choir_regent_password_candidate_operation(
  p_membership_id uuid,
  p_user_id uuid,
  p_operation_hash text,
  p_candidate_fingerprint text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  claimed_id uuid;
begin
  if p_operation_hash !~ '^[0-9a-f]{64}$'
    or p_candidate_fingerprint !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  update public.choir_regents
  set password_change_operation_previous_required = password_change_required,
      password_change_operation_kind = 'regent',
      password_change_retry_token_hash = p_operation_hash,
      password_change_operation_stage = 'claimed',
      password_change_candidate_fingerprint = p_candidate_fingerprint
  where id = p_membership_id
    and user_id = p_user_id
    and revoked_at is null
    and password_change_required
    and password_change_operation_kind is null
    and password_change_retry_token_hash is null
    and password_change_operation_previous_required is null
    and password_change_operation_stage is null
    and password_change_candidate_fingerprint is null
  returning id into claimed_id;

  return claimed_id is not null;
end;
$$;

create or replace function public.verify_choir_regent_password_operation_candidate(
  p_membership_id uuid,
  p_user_id uuid,
  p_operation_hash text,
  p_candidate_fingerprint text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  verified_id uuid;
begin
  update public.choir_regents
  set password_change_operation_stage = 'candidate_verified'
  where id = p_membership_id
    and user_id = p_user_id
    and revoked_at is null
    and password_change_required
    and password_change_operation_kind = 'regent'
    and password_change_retry_token_hash = p_operation_hash
    and password_change_candidate_fingerprint = p_candidate_fingerprint
    and password_change_operation_stage = 'claimed'
  returning id into verified_id;

  if verified_id is not null then
    return true;
  end if;

  return exists (
    select 1
    from public.choir_regents
    where id = p_membership_id
      and user_id = p_user_id
      and revoked_at is null
      and password_change_required
      and password_change_operation_kind = 'regent'
      and password_change_retry_token_hash = p_operation_hash
      and password_change_candidate_fingerprint = p_candidate_fingerprint
      and password_change_operation_stage = 'candidate_verified'
  );
end;
$$;

create or replace function public.mark_choir_regent_password_operation_retryable(
  p_membership_id uuid,
  p_user_id uuid,
  p_operation_hash text,
  p_candidate_fingerprint text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  marked_id uuid;
begin
  update public.choir_regents
  set password_change_operation_stage = 'retryable'
  where id = p_membership_id
    and user_id = p_user_id
    and revoked_at is null
    and password_change_required
    and password_change_operation_kind = 'regent'
    and password_change_retry_token_hash = p_operation_hash
    and password_change_candidate_fingerprint = p_candidate_fingerprint
    and password_change_operation_stage = 'candidate_verified'
  returning id into marked_id;

  if marked_id is not null then
    return true;
  end if;

  return exists (
    select 1
    from public.choir_regents
    where id = p_membership_id
      and user_id = p_user_id
      and revoked_at is null
      and password_change_required
      and password_change_operation_kind = 'regent'
      and password_change_retry_token_hash = p_operation_hash
      and password_change_candidate_fingerprint = p_candidate_fingerprint
      and password_change_operation_stage = 'retryable'
  );
end;
$$;

create or replace function public.release_choir_regent_password_candidate_operation(
  p_membership_id uuid,
  p_user_id uuid,
  p_operation_hash text,
  p_expected_stage text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  released_id uuid;
begin
  if p_expected_stage not in ('claimed', 'candidate_verified') then
    return false;
  end if;

  update public.choir_regents
  set password_change_operation_kind = null,
      password_change_retry_token_hash = null,
      password_change_operation_previous_required = null,
      password_change_operation_stage = null,
      password_change_candidate_fingerprint = null
  where id = p_membership_id
    and user_id = p_user_id
    and revoked_at is null
    and password_change_required
    and password_change_operation_kind = 'regent'
    and password_change_retry_token_hash = p_operation_hash
    and password_change_operation_stage = p_expected_stage
  returning id into released_id;

  return released_id is not null;
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
      password_change_operation_previous_required = null,
      password_change_operation_stage = null,
      password_change_candidate_fingerprint = null
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
      password_change_operation_previous_required = null,
      password_change_operation_stage = null,
      password_change_candidate_fingerprint = null
  where id = p_membership_id
    and user_id = p_user_id
    and revoked_at is null
    and password_change_operation_kind = p_operation_kind
    and password_change_retry_token_hash = p_operation_hash
    and (
      (p_operation_kind = 'admin' and password_change_operation_stage = 'claimed')
      or (p_operation_kind = 'regent' and password_change_operation_stage = 'legacy')
    )
  returning id into released_id;

  return released_id is not null;
end;
$$;

revoke all on function public.claim_choir_regent_password_candidate_operation(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.verify_choir_regent_password_operation_candidate(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.mark_choir_regent_password_operation_retryable(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.release_choir_regent_password_candidate_operation(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.claim_choir_regent_password_operation(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.finish_choir_regent_password_operation(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.release_choir_regent_password_operation(uuid, uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.claim_choir_regent_password_candidate_operation(uuid, uuid, text, text)
  to service_role;
grant execute on function public.verify_choir_regent_password_operation_candidate(uuid, uuid, text, text)
  to service_role;
grant execute on function public.mark_choir_regent_password_operation_retryable(uuid, uuid, text, text)
  to service_role;
grant execute on function public.release_choir_regent_password_candidate_operation(uuid, uuid, text, text)
  to service_role;
grant execute on function public.claim_choir_regent_password_operation(uuid, uuid, text, text)
  to service_role;
grant execute on function public.finish_choir_regent_password_operation(uuid, uuid, text, text)
  to service_role;
grant execute on function public.release_choir_regent_password_operation(uuid, uuid, text, text)
  to service_role;
