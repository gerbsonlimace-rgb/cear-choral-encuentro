alter table public.choirs
  add column diocese text;

update public.choirs
set diocese = case
  when translate(lower(name), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc') like '%fortaleza%'
    then 'Arquidiocese de Fortaleza'
  when translate(lower(name), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc') like '%baturite%'
    then 'Diocese de Baturité'
  when lower(name) like '%crato%'
    then 'Diocese do Crato'
  when translate(lower(name), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc') like '%crateus%'
    then 'Diocese de Crateús'
  when lower(name) like '%iguatu%'
    then 'Diocese de Iguatu'
  when lower(name) like '%itapipoca%'
    then 'Diocese de Itapipoca'
  when lower(name) like '%limoeiro do norte%'
    then 'Diocese de Limoeiro do Norte'
  when translate(lower(name), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc') like '%quixada%'
    then 'Diocese de Quixadá'
  when lower(name) like '%sobral%'
    then 'Diocese de Sobral'
  when translate(lower(name), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc') like '%tiangua%'
    then 'Diocese de Tianguá'
  else null
end
where diocese is null;

alter table public.choirs
  add constraint choirs_diocese_check
  check (
    diocese is null
    or diocese in (
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
    )
  );

comment on column public.choirs.diocese is
  'Diocese oficial selecionada no cadastro administrativo; null identifica apenas registros legados ainda não classificados.';
