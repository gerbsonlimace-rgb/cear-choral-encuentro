alter table public.registrations
  add column photo_path text,
  add column voice_part text,
  add constraint registrations_photo_path_format_check
    check (
      photo_path is null
      or photo_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/participant\.(jpg|png|webp)$'
    ),
  add constraint registrations_voice_part_check
    check (
      voice_part in ('soprano', 'contralto', 'tenor', 'baixo', 'nao_sei_informar')
    );

comment on column public.registrations.photo_path is
  'Private Storage object path for the participant badge photo.';

comment on column public.registrations.voice_part is
  'Participant musical profile selected during registration.';

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'registration-photos',
  'registration-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- There are intentionally no anon/authenticated policies for this bucket.
-- Uploads and removals happen only in the trusted server through service_role.
