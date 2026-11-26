import { supabase } from "@/integrations/supabase/client";

/**
 * Grava a nova ordem (1..n) de matérias ou assuntos/subtópicos/subitens.
 */
export async function persistTreeOrder(table: "subjects" | "topics", ids: string[]) {
  const CHUNK = 25;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const results = await Promise.all(
      slice.map((id, j) =>
        supabase.from(table).update({ order_index: i + j + 1 }).eq("id", id),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }
}
