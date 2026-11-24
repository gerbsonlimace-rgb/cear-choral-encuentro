alter table public.event_feedback
  add column criterion_comments jsonb not null default '{}'::jsonb
  check (
    jsonb_typeof(criterion_comments) = 'object'
    and criterion_comments - array['organization', 'formation', 'celebrations', 'venue', 'food', 'lodging'] = '{}'::jsonb
    and (criterion_comments->'organization' is null or jsonb_typeof(criterion_comments->'organization') = 'string')
    and (criterion_comments->'formation' is null or jsonb_typeof(criterion_comments->'formation') = 'string')
    and (criterion_comments->'celebrations' is null or jsonb_typeof(criterion_comments->'celebrations') = 'string')
    and (criterion_comments->'venue' is null or jsonb_typeof(criterion_comments->'venue') = 'string')
    and (criterion_comments->'food' is null or jsonb_typeof(criterion_comments->'food') = 'string')
    and (criterion_comments->'lodging' is null or jsonb_typeof(criterion_comments->'lodging') = 'string')
    and char_length(coalesce(criterion_comments->>'organization', '')) <= 500
    and char_length(coalesce(criterion_comments->>'formation', '')) <= 500
    and char_length(coalesce(criterion_comments->>'celebrations', '')) <= 500
    and char_length(coalesce(criterion_comments->>'venue', '')) <= 500
    and char_length(coalesce(criterion_comments->>'food', '')) <= 500
    and char_length(coalesce(criterion_comments->>'lodging', '')) <= 500
  );

create or replace function public.save_registered_event_feedback(p_token_hash text,p_feedback jsonb) returns void
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
  insert into public.event_feedback(submission_id,overall,organization,formation,celebrations,venue,food,lodging,criterion_comments,suggestion)
  values(v_id,(p_feedback->>'overall')::smallint,(p_feedback->>'organization')::smallint,
    (p_feedback->>'formation')::smallint,(p_feedback->>'celebrations')::smallint,
    (p_feedback->>'venue')::smallint,(p_feedback->>'food')::smallint,(p_feedback->>'lodging')::smallint,
    coalesce(p_feedback->'criterion_comments','{}'::jsonb),coalesce(p_feedback->>'suggestion',''))
  on conflict(submission_id) do update set overall=excluded.overall,organization=excluded.organization,
    formation=excluded.formation,celebrations=excluded.celebrations,venue=excluded.venue,
    food=excluded.food,lodging=excluded.lodging,criterion_comments=excluded.criterion_comments,
    suggestion=excluded.suggestion;
  update private.event_feedback_participation set responded_at=coalesce(responded_at,now()),receipt_hash=v_receipt where registration_id=v_registration;
end;
$$;

revoke all on function public.save_registered_event_feedback(text,jsonb) from public,anon,authenticated;
grant execute on function public.save_registered_event_feedback(text,jsonb) to service_role;
