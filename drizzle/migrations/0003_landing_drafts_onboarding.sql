-- Rascunhos da landing page: texto enviado antes do cadastro, com token de ativação e TTL de 24h.
CREATE TABLE public.landing_drafts (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  full_name text,
  content text NOT NULL,
  lang text NOT NULL DEFAULT 'pt',
  token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  user_id uuid,
  subject_id uuid,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  activated_at timestamptz,
  processed_at timestamptz
);

CREATE INDEX landing_drafts_email_idx ON public.landing_drafts (email);

-- Acesso exclusivo via service_role (funções de servidor); sem políticas para anon/authenticated.
GRANT ALL ON public.landing_drafts TO service_role;

ALTER TABLE public.landing_drafts ENABLE ROW LEVEL SECURITY;