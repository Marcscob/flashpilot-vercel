import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MANAGED_PADDLE_PRICE_IDS, formatUsd, tierFor } from "@/lib/subject-pricing";
import { isAppManagerIdentity, OWNER_EMAIL } from "@/lib/app-manager";
import { subscriberPlanCounts } from "@/lib/payment-catalog";


export const ADMIN_EMAIL = OWNER_EMAIL;

function assertAdmin(claims: unknown) {
  if (!isAppManagerIdentity(claims)) throw new Error("Área restrita ao AppManager.");
  return String((claims as any)?.email ?? "").toLowerCase();
}

/** Painel do administrador: receita, assinantes, produtos e alerta de margem das ações do PilotAI. */
export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [purchases, storePurchases, subs, products, costs, usage] = await Promise.all([
      supabaseAdmin.from("purchases").select("amount_cents, currency, product_id, created_at").limit(5000),
      supabaseAdmin
        .from("user_purchases")
        .select("amount_cents, currency, product_id, purchased_at, expires_at, environment")
        .limit(5000),
      supabaseAdmin
        .from("subscriptions")
        .select("user_id, product_id, price_id, status, current_period_end, environment, created_at")
        .limit(5000),
      supabaseAdmin
        .from("store_products")
        .select(
          "id, name, description, price_label, price_cents, currency, kind, coins_amount, validity_days, paddle_price_id, is_active, order_index",
        )
        .order("order_index", { ascending: true }),
      supabaseAdmin
        .from("ai_action_costs")
        .select("id, label, coins_cost, est_cost_usd, margin_alert_pct, is_active")
        .order("id", { ascending: true }),
      supabaseAdmin.from("ai_usage").select("kind, cost_usd, coins_cost, created_at").gte("created_at", since30).limit(20000),
    ]);

    const now = Date.now();

    const revenueAll = (purchases.data ?? []).reduce((sum, p) => sum + Number(p.amount_cents ?? 0), 0);
    const revenue30 = (purchases.data ?? [])
      .filter((p) => p.created_at && new Date(p.created_at).getTime() >= Date.parse(since30))
      .reduce((sum, p) => sum + Number(p.amount_cents ?? 0), 0);

    const activeSubs = (subs.data ?? []).filter((s) => {
      const end = s.current_period_end ? new Date(s.current_period_end).getTime() : null;
      return (["active", "trialing", "past_due"].includes(s.status) && (!end || end > now)) ||
        (s.status === "canceled" && !!end && end > now);
    });

    // Custo real médio por ação nos últimos 30 dias vs. custo estimado cadastrado.
    const agg = new Map<string, { count: number; usd: number; coins: number }>();
    for (const row of usage.data ?? []) {
      const key = row.kind ?? "outros";
      const e = agg.get(key) ?? { count: 0, usd: 0, coins: 0 };
      e.count += 1;
      e.usd += Number(row.cost_usd ?? 0);
      e.coins += Number(row.coins_cost ?? 0);
      agg.set(key, e);
    }

    const actions = (costs.data ?? []).map((c) => {
      const a = agg.get(c.id);
      const avgUsd = a && a.count > 0 ? a.usd / a.count : null;
      const est = Number(c.est_cost_usd ?? 0);
      const margin = Number(c.margin_alert_pct ?? 25);
      const overBy = avgUsd !== null && est > 0 ? (avgUsd / est - 1) * 100 : null;
      return {
        id: c.id,
        label: c.label,
        coinsCost: Number(c.coins_cost ?? 0),
        estCostUsd: est,
        marginAlertPct: margin,
        isActive: !!c.is_active,
        calls30d: a?.count ?? 0,
        coins30d: a?.coins ?? 0,
        avgCostUsd: avgUsd,
        overByPct: overBy,
        alert: overBy !== null && overBy > margin,
      };
    });

    const activePacks = (storePurchases.data ?? []).filter((p) => new Date(p.expires_at).getTime() > now);

    return {
      revenueCents: revenueAll,
      revenue30Cents: revenue30,
      transactions: (purchases.data ?? []).length,
      activeSubscribers: activeSubs.length,
      subscribersByPlan: subscriberPlanCounts(activeSubs),
      activePackAccesses: activePacks.length,
      products: (products.data ?? []).map((p) => ({ ...p, price_cents: p.price_cents ?? null })),
      actions,
      aiCalls30d: (usage.data ?? []).length,
      aiCost30dUsd: (usage.data ?? []).reduce((s, r) => s + Number(r.cost_usd ?? 0), 0),
    };
  });

