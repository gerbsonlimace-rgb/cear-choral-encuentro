DROP POLICY IF EXISTS "Anonymous users can submit registration" ON public.registrations;
DROP POLICY IF EXISTS "Authenticated users can submit registration" ON public.registrations;

REVOKE INSERT ON public.registrations FROM anon;
REVOKE INSERT ON public.registrations FROM authenticated;
REVOKE SELECT ON public.registrations FROM authenticated;

-- Confirma que service_role mantém acesso total via GRANT já aplicado anteriormente.