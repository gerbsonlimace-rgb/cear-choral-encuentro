-- Keep the participant's diocese independent from the configured choir name.
alter table public.registrations
  drop constraint if exists registrations_choir_names_match_check;

drop trigger if exists sync_registration_choir_names_before_write on public.registrations;
drop function if exists public.sync_registration_choir_names();

alter table public.registrations
  drop constraint if exists registrations_diocese_check;

alter table public.registrations
  add constraint registrations_diocese_check
  check (diocese in (
    'Arquidiocese de Fortaleza',
    'Diocese de Baturité',
    'Diocese do Crato',
    'Diocese de Crateús',
    'Diocese de Iguatu',
    'Diocese de Itapipoca',
    'Diocese de Limoeiro do Norte',
    'Diocese de Quixadá',
    'Diocese de Sobral',
    'Diocese de Tianguá'
  )) not valid;
