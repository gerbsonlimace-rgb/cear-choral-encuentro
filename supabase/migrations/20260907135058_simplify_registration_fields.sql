alter table public.registrations
  add column birth_date date,
  add column diocese text,
  alter column email drop not null,
  alter column city drop not null,
  alter column role drop not null;

alter table public.registrations
  add constraint registrations_diocese_check
    check (
      diocese is null
      or diocese in (
        'Arquidiocese de Fortaleza',
        'Diocese do Crato',
        'Diocese de Crateús',
        'Diocese de Iguatu',
        'Diocese de Itapipoca',
        'Diocese de Limoeiro do Norte',
        'Diocese de Quixadá',
        'Diocese de Sobral',
        'Diocese de Tianguá'
      )
    ),
  add constraint registrations_new_fields_required_check
    check (
      payment_status not in ('pending', 'paid')
      or (birth_date is not null and diocese is not null)
      or (
        birth_date is null
        and diocese is null
        and created_at < timestamptz '2026-09-07 13:50:58+00'
      )
    );

revoke all on public.registrations from anon, authenticated;
revoke all on public.registrations from service_role;
grant select, insert, update on public.registrations to service_role;
