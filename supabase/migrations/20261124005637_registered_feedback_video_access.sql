create schema if not exists private;
create table private.event_feedback_participation (
  registration_id uuid primary key references public.registrations(id) on delete cascade,
  receipt_hash text,
  responded_at timestamptz,
  video_opened_at timestamptz,
  video_claim_hash text
);
create table private.event_feedback_sessions (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  expires_at timestamptz not null
);
create index event_feedback_sessions_expiration on private.event_feedback_sessions(expires_at);
alter table private.event_feedback_participation enable row level security;
alter table private.event_feedback_sessions enable row level security;
revoke all on private.event_feedback_participation,private.event_feedback_sessions from public,anon,authenticated,service_role;

create function private.feedback_session_registration(p_token_hash text) returns uuid
language sql stable security definer set search_path='' as $$
  select s.registration_id from private.event_feedback_sessions s
  join public.registrations r on r.id=s.registration_id
  where s.token_hash=p_token_hash and s.expires_at>now() and r.cancelled_at is null
$$;
revoke all on function private.feedback_session_registration(text) from public,anon,authenticated,service_role;

create function public.registered_feedback_status(p_token_hash text,p_claim_id uuid default null)
returns table(responded boolean,video_available boolean)
language sql stable security definer set search_path='' as $$
  select p.responded_at is not null,(p.video_opened_at is null or (p_claim_id is not null and p.video_claim_hash=encode(sha256(convert_to(p_claim_id::text,'UTF8')),'hex')))
  from private.event_feedback_participation p
  where p.registration_id=private.feedback_session_registration(p_token_hash)
$$;

create function public.prepare_registered_event_feedback(p_identity text,p_token_hash text)
returns table(responded boolean,video_available boolean)
language plpgsql security definer set search_path='' as $$
declare v_ids uuid[]; v_id uuid;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'feedback_access_expired'; end if;
  select array_agg(candidate.id) into v_ids from (
    select r.id from public.registrations r
    where r.cancelled_at is null and regexp_replace(coalesce(r.cpf,''),'\D','','g') ~ '^[0-9]{11}$'
      and ((p_identity like 'cpf:%' and regexp_replace(r.cpf,'\D','','g')=substring(p_identity from 5))
        or (p_identity like 'email:%' and lower(trim(r.email))=lower(substring(p_identity from 7))))
    limit 2
  ) candidate;
  if coalesce(cardinality(v_ids),0)=0 then raise exception 'feedback_registration_not_found'; end if;
  if cardinality(v_ids)>1 then raise exception 'feedback_use_cpf'; end if;
  v_id:=v_ids[1];
  insert into private.event_feedback_participation(registration_id) values(v_id) on conflict do nothing;
  insert into private.event_feedback_sessions(token_hash,registration_id,expires_at)
  values(p_token_hash,v_id,now()+interval '6 hours');
  return query select * from public.registered_feedback_status(p_token_hash);
end;
$$;

create function public.save_registered_event_feedback(p_token_hash text,p_feedback jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare v_registration uuid; v_id uuid:=(p_feedback->>'submission_id')::uuid;
  v_receipt text; v_control private.event_feedback_participation%rowtype;
begin
  v_registration:=private.feedback_session_registration(p_token_hash);
  if v_registration is null then raise exception 'feedback_access_expired'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_id::text,0));
  select * into v_control from private.event_feedback_participation where registration_id=v_registration for update;
  v_receipt:=encode(sha256(convert_to(v_id::text,'UTF8')),'hex');
  if v_control.responded_at is not null and v_control.receipt_hash is distinct from v_receipt then raise exception 'feedback_already_sent'; end if;
  if v_control.responded_at is null and exists(select 1 from public.event_feedback where submission_id=v_id) then raise exception 'feedback_invalid_receipt'; end if;
  insert into public.event_feedback(submission_id,overall,organization,formation,celebrations,venue,food,lodging,suggestion)
  values(v_id,(p_feedback->>'overall')::smallint,(p_feedback->>'organization')::smallint,
    (p_feedback->>'formation')::smallint,(p_feedback->>'celebrations')::smallint,
    (p_feedback->>'venue')::smallint,(p_feedback->>'food')::smallint,(p_feedback->>'lodging')::smallint,coalesce(p_feedback->>'suggestion',''))
  on conflict(submission_id) do update set overall=excluded.overall,organization=excluded.organization,
    formation=excluded.formation,celebrations=excluded.celebrations,venue=excluded.venue,
    food=excluded.food,lodging=excluded.lodging,suggestion=excluded.suggestion;
  update private.event_feedback_participation set responded_at=coalesce(responded_at,now()),receipt_hash=v_receipt where registration_id=v_registration;
end;
$$;

create function public.claim_registered_feedback_video(p_token_hash text,p_claim_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_registration uuid; v_control private.event_feedback_participation%rowtype; v_claim text;
begin
  v_registration:=private.feedback_session_registration(p_token_hash);
  if v_registration is null then raise exception 'feedback_access_expired'; end if;
  if p_claim_id is null then return false; end if;
  select * into v_control from private.event_feedback_participation where registration_id=v_registration for update;
  if v_control.responded_at is null then return false; end if;
  v_claim:=encode(sha256(convert_to(p_claim_id::text,'UTF8')),'hex');
  if v_control.video_opened_at is not null then return v_control.video_claim_hash=v_claim; end if;
  update private.event_feedback_participation set video_opened_at=now(),video_claim_hash=v_claim where registration_id=v_registration;
  return true;
end;
$$;

revoke all on function public.prepare_registered_event_feedback(text,text),public.registered_feedback_status(text,uuid),public.save_registered_event_feedback(text,jsonb),public.claim_registered_feedback_video(text,uuid) from public,anon,authenticated;
grant execute on function public.prepare_registered_event_feedback(text,text),public.registered_feedback_status(text,uuid),public.save_registered_event_feedback(text,jsonb),public.claim_registered_feedback_video(text,uuid) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('event-feedback-videos','event-feedback-videos',false,10485760,array['video/mp4']) on conflict(id) do nothing;
