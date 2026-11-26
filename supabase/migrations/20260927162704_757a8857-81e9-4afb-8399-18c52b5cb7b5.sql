INSERT INTO public.document_jobs (user_id, document_name, status, mode, total_parts, processed_parts, cards_count, result_cards, input_slices, hint)
SELECT user_id, 'teste-retomada.pdf', 'processing', 'total', 3, 1, 1,
  '[{"question":"Qual o prazo do Enunciado 1?","answer":"15 dias","image_index":null}]'::jsonb,
  to_jsonb(ARRAY['Enunciado 2. A intimação é pessoal. Enunciado 3. Cabe agravo de instrumento.','Enunciado 4. O prazo conta em dias úteis. Enunciado 5. A sentença deve ser fundamentada.']),
  'Test'
FROM public.document_jobs ORDER BY updated_at DESC LIMIT 1;