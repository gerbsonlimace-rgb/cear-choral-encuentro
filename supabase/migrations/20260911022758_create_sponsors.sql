create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_path text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sponsors_name_check
    check (name = btrim(name) and char_length(name) between 2 and 120),
  constraint sponsors_logo_path_check
    check (logo_path ~ '^[0-9a-f-]{36}\.(png|jpg|webp)$'),
  constraint sponsors_logo_path_unique unique (logo_path)
);

create unique index sponsors_normalized_name_uidx
  on public.sponsors (lower(btrim(name)));

alter table public.sponsors enable row level security;

revoke all on public.sponsors from anon, authenticated, service_role;
grant select, insert, update on public.sponsors to service_role;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'sponsor-logos',
  'sponsor-logos',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
