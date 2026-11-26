-- A policy "subject_grants_update_own" permite que o próprio aluno faça UPDATE
-- na linha, mas sem restringir QUAIS colunas podem mudar. Como o servidor usa
-- subject_grants.copy_subject_id (e outras colunas) sem revalidar a matéria
-- comprada, um aluno mal-intencionado podia chamar o Supabase diretamente
-- (fora do app) e:
--   - apontar copy_subject_id para o id de uma matéria de OUTRA conta, fazendo
--     o próximo "ensureSubjectDelivery" ler/sobrescrever dados de outro aluno;
--   - estender expires_at/last_synced_at por conta própria.
-- Esta migration trava, via trigger, todas as colunas que só o servidor
-- (service_role) deve poder alterar. O aluno continua podendo mudar apenas a
-- preferência de renovação (renew_mode), que é o único campo pensado para
-- edição direta pelo cliente (ver setRenewMode em official-content.functions.ts).

CREATE OR REPLACE FUNCTION public.subject_grants_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.product_id IS DISTINCT FROM OLD.product_id
     OR NEW.source_subject_id IS DISTINCT FROM OLD.source_subject_id
     OR NEW.copy_subject_id IS DISTINCT FROM OLD.copy_subject_id
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.last_synced_at IS DISTINCT FROM OLD.last_synced_at
  THEN
    RAISE EXCEPTION 'Apenas a preferência de renovação pode ser alterada pelo aluno.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subject_grants_guard_update_trg ON public.subject_grants;
CREATE TRIGGER subject_grants_guard_update_trg
  BEFORE UPDATE ON public.subject_grants
  FOR EACH ROW EXECUTE FUNCTION public.subject_grants_guard_update();

-- Nenhum caminho do app faz INSERT em subject_grants pelo cliente (sempre via
-- service_role); remover o GRANT reduz a superfície de ataque mesmo sem
-- policy de INSERT (RLS já negaria, mas o grant solto era enganoso).
REVOKE INSERT ON public.subject_grants FROM authenticated;
