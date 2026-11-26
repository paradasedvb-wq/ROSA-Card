CREATE TABLE public.rooms (
  code text PRIMARY KEY,
  host_id text NOT NULL,
  max_players int NOT NULL DEFAULT 4,
  status text NOT NULL DEFAULT 'lobby',
  players jsonb NOT NULL DEFAULT '[]'::jsonb,
  state jsonb,
  version int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT max_players_range CHECK (max_players BETWEEN 2 AND 10)
);
GRANT SELECT, INSERT, UPDATE ON public.rooms TO anon, authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read rooms" ON public.rooms FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anyone create rooms" ON public.rooms FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anyone update rooms" ON public.rooms FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;