begin;

alter table public.registrations
  add column if not exists admin_registration_original_price_cents integer,
  add column if not exists admin_payment_reason text;

update public.registrations
set admin_registration_original_price_cents = case
  when payment_origin = 'exemption' and is_free_registration then 0
  when payment_origin = 'exemption' then null
  when payment_origin = 'manual' then coalesce(registration_price_cents, amount_cents, 0)
    + coalesce(manual_fee_pending_cents, 0)
    + coalesce(manual_discount_cents, 0)
  else coalesce(registration_price_cents, amount_cents, 0)
end
where admin_registration_original_price_cents is null;

alter table public.registrations
  add constraint registrations_admin_original_price_check
    check (admin_registration_original_price_cents is null or admin_registration_original_price_cents >= 0),
  add constraint registrations_admin_payment_reason_check
    check (admin_payment_reason is null or char_length(btrim(admin_payment_reason)) <= 500);

alter table public.registrations
  drop constraint if exists registrations_pricing_snapshot_check,
  drop constraint if exists registrations_shirt_price_snapshot_check,
  drop constraint if exists registrations_remaining_price_check,
  drop constraint if exists registrations_manual_paid_receipt_required_check;

alter table public.registrations
  add constraint registrations_pricing_snapshot_check
    check (
      (
        payment_origin = 'exemption'
        and admin_registration_original_price_cents is null
        and standard_price_cents = 0
        and registration_price_cents = 0
        and shirt_price_cents = 0
      )
      or (
        payment_origin = 'exemption'
        and admin_registration_original_price_cents is not null
        and registration_price_cents = 0
        and standard_price_cents is not null
        and standard_price_cents >= 0
        and (
          pricing_type = 'standard'
          or (pricing_type = 'promotional' and standard_price_cents > 0)
          or (pricing_type = 'promotional' and standard_price_cents = 0
            and admin_registration_original_price_cents is not null)
        )
      )
      or (
        payment_origin = 'exemption'
        and admin_registration_original_price_cents is not null
        and pricing_type is null
        and registration_price_cents = 0
        and standard_price_cents = 0
      )
      or (
        choir_id is null
        and other_choir_name is null
        and pricing_type is null
        and standard_price_cents is null
        and registration_price_cents is null
        and shirt_price_cents is null
      )
      or (
        (
          (choir_id is not null and other_choir_name is null)
          or (choir_id is null and other_choir_name is not null)
        )
        and pricing_type is not null
        and standard_price_cents is not null
        and registration_price_cents is not null
        and (
          (pricing_type = 'standard' and registration_price_cents = standard_price_cents)
          or (
            pricing_type = 'promotional'
            and (
              registration_price_cents < standard_price_cents
              or (payment_origin = 'manual' and admin_registration_original_price_cents is not null
                and registration_price_cents = standard_price_cents)
            )
          )
        )
      )
    ),
  add constraint registrations_shirt_price_snapshot_check
    check (
      (payment_origin = 'exemption' and admin_registration_original_price_cents is null)
      or pricing_type is null
      or (include_shirt and shirt_price_cents is not null)
      or (not include_shirt and shirt_price_cents is null)
    ),
  add constraint registrations_remaining_price_check
    check (
      remaining_price_cents is null
      or (payment_origin = 'exemption' and remaining_price_cents = 0)
      or (payment_origin = 'exemption' and admin_registration_original_price_cents is not null and remaining_price_cents >= 0)
      or (pricing_type = 'promotional' and remaining_price_cents >= 0)
    );

comment on column public.registrations.admin_registration_original_price_cents is
  'Valor original da taxa preservado para a contabilidade administrativa de pagamentos e isenções.';
comment on column public.registrations.admin_payment_reason is
  'Justificativa opcional registrada pela administração ao configurar o pagamento da inscrição.';

commit;
