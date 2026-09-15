create table public.coroapp_event_sources (
  event_id uuid primary key,
  public_url text not null unique
    constraint coroapp_event_sources_public_url_check
    check (public_url = btrim(public_url) and public_url ~ '^https://[^/]+/e/[0-9a-fA-F-]{36}$'),
  event_name text not null
    constraint coroapp_event_sources_event_name_check
    check (event_name = btrim(event_name) and char_length(event_name) between 1 and 200),
  sort_order integer not null unique
    constraint coroapp_event_sources_sort_order_check check (sort_order >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.coroapp_event_sources enable row level security;
revoke all on table public.coroapp_event_sources from public, anon, authenticated;
revoke all on table public.coroapp_event_sources from service_role;
grant select, insert, update, delete on table public.coroapp_event_sources to service_role;

create or replace function public.replace_coroapp_event_sources(
  p_admin_user_id uuid,
  p_sources jsonb
)
returns setof public.coroapp_event_sources
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.admin_users where user_id = p_admin_user_id and revoked_at is null
  ) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if jsonb_typeof(p_sources) <> 'array' or jsonb_array_length(p_sources) = 0 then
    raise exception 'COROAPP_EVENT_SOURCES_REQUIRED';
  end if;

  delete from public.coroapp_event_sources;

  insert into public.coroapp_event_sources (
    event_id,
    public_url,
    event_name,
    sort_order,
    updated_by,
    updated_at
  )
  select
    source.event_id,
    source.public_url,
    source.event_name,
    source.sort_order,
    p_admin_user_id,
    now()
  from jsonb_to_recordset(p_sources) as source(
    event_id uuid,
    public_url text,
    event_name text,
    sort_order integer
  );

  return query
    select configured.*
    from public.coroapp_event_sources configured
    order by configured.sort_order;
end;
$$;

revoke all on function public.replace_coroapp_event_sources(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_coroapp_event_sources(uuid, jsonb) to service_role;

insert into public.coroapp_event_sources (event_id, public_url, event_name, sort_order)
values
  (
    'cc123321-60f2-4993-9dd2-deac898e9d1c',
    'https://coroapp.lovable.app/e/cc123321-60f2-4993-9dd2-deac898e9d1c',
    'Grande Concerto',
    0
  ),
  (
    '5eeb5e38-f3ce-428f-9f68-3af62ae539aa',
    'https://coroapp.lovable.app/e/5eeb5e38-f3ce-428f-9f68-3af62ae539aa',
    'Missa do Sábado - Apresentação da Bem Aventurada Virgem Maria (Memória)',
    1
  ),
  (
    '5c8288c7-17a3-42e6-8749-5cd6e6710c93',
    'https://coroapp.lovable.app/e/5c8288c7-17a3-42e6-8749-5cd6e6710c93',
    'SOLENIDADE DE NOSSO SENHOR JESUS CRISTO REI DO UNIVERSO',
    2
  );
