create table public.event_documents (
  id uuid primary key default gen_random_uuid(),
  -- The CoroApp source replacement function deliberately deletes and reinserts its rows.
  -- Keep the official UUID without a foreign key and validate current membership server-side,
  -- otherwise a harmless source reorder would either delete documents or be blocked.
  event_id uuid not null,
  title text not null
    constraint event_documents_title_check
    check (title = btrim(title) and char_length(title) between 2 and 160),
  category text not null
    constraint event_documents_category_check
    check (category = btrim(category) and char_length(category) between 2 and 60),
  storage_path text not null unique
    constraint event_documents_storage_path_check
    check (
      storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$'
    ),
  original_file_name text not null
    constraint event_documents_original_file_name_check
    check (
      original_file_name = btrim(original_file_name)
      and char_length(original_file_name) between 5 and 180
      and original_file_name ~* '\.pdf$'
      and original_file_name !~ '[\\/]'
      and original_file_name !~ '[[:cntrl:]]'
    ),
  mime_type text not null default 'application/pdf'
    constraint event_documents_mime_type_check check (mime_type = 'application/pdf'),
  size_bytes integer not null
    constraint event_documents_size_bytes_check check (size_bytes between 1 and 10485760),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index event_documents_event_id_idx
  on public.event_documents (event_id, created_at desc);
create index event_documents_category_idx
  on public.event_documents (category);
create index event_documents_created_by_idx
  on public.event_documents (created_by)
  where created_by is not null;
create index event_documents_updated_by_idx
  on public.event_documents (updated_by)
  where updated_by is not null;

alter table public.event_documents enable row level security;
revoke all on table public.event_documents from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.event_documents to service_role;

comment on table public.event_documents is
  'Private event-level PDFs managed by Encontro administrators and delivered through short server-signed URLs.';
comment on column public.event_documents.event_id is
  'Official CoroApp event UUID; current publication is revalidated by trusted server code on every participant read.';

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'event-documents',
  'event-documents',
  false,
  10485760,
  array['application/pdf']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- There are intentionally no anon/authenticated policies for this bucket.
-- Upload, replacement, deletion, listing and signed URL creation happen only through
-- server functions that authorize requireAdmin or requireParticipantAccess first.
