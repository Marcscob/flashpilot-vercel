-- Conteúdo gerado na landing (nota, mapa mental, vídeo e narração) guardado por teste,
-- para ser importado na conta sem nova geração de IA.
ALTER TABLE public.landing_visitor_handoffs
  ADD COLUMN IF NOT EXISTS generated_materials jsonb,
  ADD COLUMN IF NOT EXISTS generated_materials_at timestamptz;

ALTER TABLE public.landing_visitor_handoffs
  DROP CONSTRAINT IF EXISTS landing_visitor_handoffs_generated_materials_size;
ALTER TABLE public.landing_visitor_handoffs
  ADD CONSTRAINT landing_visitor_handoffs_generated_materials_size
  CHECK (generated_materials IS NULL OR pg_column_size(generated_materials) <= 2000000);
