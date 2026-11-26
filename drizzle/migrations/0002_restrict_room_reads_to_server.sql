DROP POLICY IF EXISTS "anyone read rooms" ON public.rooms;
REVOKE SELECT ON public.rooms FROM anon, authenticated;
GRANT SELECT ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;