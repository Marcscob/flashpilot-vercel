import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAppManagerIdentity, OWNER_EMAIL } from "@/lib/app-manager";

export { OWNER_EMAIL };

/** Catálogo da Loja + o que o usuário já tem (saldo, pacotes liberados). */
export const storeCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const isOwner = isAppManagerIdentity(context.claims);

    // Reajusta o preço das matérias conforme a faixa de cards antes de montar a vitrine.
    {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { reconcileSubjectPackPrices } = await import("@/lib/subject-pricing.server");
      try {
        await reconcileSubjectPackPrices(supabaseAdmin);
      } catch {
        // Nunca bloqueia a Loja por falha no reajuste de preço.
      }
    }

    const [products, purchases] = await Promise.all([
      context.supabase
        .from("store_products")
        .select("id, name, description, image_url, price_label, price_cents, currency, kind, coins_amount, paddle_price_id, access_subject_id, validity_days, order_index")
        .eq("is_active", true)
        .order("order_index", { ascending: true }),
      context.supabase
        .from("user_purchases")
        .select("product_id, purchased_at, expires_at")
        .eq("user_id", context.userId)
        .in("environment", ["live", "owner", ...(process.env.PADDLE_ENV_INCLUDE_SANDBOX === "0" ? [] : ["sandbox"])]),
    ]);
    const { getAvailableFlashcoins } = await import("./ai-quota.server");
    const availableBalance = await getAvailableFlashcoins(context.userId);

    // Produtos sem preço válido no Paddle (ex.: preços arquivados) não aparecem na vitrine.
    // Quem já comprou continua com o acesso, pois user_purchases não é afetado.
    const ARCHIVED_PADDLE_PRICES = new Set(["pack_0990", "pack_1790"]);
    const productList = (products.data ?? []).filter(
      (p) => !!p.paddle_price_id && !ARCHIVED_PADDLE_PRICES.has(p.paddle_price_id),
    );

    // Data da última atualização de conteúdo de cada pacote de matéria.
    const packSubjectIds = productList
      .filter((p) => p.kind !== "coins" && p.access_subject_id)
      .map((p) => p.access_subject_id as string);
    const lastUpdateBySubject = new Map<string, string>();
    if (packSubjectIds.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: topics } = await supabaseAdmin
        .from("topics")
        .select("id, subject_id")
        .in("subject_id", packSubjectIds);
      const subjectOfTopic = new Map((topics ?? []).map((t) => [t.id, t.subject_id]));
      const topicIds = (topics ?? []).map((t) => t.id);
      const bump = (sid: string | undefined, when: string | null | undefined) => {
        if (!sid || !when) return;
        const cur = lastUpdateBySubject.get(sid);
        if (!cur || when > cur) lastUpdateBySubject.set(sid, when);
      };
      if (topicIds.length) {
        const PAGE = 1000;
        for (let from = 0; ; from += PAGE) {
          const { data: cards } = await supabaseAdmin
            .from("flashcards")
            .select("topic_id, created_at")
            .in("topic_id", topicIds)
            .order("id", { ascending: true })
            .range(from, from + PAGE - 1);
          for (const c of cards ?? []) bump(subjectOfTopic.get(c.topic_id), c.created_at);
          if ((cards ?? []).length < PAGE) break;
        }
      }

      // Anotações e mapas mentais também contam como atualização da matéria.
      const { data: cats } = await supabaseAdmin
        .from("note_categories")
        .select("id, subject_id, topic_id")
        .or(
          [
            `subject_id.in.(${packSubjectIds.join(",")})`,
            topicIds.length ? `topic_id.in.(${topicIds.join(",")})` : "",
          ]
            .filter(Boolean)
            .join(","),
        );
      const subjectOfCategory = new Map<string, string>();
      for (const c of cats ?? []) {
        const sid = c.subject_id ?? (c.topic_id ? subjectOfTopic.get(c.topic_id) : undefined);
        if (sid) subjectOfCategory.set(c.id, sid);
      }
      const categoryIds = Array.from(subjectOfCategory.keys());
      if (categoryIds.length) {
        const [notes, media] = await Promise.all([
          supabaseAdmin.from("notes").select("category_id, updated_at").in("category_id", categoryIds),
          supabaseAdmin.from("note_media").select("category_id, created_at").in("category_id", categoryIds),
        ]);
        for (const n of notes.data ?? []) bump(subjectOfCategory.get(n.category_id ?? ""), n.updated_at);
        for (const m of media.data ?? []) bump(subjectOfCategory.get(m.category_id ?? ""), m.created_at);
      }
    }

    // Idioma de cada matéria, para o filtro por país na Loja.
    const langBySubject = new Map<string, string>();
    if (packSubjectIds.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: subs } = await supabaseAdmin
        .from("subjects")
        .select("id, language")
        .in("id", packSubjectIds);
      for (const s of subs ?? []) langBySubject.set(s.id, s.language ?? "pt");
    }

    return {
      isOwner,
      balance: availableBalance,
      products: productList.map((p) => ({
        ...p,
        contentUpdatedAt: p.access_subject_id ? (lastUpdateBySubject.get(p.access_subject_id) ?? null) : null,
        subjectLanguage: p.access_subject_id ? (langBySubject.get(p.access_subject_id) ?? "pt") : null,
      })),
      purchases: purchases.data ?? [],
    };
  });

