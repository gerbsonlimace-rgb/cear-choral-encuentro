alter table public.registrations
  add column if not exists cpf text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'registrations_cpf_digits_check'
      and conrelid = 'public.registrations'::regclass
  ) then
    alter table public.registrations
      add constraint registrations_cpf_digits_check
        check (cpf is null or cpf ~ '^[0-9]{11}$');
  end if;
end
$$;

create unique index if not exists registrations_cpf_uidx
  on public.registrations (cpf)
  where cpf is not null;
