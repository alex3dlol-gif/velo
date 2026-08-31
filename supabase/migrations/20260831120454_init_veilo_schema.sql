-- Veilo core schema: profiles, trips, user_sectors + RLS + RPC

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE public.trip_status AS ENUM ('active', 'paused', 'completed', 'cancelled');

-- ---------------------------------------------------------------------------
-- profiles (extends auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  telegram_id bigint UNIQUE,
  username text,
  photo_url text,
  total_sectors_opened integer NOT NULL DEFAULT 0 CHECK (total_sectors_opened >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Public user profile linked to auth.users (Telegram OAuth).';

-- ---------------------------------------------------------------------------
-- trips
-- ---------------------------------------------------------------------------
CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  distance_meters numeric(12, 2) NOT NULL DEFAULT 0 CHECK (distance_meters >= 0),
  sectors_count integer NOT NULL DEFAULT 0 CHECK (sectors_count >= 0),
  status public.trip_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trips_ended_after_start CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX trips_user_id_idx ON public.trips (user_id);
CREATE INDEX trips_user_status_idx ON public.trips (user_id, status);

COMMENT ON TABLE public.trips IS 'User exploration sessions (rides / walks).';

-- ---------------------------------------------------------------------------
-- user_sectors
-- ---------------------------------------------------------------------------
CREATE TABLE public.user_sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  h3_index text NOT NULL,
  resolution integer NOT NULL DEFAULT 9 CHECK (resolution BETWEEN 0 AND 15),
  first_visited_at timestamptz NOT NULL DEFAULT now(),
  trip_id uuid REFERENCES public.trips (id) ON DELETE SET NULL,
  CONSTRAINT user_sectors_user_h3_unique UNIQUE (user_id, h3_index)
);

CREATE INDEX user_sectors_user_id_idx ON public.user_sectors (user_id);
CREATE INDEX user_sectors_h3_index_idx ON public.user_sectors (h3_index);
CREATE INDEX user_sectors_trip_id_idx ON public.user_sectors (trip_id);

COMMENT ON TABLE public.user_sectors IS 'H3 cells revealed by a user (fog of war).';

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trips_set_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create profile on auth.users insert (Telegram / OAuth)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_telegram_id bigint;
BEGIN
  BEGIN
    v_telegram_id := NULLIF(NEW.raw_user_meta_data ->> 'telegram_id', '')::bigint;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_telegram_id := NULL;
  END;

  IF v_telegram_id IS NULL AND NEW.raw_user_meta_data ? 'sub' THEN
    BEGIN
      v_telegram_id := NULLIF(NEW.raw_user_meta_data ->> 'sub', '')::bigint;
    EXCEPTION
      WHEN invalid_text_representation THEN
        v_telegram_id := NULL;
    END;
  END IF;

  INSERT INTO public.profiles (id, telegram_id, username, photo_url)
  VALUES (
    NEW.id,
    v_telegram_id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'user_name',
      NEW.raw_user_meta_data ->> 'username',
      NEW.raw_user_meta_data ->> 'name',
      NEW.raw_user_meta_data ->> 'full_name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data ->> 'avatar_url',
      NEW.raw_user_meta_data ->> 'photo_url',
      NEW.raw_user_meta_data ->> 'picture'
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RPC: batch_insert_h3_sectors
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.batch_insert_h3_sectors(
  p_sectors jsonb,
  p_trip_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_inserted integer := 0;
  v_total integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_sectors IS NULL OR jsonb_typeof(p_sectors) <> 'array' THEN
    RAISE EXCEPTION 'p_sectors must be a JSON array';
  END IF;

  IF p_trip_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.trips
      WHERE id = p_trip_id
        AND user_id = v_user_id
    ) THEN
      RAISE EXCEPTION 'Trip not found or access denied';
    END IF;
  END IF;

  WITH input AS (
    SELECT DISTINCT
      trim(elem ->> 'h3_index') AS h3_index,
      COALESCE((elem ->> 'resolution')::integer, 9) AS resolution
    FROM jsonb_array_elements(p_sectors) AS elem
    WHERE trim(COALESCE(elem ->> 'h3_index', '')) <> ''
  ),
  inserted AS (
    INSERT INTO public.user_sectors (user_id, h3_index, resolution, trip_id)
    SELECT v_user_id, i.h3_index, i.resolution, p_trip_id
    FROM input AS i
    ON CONFLICT (user_id, h3_index) DO NOTHING
    RETURNING id
  )
  SELECT count(*)::integer INTO v_inserted FROM inserted;

  UPDATE public.profiles
  SET total_sectors_opened = total_sectors_opened + v_inserted
  WHERE id = v_user_id
  RETURNING total_sectors_opened INTO v_total;

  IF p_trip_id IS NOT NULL AND v_inserted > 0 THEN
    UPDATE public.trips
    SET sectors_count = sectors_count + v_inserted
    WHERE id = p_trip_id
      AND user_id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'inserted_count', v_inserted,
    'total_sectors_opened', v_total
  );
END;
$$;

COMMENT ON FUNCTION public.batch_insert_h3_sectors(jsonb, uuid)
  IS 'Atomically inserts H3 sectors for the current user; ignores duplicates and updates counters.';

GRANT EXECUTE ON FUNCTION public.batch_insert_h3_sectors(jsonb, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY trips_select_own ON public.trips
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY trips_insert_own ON public.trips
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY trips_update_own ON public.trips
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY trips_delete_own ON public.trips
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_sectors_select_own ON public.user_sectors
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_sectors_insert_own ON public.user_sectors
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_sectors_update_own ON public.user_sectors
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_sectors_delete_own ON public.user_sectors
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
