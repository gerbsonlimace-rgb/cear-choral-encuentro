-- Identifiers are kept separate from opinions: no response UUID or timestamp in the control ledger.
create schema if not exists private;
create table private.event_feedback_identity_secret (
  singleton boolean primary key default true check (singleton),
  secret text not null
);
insert into private.event_feedback_identity_secret (secret)
values (gen_random_uuid()::text || gen_random_uuid()::text);
create table private.event_feedback_identity_keys (
  identity_key text primary key check (identity_key ~ '^[0-9a-f]{64}$')
);
alter table private.event_feedback_identity_secret enable row level security;
alter table private.event_feedback_identity_keys enable row level security;
revoke all on private.event_feedback_identity_secret, private.event_feedback_identity_keys
from public, anon, authenticated, service_role;

create function public.save_anonymous_event_feedback(p_identity text, p_feedback jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := (p_feedback->>'submission_id')::uuid;
  v_key text;
  v_inserted integer;
begin
  if p_identity is null or length(p_identity) > 260
    or not (p_identity ~ '^cpf:[0-9]{11}$' or p_identity ~ '^email:[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
  then
    raise exception 'invalid_feedback_identity';
  end if;
  -- Serialize retries of the same random receipt, independent of the control ledger.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_id::text, 0));
  if not exists(select 1 from public.event_feedback where submission_id = v_id) then
    -- The permanent random secret prevents dictionary lookup of CPF/email hashes.
    select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_identity || ':' || secret, 'UTF8')), 'hex')
    into v_key from private.event_feedback_identity_secret where singleton;
    insert into private.event_feedback_identity_keys(identity_key) values(v_key)
    on conflict do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 0 then
      raise exception 'feedback_already_sent';
    end if;
  end if;
  -- Validation failures roll back the control entry in the same transaction.
  insert into public.event_feedback
    (submission_id, overall, organization, formation, celebrations, venue, food, lodging, suggestion)
  values
    (v_id, (p_feedback->>'overall')::smallint, (p_feedback->>'organization')::smallint,
     (p_feedback->>'formation')::smallint, (p_feedback->>'celebrations')::smallint,
     (p_feedback->>'venue')::smallint, (p_feedback->>'food')::smallint,
     (p_feedback->>'lodging')::smallint, coalesce(p_feedback->>'suggestion', ''))
  on conflict(submission_id) do update set
    overall=excluded.overall, organization=excluded.organization, formation=excluded.formation,
    celebrations=excluded.celebrations, venue=excluded.venue, food=excluded.food,
    lodging=excluded.lodging, suggestion=excluded.suggestion;
end;
$$;
revoke all on function public.save_anonymous_event_feedback(text,jsonb) from public, anon, authenticated;
grant execute on function public.save_anonymous_event_feedback(text,jsonb) to service_role;
