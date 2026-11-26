import { MANAGED_PADDLE_PRICE_IDS, formatUsd, tierFor } from "./subject-pricing";

/** Conta os cards de cada matéria usando contagem no banco (rápido, sem trazer linhas). */
export async function countCardsBySubject(client: any, subjectIds: string[]) {
  const counts = new Map<string, number>();
  for (const id of subjectIds) counts.set(id, 0);
  if (!subjectIds.length) return counts;

  const { data: topics } = await client.from("topics").select("id, subject_id").in("subject_id", subjectIds);
  const topicsBySubject = new Map<string, string[]>();
  for (const t of topics ?? []) {
    const list = topicsBySubject.get(t.subject_id) ?? [];
    list.push(t.id);
    topicsBySubject.set(t.subject_id, list);
  }

  await Promise.all(
    Array.from(topicsBySubject.entries()).map(async ([subjectId, topicIds]) => {
      let total = 0;
      const CHUNK = 150;
      for (let i = 0; i < topicIds.length; i += CHUNK) {
        const { count, error } = await client
          .from("flashcards")
          .select("id", { count: "exact", head: true })
          .in("topic_id", topicIds.slice(i, i + CHUNK));
        if (error) throw new Error(error.message);
        total += count ?? 0;
      }
      counts.set(subjectId, total);
    }),
  );

  return counts;
}


/**
 * Reajusta o preço dos pacotes de matéria já publicados conforme a faixa atual de cards.
 * Matérias com preço do Paddle definido manualmente no painel não são alteradas.
 * Retorna a contagem de cards usada por matéria.
 */
export async function reconcileSubjectPackPrices(
  client: any,
  opts?: { counts?: Map<string, number> },
) {
  const { data: packs } = await client
    .from("store_products")
    .select("id, access_subject_id, price_cents, paddle_price_id")
    .eq("kind", "pack");

  const list = (packs ?? []).filter((p: any) => !!p.access_subject_id);
  const subjectIds: string[] = list.map((p: any) => p.access_subject_id);
  const counts = opts?.counts ?? (await countCardsBySubject(client, subjectIds));

  for (const p of list) {
    const cards = counts.get(p.access_subject_id) ?? 0;
    if (!cards) continue;
    const manualOverride = !!p.paddle_price_id && !MANAGED_PADDLE_PRICE_IDS.has(p.paddle_price_id);
    if (manualOverride) continue;
    const tier = tierFor(cards);
    if (p.price_cents === tier.cents && p.paddle_price_id === tier.paddlePriceId) continue;
    await client
      .from("store_products")
      .update({
        price_cents: tier.cents,
        price_label: formatUsd(tier.cents),
        paddle_price_id: tier.paddlePriceId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", p.id);
  }

  return counts;
}
