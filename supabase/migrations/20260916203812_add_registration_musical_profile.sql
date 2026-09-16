begin;

alter table public.registrations
  add column if not exists musical_profile text;

alter table public.registrations
  drop constraint if exists registrations_musical_profile_check;

alter table public.registrations
  add constraint registrations_musical_profile_check
    check (
      musical_profile is null
      or musical_profile in ('regente', 'instrumentista', 'coralista')
    );

comment on column public.registrations.musical_profile is
  'Participant musical profile selected during registration.';

commit;
