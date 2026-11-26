DROP POLICY IF EXISTS "anyone create rooms" ON public.rooms;
DROP POLICY IF EXISTS "anyone update rooms" ON public.rooms;
REVOKE INSERT, UPDATE ON public.rooms FROM anon, authenticated;
CREATE TABLE public.room_players (
  code text NOT NULL,
  player_id text NOT NULL,
  secret_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (code, player_id)
);
GRANT ALL ON public.room_players TO service_role;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;