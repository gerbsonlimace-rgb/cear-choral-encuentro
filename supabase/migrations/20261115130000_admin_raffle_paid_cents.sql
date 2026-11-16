begin;

alter table public.registrations
  add column if not exists admin_raffle_paid_cents integer;

alter table public.registrations
  add constraint registrations_admin_raffle_paid_check
    check (admin_raffle_paid_cents is null or admin_raffle_paid_cents >= 0);

comment on column public.registrations.admin_raffle_paid_cents is
  'Valor de rifas recebido manualmente pela administração. Contabilidade administrativa separada dos complements de rifa e do estado financeiro compartilhado.';

commit;
