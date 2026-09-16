begin;

alter table public.registrations
  add column other_choir_name text;

alter table public.registrations
  add constraint registrations_other_choir_name_check
    check (
      other_choir_name is null
      or char_length(btrim(other_choir_name)) between 2 and 120
    ) not valid,
  add constraint registrations_choir_source_check
    check (
      (
        choir_id is null
        and other_choir_name is null
        and pricing_type is null
      )
      or (
        choir_id is not null
        and other_choir_name is null
      )
      or (
        choir_id is null
        and other_choir_name is not null
      )
    ) not valid;

alter table public.registrations
  drop constraint if exists registrations_pricing_snapshot_check;

alter table public.registrations
  add constraint registrations_pricing_snapshot_check
    check (
      (
        choir_id is null
        and other_choir_name is null
        and pricing_type is null
        and standard_price_cents is null
        and registration_price_cents is null
        and shirt_price_cents is null
      )
      or
      (
        (
          (choir_id is not null and other_choir_name is null)
          or
          (choir_id is null and other_choir_name is not null)
        )
        and pricing_type is not null
        and standard_price_cents is not null
        and registration_price_cents is not null
        and (
          (pricing_type = 'standard' and registration_price_cents = standard_price_cents)
          or
          (pricing_type = 'promotional' and registration_price_cents < standard_price_cents)
        )
      )
    ) not valid;

alter table public.registrations
  validate constraint registrations_other_choir_name_check;

alter table public.registrations
  validate constraint registrations_choir_source_check;

alter table public.registrations
  validate constraint registrations_pricing_snapshot_check;

commit;