/** Atualiza um produto da Loja (nome, descrição, preço exibido, validade, ordem, ativo). */
export const adminSaveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().min(1),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        price_label: z.string().min(1).optional(),
        price_cents: z.number().int().min(0).nullable().optional(),
        validity_days: z.number().int().min(1).optional(),
        order_index: z.number().int().min(0).optional(),
        is_active: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin
      .from("store_products")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


/** Busca todos os cards dos assuntos informados, paginando (o PostgREST limita a 1000 linhas). */
async function fetchAllCardRows(
  client: any,
  topicIds: string[],
): Promise<{ topic_id: string; created_at: string | null }[]> {
  const out: { topic_id: string; created_at: string | null }[] = [];
  const CHUNK = 200;
  for (let i = 0; i < topicIds.length; i += CHUNK) {
    const slice = topicIds.slice(i, i + CHUNK);
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await client
        .from("flashcards")
        .select("topic_id, created_at")
        .in("topic_id", slice)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      out.push(...rows);
      if (rows.length < PAGE) break;
    }
  }
  return out;
}

/**
 * Matérias do AppManager com o estado de publicação na Loja.
 * Cada matéria pode virar um pacote (store_products kind='pack', id `pack_<subjectId>`).
 */
export const adminSubjectPacks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: subjects } = await supabaseAdmin
      .from("subjects")
      .select("id, name")
      .eq("user_id", context.userId)
      .order("order_index", { ascending: true });
    const subjectIds = (subjects ?? []).map((s) => s.id);

    const topicsRes = subjectIds.length
      ? await supabaseAdmin.from("topics").select("id, subject_id").in("subject_id", subjectIds)
      : { data: [] as { id: string; subject_id: string }[] };

    const topicIds = (topicsRes.data ?? []).map((t) => t.id);
    const subjectOfTopic = new Map((topicsRes.data ?? []).map((t) => [t.id, t.subject_id]));

    // Contagem de cards e última atualização de conteúdo por matéria.
    const stats = new Map<string, { cards: number; lastUpdate: string | null }>();
    if (topicIds.length) {
      const cards = await fetchAllCardRows(supabaseAdmin, topicIds);
      for (const c of cards) {
        const sid = subjectOfTopic.get(c.topic_id);
        if (!sid) continue;
        const e = stats.get(sid) ?? { cards: 0, lastUpdate: null };
        e.cards += 1;
        if (c.created_at && (!e.lastUpdate || c.created_at > e.lastUpdate)) e.lastUpdate = c.created_at;
        stats.set(sid, e);
      }
    }

    // Mantém o preço de cada matéria na faixa correta antes de exibir o painel.
    const counts = new Map<string, number>();
    for (const [sid, st] of stats) counts.set(sid, st.cards);
    const { reconcileSubjectPackPrices } = await import("@/lib/subject-pricing.server");
    await reconcileSubjectPackPrices(supabaseAdmin, { counts });


    const packsRes = await supabaseAdmin
      .from("store_products")
      .select("id, access_subject_id, price_cents, price_label, paddle_price_id, is_active, validity_days")
      .eq("kind", "pack");

    const packBySubject = new Map((packsRes.data ?? []).map((p) => [p.access_subject_id, p]));

    return {
      subjects: (subjects ?? []).map((s) => {
        const pack = packBySubject.get(s.id);
        const st = stats.get(s.id);
        const cards = st?.cards ?? 0;
        const tier = tierFor(cards);
        return {
          subjectId: s.id,
          name: s.name,
          cards,
          lastUpdate: st?.lastUpdate ?? null,
          available: !!pack?.is_active,
          priceCents: pack?.price_cents ?? null,
          paddlePriceId: pack?.paddle_price_id ?? null,
          validityDays: pack?.validity_days ?? 365,
          tierCents: tier.cents,
          tierLabel: tier.label,
          tierRange: tier.rangeLabel,
        };
      }),
    };
  });


/**
 * Publica/despublica uma matéria na Loja.
 * O preço é sempre a faixa correspondente ao número de cards da matéria
 * (até 1.000 → US$ 9,65 · 1.001–2.000 → US$ 14,70 · acima de 2.000 → US$ 17,90).
 * Nunca apaga nada: o produto é criado uma única vez e depois só atualizado.
 */
