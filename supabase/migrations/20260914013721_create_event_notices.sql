create table public.event_notices (
  id uuid primary key default gen_random_uuid(),
  -- Source configuration deletes and reinserts rows on reorder. Validate membership
  -- in trusted server code instead of cascading notice deletion from a foreign key.
  event_id uuid not null,
  title text not null check (title = btrim(title) and char_length(title) between 2 and 160),
  body text not null check (body = btrim(body) and char_length(body) between 1 and 5000),
  is_published boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index event_notices_published_event_idx
  on public.event_notices (event_id, created_at desc) where is_published;
create index event_notices_created_by_idx
  on public.event_notices (created_by) where created_by is not null;
create index event_notices_updated_by_idx
  on public.event_notices (updated_by) where updated_by is not null;

alter table public.event_notices enable row level security;
revoke all on table public.event_notices from public, anon, authenticated, service_role;
grant select, insert, update on table public.event_notices to service_role;

comment on table public.event_notices is
  'Event notices managed through requireAdmin; published notices read only through requireParticipantAccess for configured and published events.';
