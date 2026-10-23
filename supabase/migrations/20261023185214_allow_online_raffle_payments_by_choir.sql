-- Each choir opts in to participant raffle checkouts independently.
alter table public.choirs
  add column raffle_online_payments_enabled boolean not null default false;

-- Server authorization is repeated in the database at reservation time.
-- Existing checkouts may still settle after a choir disables new checkouts.
create function public.require_online_raffle_payment_enabled()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.initiated_as = 'participant' and not coalesce((
    select choir.raffle_online_payments_enabled
    from public.choirs as choir
    where choir.id = new.choir_id
  ), false) then
    raise exception 'Online raffle payments are disabled for this choir' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.require_online_raffle_payment_enabled()
  from public, anon, authenticated;

create trigger require_online_raffle_payment_enabled_before_insert
before insert on public.registration_complement_payments
for each row execute function public.require_online_raffle_payment_enabled();
