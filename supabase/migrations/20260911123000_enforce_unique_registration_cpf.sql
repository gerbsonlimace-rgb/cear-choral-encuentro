do $$
begin
  if exists (
    select cpf
    from public.registrations
    where cpf is not null
    group by cpf
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'Cannot enforce unique registration CPF: duplicate non-null CPF values exist.';
  end if;
end
$$;

create unique index registrations_cpf_uidx
  on public.registrations (cpf)
  where cpf is not null;
