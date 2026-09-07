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