/**
 * Libera um pacote sem compra para a conta do AppManager (guit1966@gmail.com).
 * Nenhum outro usuário consegue usar esta função.
 */
export const claimOwnerPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ productId: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }) => {
    if (!isAppManagerIdentity(context.claims)) throw new Error("Apenas o AppManager pode liberar pacotes.");

    const { data: product } = await context.supabase
      .from("store_products")
      .select("id, kind, validity_days")
      .eq("id", data.productId)
      .eq("is_active", true)
      .maybeSingle();
    if (!product || product.kind === "coins") throw new Error("Pacote não encontrado.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("user_purchases")
      .select("id, expires_at")
      .eq("user_id", context.userId)
      .eq("product_id", product.id)
      .eq("environment", "owner")
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const days = Number(product.validity_days ?? 365) || 365;
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    if (existing) {
      // Reaproveita o registro existente, sem apagar nada.
      if (new Date(existing.expires_at).getTime() > Date.now()) return { ok: true, expiresAt: existing.expires_at };
      await supabaseAdmin.from("user_purchases").update({ expires_at: expires }).eq("id", existing.id);
      return { ok: true, expiresAt: expires };
    }

    const { error } = await supabaseAdmin.from("user_purchases").insert({
      user_id: context.userId,
      product_id: product.id,
      environment: "owner",
      expires_at: expires,
    });
    if (error) throw new Error(error.message);
    return { ok: true, expiresAt: expires };
  });

/**
 * Relatório de clientes que compraram um pacote de matéria (só o AppManager acessa).
 * Mostra e-mail, data de aquisição e data de vencimento de cada acesso.
 */
export const packBuyers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ productId: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }) => {
    if (!isAppManagerIdentity(context.claims)) throw new Error("Apenas o AppManager pode ver este relatório.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("user_purchases")
      .select("user_id, purchased_at, expires_at, amount_cents, currency, environment")
      .eq("product_id", data.productId)
      .order("purchased_at", { ascending: false });
    if (error) throw new Error(error.message);

    const emails = new Map<string, string>();
    for (let page = 1; page <= 10; page++) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      for (const u of list?.users ?? []) emails.set(u.id, u.email ?? "");
      if (!list?.users?.length || list.users.length < 200) break;
    }

    const now = Date.now();
    return {
      buyers: (rows ?? []).map((r) => ({
        email: emails.get(r.user_id) ?? "—",
        purchasedAt: r.purchased_at,
        expiresAt: r.expires_at,
        active: new Date(r.expires_at).getTime() > now,
        amountCents: r.amount_cents ?? null,
        currency: r.currency ?? null,
        environment: r.environment,
      })),
    };
  });

/**
 * Cria a cobrança de uma matéria com nome próprio (matéria + idioma do comprador),
 * para que o checkout, a fatura em PDF e o e-mail do provedor mostrem claramente
 * o que foi comprado. Devolve o id da transação usado pelo checkout.
 */
export const createSubjectCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        productId: z.string().min(1),
        lang: z.string().min(2).max(10),
        environment: z.enum(["sandbox", "live"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { data: product } = await context.supabase
      .from("store_products")
      .select("id, name, kind, paddle_price_id")
      .eq("id", data.productId)
      .eq("is_active", true)
      .maybeSingle();
    if (!product || product.kind === "coins" || !product.paddle_price_id) {
      throw new Error("Matéria não encontrada na loja.");
    }

    const { gatewayFetch } = await import("@/lib/paddle.server");
    const { invoiceItemName, invoiceItemDescription } = await import("@/lib/invoice-labels");

    // O preço do catálogo é a fonte da verdade do valor e do produto no provedor.
    const priceRes = await gatewayFetch(
      data.environment,
      `/prices?external_id=${encodeURIComponent(product.paddle_price_id)}`,
    );
    if (!priceRes.ok) throw new Error(`Falha ao consultar o preço (${priceRes.status})`);
    const priceJson: any = await priceRes.json();
    const price = priceJson?.data?.[0];
    if (!price?.product_id || !price?.unit_price?.amount) throw new Error("Preço não encontrado.");

    const amountCents = parseInt(String(price.unit_price.amount), 10);
    const currency = String(price.unit_price.currency_code ?? "USD");

    const body = {
      currency_code: currency,
      collection_mode: "automatic",
      custom_data: {
        userId: context.userId,
        productId: product.id,
        priceId: product.paddle_price_id,
      },
      items: [
        {
          quantity: 1,
          price: {
            product_id: price.product_id,
            name: invoiceItemName(data.lang, product.name),
            description: invoiceItemDescription(data.lang, amountCents),
            tax_mode: price.tax_mode ?? "account_setting",
            unit_price: { amount: String(amountCents), currency_code: currency },
            quantity: { minimum: 1, maximum: 1 },
          },
        },
      ],
    };

    const txRes = await gatewayFetch(data.environment, "/transactions", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const txJson: any = await txRes.json().catch(() => null);
    if (!txRes.ok || !txJson?.data?.id) {
      console.error("[payments] falha ao criar transação", { status: txRes.status, body: txJson });
      throw new Error("Não foi possível iniciar o pagamento.");
    }
    return { transactionId: String(txJson.data.id) };
  });
