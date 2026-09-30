-- O upload usa upsert, que exige SELECT, INSERT e UPDATE no Storage.
-- split_part torna a validação da pasta do usuário explícita e simples.

DROP POLICY IF EXISTS avatars_select_own ON storage.objects;
CREATE POLICY avatars_select_own ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS avatars_insert_own ON storage.objects;
CREATE POLICY avatars_insert_own ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS avatars_update_own ON storage.objects;
CREATE POLICY avatars_update_own ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = (SELECT auth.uid())::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS avatars_delete_own ON storage.objects;
CREATE POLICY avatars_delete_own ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = (SELECT auth.uid())::text
);
