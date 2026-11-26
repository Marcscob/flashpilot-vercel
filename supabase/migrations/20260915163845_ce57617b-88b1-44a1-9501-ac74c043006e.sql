ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS language text;
ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS language text;

COMMENT ON COLUMN public.subjects.language IS 'Idioma da matéria (BCP-47 curto: pt-BR, en, es, fr, it, de...). NULL = comportamento padrão (pt-BR).';
COMMENT ON COLUMN public.flashcards.language IS 'Idioma específico do card, sobrescreve o da matéria. NULL = herda da matéria.';