-- Allow member portal to use existing public.entries table safely.
-- Members can only access rows where entries.member_id maps to their own members.email.

ALTER TABLE IF EXISTS public.entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read own entries" ON public.entries;
DROP POLICY IF EXISTS "Members can insert own entries" ON public.entries;
DROP POLICY IF EXISTS "Members can update own entries" ON public.entries;
DROP POLICY IF EXISTS "Service role full entries access" ON public.entries;

CREATE POLICY "Members can read own entries" ON public.entries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.id::text = entries.member_id::text
        AND LOWER(m.email) = LOWER(auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Members can insert own entries" ON public.entries
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.id::text = entries.member_id::text
        AND LOWER(m.email) = LOWER(auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Members can update own entries" ON public.entries
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.id::text = entries.member_id::text
        AND LOWER(m.email) = LOWER(auth.jwt() ->> 'email')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.id::text = entries.member_id::text
        AND LOWER(m.email) = LOWER(auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Service role full entries access" ON public.entries
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
