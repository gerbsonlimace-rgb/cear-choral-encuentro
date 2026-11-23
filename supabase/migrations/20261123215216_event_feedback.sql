-- Anonymous evaluation is independent of registrations, Auth and financial state.
create table public.event_feedback (
  submission_id uuid primary key,
  created_at timestamptz not null default now(),
  overall smallint not null check (overall between 1 and 5),
  organization smallint check (organization between 1 and 5),
  formation smallint check (formation between 1 and 5),
  celebrations smallint check (celebrations between 1 and 5),
  fellowship smallint check (fellowship between 1 and 5),
  venue smallint check (venue between 1 and 5),
  food smallint check (food between 1 and 5),
  lodging smallint check (lodging between 1 and 5),
  transport smallint check (transport between 1 and 5),
  contribution smallint not null check (contribution between 1 and 4),
  return_intent text not null check (return_intent in ('yes', 'maybe', 'no')),
  suggestion text not null default '' check (char_length(suggestion) <= 1000)
);
comment on table public.event_feedback is 'Anonymous event evaluation. NULL aspect ratings explicitly mean not participated / not used. No registration or Auth identifiers.';
alter table public.event_feedback enable row level security;
revoke all on table public.event_feedback from public, anon, authenticated;
grant select, insert, update on table public.event_feedback to service_role;
