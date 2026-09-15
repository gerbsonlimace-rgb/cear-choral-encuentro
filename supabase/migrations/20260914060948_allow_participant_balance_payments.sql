-- Reuse the existing balance ledger, locking and unique open-payment index.
-- No new browser grants: payments remain accessible only through server authorization.
alter table public.registration_complement_payments
  drop constraint registration_complement_payments_initiated_as_check;
alter table public.registration_complement_payments
  add constraint registration_complement_payments_initiated_as_check
  check (initiated_as in ('regent', 'admin', 'participant'));

create function public.validate_participant_balance_payment_actor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.initiated_as = 'participant' and not exists (
    select 1 from public.participant_accounts as account
    where account.registration_id = new.registration_id
      and account.user_id = new.initiated_by
      and account.access_status = 'active'
  ) then
    raise exception 'Participant cannot pay another registration' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_participant_balance_payment_actor()
  from public, anon, authenticated;

create trigger validate_participant_balance_payment_actor_before_insert
before insert on public.registration_complement_payments
for each row execute function public.validate_participant_balance_payment_actor();
