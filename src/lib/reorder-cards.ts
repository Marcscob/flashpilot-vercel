import { supabase } from "@/integrations/supabase/client";
import { renumber } from "@/lib/order-index";

// Grava a nova ordem (1..n) dos flashcards informados, em lotes paralelos.
export async function persistCardOrder(ids: string[]) {
  const rows = renumber(ids);
  const CHUNK = 25;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const results = await Promise.all(
      slice.map((r) =>
        supabase.from("flashcards").update({ order_index: r.order_index }).eq("id", r.id),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  }
}
