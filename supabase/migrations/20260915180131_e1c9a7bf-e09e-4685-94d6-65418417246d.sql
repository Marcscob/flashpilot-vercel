CREATE POLICY "tts cache audio readable by signed in users"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'tts-cache');

CREATE POLICY "tts cache audio upload by signed in users"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tts-cache');