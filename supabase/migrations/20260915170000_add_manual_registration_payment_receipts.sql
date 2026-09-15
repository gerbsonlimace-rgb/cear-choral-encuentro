-- Store administrator-provided payment proofs in a private Storage bucket.
alter table public.registrations
  add column if not exists manual_receipt_path text,
  add column if not exists manual_receipt_file_name text,
  add column if not exists manual_receipt_mime_type text,
  add column if not exists manual_receipt_size_bytes integer;

alter table public.registrations
  add constraint registrations_manual_receipt_path_check
    check (
      manual_receipt_path is null
      or manual_receipt_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|png)$'
    ),
  add constraint registrations_manual_receipt_file_name_check
    check (
      manual_receipt_file_name is null
      or (char_length(btrim(manual_receipt_file_name)) between 1 and 160
        and manual_receipt_file_name !~ '[\\/]')
    ),
  add constraint registrations_manual_receipt_mime_type_check
    check (
      manual_receipt_mime_type is null
      or manual_receipt_mime_type in ('application/pdf', 'image/jpeg', 'image/png')
    ),
  add constraint registrations_manual_receipt_size_check
    check (
      manual_receipt_size_bytes is null
      or manual_receipt_size_bytes between 1 and 10485760
    ),
  add constraint registrations_manual_receipt_metadata_check
    check (
      (manual_receipt_path is null and manual_receipt_file_name is null
        and manual_receipt_mime_type is null and manual_receipt_size_bytes is null)
      or (manual_receipt_path is not null and manual_receipt_file_name is not null
        and manual_receipt_mime_type is not null and manual_receipt_size_bytes is not null)
    );

-- Existing legacy/manual records are left readable; every new manual paid row
-- must carry a proof. The constraint can be validated after historical rows
-- have been reviewed without blocking this release.
alter table public.registrations
  add constraint registrations_manual_paid_receipt_required_check
    check (
      payment_status <> 'paid'
      or payment_origin <> 'manual'
      or manual_receipt_path is not null
    ) not valid;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'registration-payment-receipts',
  'registration-payment-receipts',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No anon/authenticated Storage policies: uploads, removals and signed URLs
-- are issued only by the server with the privileged client after requireAdmin.
