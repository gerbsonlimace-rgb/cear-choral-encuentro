alter table public.registrations
  add column cpf text,
  add constraint registrations_cpf_digits_check
    check (cpf is null or cpf ~ '^[0-9]{11}$');
