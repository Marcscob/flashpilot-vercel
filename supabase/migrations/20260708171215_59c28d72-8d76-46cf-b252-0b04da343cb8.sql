-- Enable trigram extension for efficient text search indexing
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Indexes for flashcards (searched by question and answer)
CREATE INDEX IF NOT EXISTS idx_flashcards_question_trgm ON public.flashcards USING gin (question gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_flashcards_answer_trgm ON public.flashcards USING gin (answer gin_trgm_ops);

-- Index for subjects (searched by name)
CREATE INDEX IF NOT EXISTS idx_subjects_name_trgm ON public.subjects USING gin (name gin_trgm_ops);

-- Index for topics (searched by name)
CREATE INDEX IF NOT EXISTS idx_topics_name_trgm ON public.topics USING gin (name gin_trgm_ops);

-- Index for notes (searched by title)
CREATE INDEX IF NOT EXISTS idx_notes_title_trgm ON public.notes USING gin (title gin_trgm_ops);

-- Also add standard B-tree indexes on foreign keys frequently used in joins/filters
CREATE INDEX IF NOT EXISTS idx_flashcards_topic_id ON public.flashcards(topic_id);
CREATE INDEX IF NOT EXISTS idx_topics_subject_id ON public.topics(subject_id);