alter table public.registrations
  add column include_shirt boolean not null default false,
  add column shirt_size text,
  add column amount_cents integer,
  add column payment_status text,
  add column order_nsu uuid,
  add column checkout_url text,
  add column infinitepay_invoice_slug text,
  add column infinitepay_transaction_nsu text,
  add column payment_method text,
  add column installments integer,
  add column paid_amount_cents integer,
  add column receipt_url text,
  add column paid_at timestamptz;

update public.registrations
set payment_status = 'legacy'
where payment_status is null;

alter table public.registrations
  alter column payment_status set not null,
  alter column payment_status set default 'pending';

alter table public.registrations
  drop constraint if exists registrations_role_check;

alter table public.registrations
  add constraint registrations_role_check
    check (role in (
      'participant', 'listener', 'musician', 'choir_member',
      'singer', 'conductor', 'liturgist', 'priest', 'other'
    )),
  add constraint registrations_shirt_selection_check
    check (
      (include_shirt and shirt_size is not null and shirt_size in ('P', 'M', 'G', 'GG', 'XG'))
      or (not include_shirt and shirt_size is null)
    ),
  add constraint registrations_amount_check
    check (amount_cents is null or amount_cents > 0),
  add constraint registrations_payment_status_check
    check (payment_status in ('legacy', 'pending', 'paid')),
  add constraint registrations_order_required_check
    check (
      (payment_status = 'legacy' and order_nsu is null and amount_cents is null)
      or (
        payment_status in ('pending', 'paid')
        and order_nsu is not null
        and amount_cents is not null
        and amount_cents > 0
      )
    ),
  add constraint registrations_payment_method_check
    check (payment_method is null or payment_method in ('pix', 'credit_card')),
  add constraint registrations_installments_check
    check (installments is null or installments > 0),
  add constraint registrations_paid_amount_check
    check (paid_amount_cents is null or paid_amount_cents > 0),
  add constraint registrations_paid_details_check
    check (
      payment_status <> 'paid'
      or (
        infinitepay_transaction_nsu is not null
        and payment_method is not null
        and installments is not null
        and paid_amount_cents is not null
        and paid_amount_cents >= amount_cents
        and paid_at is not null
      )
    );

create unique index registrations_order_nsu_uidx
  on public.registrations (order_nsu)
  where order_nsu is not null;

create unique index registrations_infinitepay_transaction_nsu_uidx
  on public.registrations (infinitepay_transaction_nsu)
  where infinitepay_transaction_nsu is not null;

alter table public.registrations
  add column birth_date date,
  add column diocese text,
  alter column email drop not null,
  alter column city drop not null,
  alter column role drop not null;

delete from public.registrations;

alter table public.registrations
  alter column birth_date set not null,
  alter column diocese set not null,
  add constraint registrations_diocese_check
    check (diocese in (
      'Arquidiocese de Fortaleza',
      'Diocese do Crato',
      'Diocese de Crateús',
      'Diocese de Iguatu',
      'Diocese de Itapipoca',
      'Diocese de Limoeiro do Norte',
      'Diocese de Quixadá',
      'Diocese de Sobral',
      'Diocese de Tianguá'
    ));

revoke all on public.registrations from anon, authenticated;
revoke all on public.registrations from service_role;
grant select, insert, update on public.registrations to service_role;