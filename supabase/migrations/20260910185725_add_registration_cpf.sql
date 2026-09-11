alter table public.registrations
  add column cpf text,
  add constraint registrations_cpf_digits_check
    check (cpf is null or cpf ~ '^[0-9]{11}$');

create unique index registrations_cpf_uidx
  on public.registrations (cpf)
  where cpf is not null;
