CREATE OR REPLACE FUNCTION public.protect_purchased_content_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.source_id IS NULL THEN
    RETURN OLD;
  END IF;
  -- Bloqueia apenas usuários logados comuns; service role, acesso direto ao banco
  -- e o AppManager seguem podendo excluir (ex.: fluxo de reembolso).
  IF auth.role() = 'authenticated'
     AND lower(COALESCE(auth.jwt() ->> 'email', '')) <> 'guit1966@gmail.com' THEN
    RAISE EXCEPTION 'Conteúdo de matéria comprada não pode ser excluído.';
  END IF;
  RETURN OLD;
END;
$$;