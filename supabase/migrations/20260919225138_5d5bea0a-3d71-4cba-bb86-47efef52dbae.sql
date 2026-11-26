-- =====================================================================
-- Etapa 1: monetização (profiles, FlashCoins, loja, compras, custos IA)
-- Somente aditivo: nenhuma tabela/coluna existente é removida.
-- =====================================================================

-- 1. PROFILES -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  flashcoins_balance numeric(14,2) NOT NULL DEFAULT 0,
  terms_accepted_at timestamptz,
  cookies_accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own profile select" ON public.profiles;
CREATE POLICY "own profile select" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own profile insert" ON public.profiles;
CREATE POLICY "own profile insert" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
-- O saldo de moedas NUNCA é alterado pelo cliente: somente consentimentos.
DROP POLICY IF EXISTS "own profile update consents" ON public.profiles;
CREATE POLICY "own profile update consents" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND flashcoins_balance = (SELECT p.flashcoins_balance FROM public.profiles p WHERE p.user_id = auth.uid())
  );

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. STORE PRODUCTS -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_products (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  image_url text,
  price_label text NOT NULL,
  price_cents integer,
  currency text NOT NULL DEFAULT 'USD',
  paddle_price_id text NOT NULL,
  kind text NOT NULL DEFAULT 'pack',
  coins_amount integer,
  access_subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  validity_days integer NOT NULL DEFAULT 365,
  is_active boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.store_products TO authenticated;
GRANT ALL ON public.store_products TO service_role;
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "active products readable" ON public.store_products;
CREATE POLICY "active products readable" ON public.store_products
  FOR SELECT TO authenticated USING (is_active);

DROP TRIGGER IF EXISTS store_products_updated_at ON public.store_products;
CREATE TRIGGER store_products_updated_at BEFORE UPDATE ON public.store_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. USER PURCHASES (validade 365 dias) -----------------------------
CREATE TABLE IF NOT EXISTS public.user_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  paddle_transaction_id text,
  price_id text,
  amount_cents integer,
  currency text,
  environment text NOT NULL DEFAULT 'sandbox',
  purchased_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '365 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_purchases_tx_idx
  ON public.user_purchases(paddle_transaction_id, product_id)
  WHERE paddle_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS user_purchases_user_idx ON public.user_purchases(user_id, product_id);

GRANT SELECT ON public.user_purchases TO authenticated;
GRANT ALL ON public.user_purchases TO service_role;
ALTER TABLE public.user_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own purchases select" ON public.user_purchases;
CREATE POLICY "own purchases select" ON public.user_purchases
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS user_purchases_updated_at ON public.user_purchases;
CREATE TRIGGER user_purchases_updated_at BEFORE UPDATE ON public.user_purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. FLASHCOIN LEDGER ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.flashcoin_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  balance_after numeric(14,2) NOT NULL,
  reason text NOT NULL,
  action_id text,
  purchase_id uuid REFERENCES public.user_purchases(id) ON DELETE SET NULL,
  paddle_transaction_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS flashcoin_ledger_tx_idx
  ON public.flashcoin_ledger(paddle_transaction_id)
  WHERE paddle_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS flashcoin_ledger_user_idx ON public.flashcoin_ledger(user_id, created_at DESC);

GRANT SELECT ON public.flashcoin_ledger TO authenticated;
GRANT ALL ON public.flashcoin_ledger TO service_role;
ALTER TABLE public.flashcoin_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own ledger select" ON public.flashcoin_ledger;
CREATE POLICY "own ledger select" ON public.flashcoin_ledger
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 5. CUSTO DAS AÇÕES DE IA -----------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_action_costs (
  id text PRIMARY KEY,
  label text NOT NULL,
  coins_cost numeric(10,3) NOT NULL DEFAULT 1,
  est_cost_usd numeric(10,6) NOT NULL DEFAULT 0,
  margin_alert_pct integer NOT NULL DEFAULT 25,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_action_costs TO authenticated;
GRANT ALL ON public.ai_action_costs TO service_role;
ALTER TABLE public.ai_action_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "costs readable" ON public.ai_action_costs;
CREATE POLICY "costs readable" ON public.ai_action_costs
  FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS ai_action_costs_updated_at ON public.ai_action_costs;
CREATE TRIGGER ai_action_costs_updated_at BEFORE UPDATE ON public.ai_action_costs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ai_action_costs (id, label, coins_cost, est_cost_usd) VALUES
  ('chat',        'Conversação com IA (por mensagem)', 2,  0.0020),
  ('tts_cloud',   'Voz em nuvem (por leitura)',        1,  0.0010),
  ('translate',   'Tradução de card',                  1,  0.0008),
  ('note_format', 'Formatar anotação com IA',          5,  0.0060),
  ('mindmap',     'Gerar mapa mental',                 8,  0.0090),
  ('bulk',        'Geração em lote (por card)',        3,  0.0030),
  ('stt',         'Ditado por microfone',              1,  0.0009)
ON CONFLICT (id) DO NOTHING;

-- 6. USO DE CARDS COMUNITÁRIOS (Etapa 6) ---------------------------
CREATE TABLE IF NOT EXISTS public.flashcard_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flashcard_id uuid NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flashcard_id, user_id)
);

GRANT SELECT, INSERT ON public.flashcard_usage TO authenticated;
GRANT ALL ON public.flashcard_usage TO service_role;
ALTER TABLE public.flashcard_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own usage select" ON public.flashcard_usage;
CREATE POLICY "own usage select" ON public.flashcard_usage
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own usage insert" ON public.flashcard_usage;
CREATE POLICY "own usage insert" ON public.flashcard_usage
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 7. COLUNAS NOVAS EM TABELAS EXISTENTES ---------------------------
ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS is_public_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.ai_usage ADD COLUMN IF NOT EXISTS cost_usd numeric(10,6);
ALTER TABLE public.ai_usage ADD COLUMN IF NOT EXISTS coins_cost numeric(10,3);

-- 8. ACESSO A PACOTE COMPRADO (respeita os 365 dias) ---------------
CREATE OR REPLACE FUNCTION public.has_pack_access(user_uuid uuid, p_product_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_purchases up
    WHERE up.user_id = user_uuid
      AND up.product_id = p_product_id
      AND up.expires_at > now()
  );
$$;

CREATE OR REPLACE FUNCTION public.has_subject_access(user_uuid uuid, p_subject_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_purchases up
    JOIN public.store_products sp ON sp.id = up.product_id
    WHERE up.user_id = user_uuid
      AND sp.access_subject_id = p_subject_id
      AND up.expires_at > now()
  );
$$;