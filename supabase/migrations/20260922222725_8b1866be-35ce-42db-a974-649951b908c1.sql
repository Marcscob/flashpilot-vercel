DROP POLICY IF EXISTS "own subjects" ON public.subjects;

CREATE POLICY "subjects_select_own" ON public.subjects
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "subjects_insert_own" ON public.subjects
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "subjects_update_own" ON public.subjects
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "subjects_delete_own_created" ON public.subjects
FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  AND (source_id IS NULL OR (auth.jwt() ->> 'email') = 'guit1966@gmail.com')
);