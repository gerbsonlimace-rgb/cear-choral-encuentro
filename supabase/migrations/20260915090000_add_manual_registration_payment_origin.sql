-- Keep administrative payment confirmations separate from provider transactions.
alter table public.registrations
  add column if not exists payment_origin text not null default 'infinitepay',
  add column if not exists manual_paid_by uuid;

alter table public.registrations
  drop constraint if exists registrations_payment_origin_check,
  drop constraint if exists registrations_paid_details_check;

alter table public.registrations
  add constraint registrations_payment_origin_check
    check (payment_origin in ('infinitepay', 'manual')),
  add constraint registrations_paid_details_check
    check (
      payment_status <> 'paid'
      or (
        payment_origin = 'manual'
        and manual_paid_by is not null
        and infinitepay_transaction_nsu is null
        and payment_method is null
        and installments is null
        and receipt_url is null
        and paid_amount_cents is not null
        and paid_amount_cents >= amount_cents
        and paid_at is not null
      )
      or (
        payment_origin = 'infinitepay'
        and infinitepay_transaction_nsu is not null
        and payment_method is not null
        and installments is not null
        and paid_amount_cents is not null
        and paid_amount_cents >= amount_cents
        and paid_at is not null
      )
    );

-- Existing paid rows came from the provider flow.
update public.registrations
set payment_origin = 'infinitepay'
where payment_origin is null;
