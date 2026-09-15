-- General documents are independent of CoroApp events. Existing event-specific
-- documents retain their publication checks and their original Storage paths.
alter table public.event_documents alter column event_id drop not null;
alter table public.event_documents alter column category set default 'Documentos';

alter table public.event_documents
  drop constraint event_documents_storage_path_check,
  add constraint event_documents_storage_path_check check (
    storage_path ~ '^(general|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$'
  );

comment on column public.event_documents.event_id is
  'NULL for general participant documents. Legacy event documents require current CoroApp publication, checked server-side.';

comment on table public.event_documents is
  'Private PDFs managed by administrators and delivered to authorized participants through short server-signed URLs.';
