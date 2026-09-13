do $$
begin
  if exists (
    select lower(btrim(email))
    from public.registrations
    where email is not null
    group by lower(btrim(email))
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'Cannot enforce unique registration email: duplicate normalized email values exist.';
  end if;
end
$$;

create unique index if not exists registrations_email_normalized_uidx
  on public.registrations (lower(btrim(email)))
  where email is not null;
