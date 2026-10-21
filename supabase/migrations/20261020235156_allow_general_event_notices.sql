-- General notices are independent of CoroApp events and are visible to all
-- participants with portal access. Event-specific notices keep their checks.
alter table public.event_notices alter column event_id drop not null;

comment on column public.event_notices.event_id is
  'NULL for a general notice visible to all authorized participants; otherwise the configured CoroApp event UUID.';

comment on table public.event_notices is
  'Notices managed through requireAdmin and read through requireParticipantAccess. Event-specific notices require a configured, published CoroApp event.';
