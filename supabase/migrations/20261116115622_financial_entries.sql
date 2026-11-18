create table public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null check (entry_type in ('income', 'expense')),
  entry_date date not null,
  description text not null check (char_length(btrim(description)) between 3 and 180),
  responsible text not null check (char_length(btrim(responsible)) between 2 and 100),
  notes text not null default '' check (char_length(notes) <= 1000),
  amount_cents integer not null check (amount_cents between 1 and 100000000),
  attachment_path text unique,
  attachment_file_name text,
  attachment_mime_type text check (attachment_mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint financial_entries_attachment_metadata check (
    (attachment_path is null and attachment_file_name is null and attachment_mime_type is null)
    or (attachment_path is not null and attachment_file_name is not null and attachment_mime_type is not null)
  )
);

create index financial_entries_date_idx on public.financial_entries (entry_date desc, created_at desc);
alter table public.financial_entries enable row level security;
revoke all on public.financial_entries from anon, authenticated;
grant select, insert on public.financial_entries to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('financial-attachments', 'financial-attachments', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png']::text[])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Only server functions protected by requireAdmin use the service-role client.
-- No browser-facing table or Storage policy is granted.
