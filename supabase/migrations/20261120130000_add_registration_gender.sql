begin;

alter table public.registrations
  add column if not exists gender text not null default 'nao_informado'
  check (gender in ('masculino', 'feminino', 'nao_informado'));

comment on column public.registrations.gender is
  'Self-reported participant gender used by the administrative men/women chart; older registrations default to nao_informado.';

commit;
