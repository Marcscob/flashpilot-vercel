-- Merge atômico de um material gerado na landing, por cartão (ordinal) e tipo.
-- Só o servidor (service_role) chama.
CREATE OR REPLACE FUNCTION public.merge_landing_generated_material(
  _handoff_id uuid,
  _ordinal text,
  _kind text,
  _value jsonb
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.landing_visitor_handoffs
  SET generated_materials = coalesce(generated_materials, '{}'::jsonb)
        || jsonb_build_object(
          _ordinal,
          coalesce(generated_materials -> _ordinal, '{}'::jsonb) || jsonb_build_object(_kind, _value)
        ),
      generated_materials_at = now()
  WHERE id = _handoff_id;
$$;

REVOKE ALL ON FUNCTION public.merge_landing_generated_material(uuid, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_landing_generated_material(uuid, text, text, jsonb)
  TO service_role;
