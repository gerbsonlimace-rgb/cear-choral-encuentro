alter table public.registrations
  add column if not exists badge_name text;

alter table public.registrations
  add constraint registrations_badge_name_check
  check (badge_name is null or (badge_name = btrim(badge_name) and char_length(badge_name) between 2 and 60));

comment on column public.registrations.badge_name is
  'Short participant name printed on the event badge; the name column remains the certificate name.';