export const adminSaveSubjectPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        subjectId: z.string().uuid(),
        available: z.boolean(),
        // Mantido por retrocompatibilidade; o preço agora vem da faixa de cards.
        priceUsd: z.number().min(0).max(10000).optional(),
        paddlePriceId: z.string().trim().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { countCardsBySubject } = await import("@/lib/subject-pricing.server");

    const { data: subject } = await supabaseAdmin
      .from("subjects")
      .select("id, name")
      .eq("id", data.subjectId)
      .maybeSingle();
    if (!subject) throw new Error("Matéria não encontrada.");

    const counts = await countCardsBySubject(supabaseAdmin, [data.subjectId]);
    const cards = counts.get(data.subjectId) ?? 0;
    if (data.available && !cards) throw new Error("Matéria sem cards não pode ir para a Loja.");
    const tier = tierFor(cards);

    const productId = `pack_${data.subjectId}`;
    const customPriceId = data.paddlePriceId?.trim() || null;

    const { data: existing } = await supabaseAdmin
      .from("store_products")
      .select("id, paddle_price_id, order_index")
      .eq("id", productId)
      .maybeSingle();

    const patch = {
      name: subject.name,
      description: "Acesso completo ao conteúdo oficial desta matéria.",
      kind: "pack",
      access_subject_id: data.subjectId,
      price_cents: tier.cents,
      price_label: formatUsd(tier.cents),
      currency: "usd",
      validity_days: 365,
      // Preço do Paddle informado no painel prevalece; sem ele, usa o da faixa.
      paddle_price_id: customPriceId ?? tier.paddlePriceId,
      is_active: data.available,
      updated_at: new Date().toISOString(),
    };


    if (existing) {
      const { error } = await supabaseAdmin.from("store_products").update(patch).eq("id", productId);
      if (error) throw new Error(error.message);
    } else {
      const { data: maxRow } = await supabaseAdmin
        .from("store_products")
        .select("order_index")
        .order("order_index", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { error } = await supabaseAdmin.from("store_products").insert({
        id: productId,
        ...patch,
        order_index: Number(maxRow?.order_index ?? 0) + 1,
      });
      if (error) throw new Error(error.message);
    }

    return { ok: true, paddlePriceId: patch.paddle_price_id };
  });

/** Atualiza o custo em FlashCoins, o custo estimado e a margem de alerta de uma ação do PilotAI. */
export const adminSaveActionCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().min(1),
        coins_cost: z.number().min(0).optional(),
        est_cost_usd: z.number().min(0).optional(),
        margin_alert_pct: z.number().int().min(0).max(1000).optional(),
        is_active: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin
      .from("ai_action_costs")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Publica de uma vez todas as matérias do AppManager que têm cards.
 * O preço de cada matéria é a faixa correspondente ao número de cards.
 * Nunca apaga nada e nunca publica matéria vazia.
 */
export const adminPublishAllSubjectPacks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ defaultPriceUsd: z.number().min(0.01).max(10000).optional() }).parse(data ?? {}),
  )
  .handler(async ({ context }) => {
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { countCardsBySubject } = await import("@/lib/subject-pricing.server");

    const { data: subjects } = await supabaseAdmin
      .from("subjects")
      .select("id, name")
      .eq("user_id", context.userId)
      .order("order_index", { ascending: true });

    const subjectIds = (subjects ?? []).map((s) => s.id);
    if (!subjectIds.length) return { published: 0, skipped: 0 };

    const counts = await countCardsBySubject(supabaseAdmin, subjectIds);

    const { data: existingPacks } = await supabaseAdmin
      .from("store_products")
      .select("id, access_subject_id, price_cents, paddle_price_id")
      .eq("kind", "pack");
    const packBySubject = new Map((existingPacks ?? []).map((p) => [p.access_subject_id, p]));

    const { data: maxRow } = await supabaseAdmin
      .from("store_products")
      .select("order_index")
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    let nextOrder = (maxRow?.order_index ?? 0) + 1;

    let published = 0;
    let skipped = 0;

    for (const s of subjects ?? []) {
      const cards = counts.get(s.id) ?? 0;
      if (!cards) {
        skipped += 1;
        continue;
      }
      const existing = packBySubject.get(s.id);
      const tier = tierFor(cards);
      const manual =
        existing?.paddle_price_id && !MANAGED_PADDLE_PRICE_IDS.has(existing.paddle_price_id)
          ? existing.paddle_price_id
          : null;
      const patch = {
        name: s.name,
        description: "Acesso completo ao conteúdo oficial desta matéria.",
        kind: "pack",
        access_subject_id: s.id,
        price_cents: tier.cents,
        price_label: formatUsd(tier.cents),
        currency: "usd",
        validity_days: 365,
        paddle_price_id: manual ?? tier.paddlePriceId,
        is_active: true,
        updated_at: new Date().toISOString(),
      };
      if (existing) {
        const { error } = await supabaseAdmin.from("store_products").update(patch).eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabaseAdmin
          .from("store_products")
          .insert({ id: `pack_${s.id}`, ...patch, order_index: nextOrder++ });
        if (error) throw new Error(error.message);
      }
      published += 1;
    }


    return { published, skipped };
  });
