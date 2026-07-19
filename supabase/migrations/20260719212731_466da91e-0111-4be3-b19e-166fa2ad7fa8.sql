CREATE TABLE public.registrations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  city text not null,
  institution text,
  role text not null check (role in ('participant', 'listener', 'musician', 'choir_member')),
  observations text,
  created_at timestamptz not null default now()
);

GRANT INSERT ON public.registrations TO anon;
GRANT SELECT, INSERT ON public.registrations TO authenticated;
GRANT ALL ON public.registrations TO service_role;

ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anonymous users can submit registration"
ON public.registrations
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Authenticated users can submit registration"
ON public.registrations
FOR INSERT
TO authenticated
WITH CHECK (true);