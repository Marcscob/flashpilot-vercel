import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAppManagerIdentity } from "@/lib/app-manager";
import { getPaddleEnvironment } from "@/lib/paddle";

type SupabaseAdmin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

/** Aplica no app os reembolsos já aprovados no provedor (somente AppManager). */
export const reconcileRefunds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!isAppManagerIdentity(context.claims)) throw new Error("Apenas o AppManager pode executar isso.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { reconcileRefundsFromProvider } = await import("@/lib/refunds.server");

    type Out = { checked: number; packsRevoked: number; coinsReversed: number; error?: string };
    const empty: Out = { checked: 0, packsRevoked: 0, coinsReversed: 0 };
    const run = async (env: "sandbox" | "live"): Promise<Out> => {
      try {
        return await reconcileRefundsFromProvider(supabaseAdmin, env);
      } catch (e) {
        return { ...empty, error: e instanceof Error ? e.message : "falha" };
      }
    };
    return { sandbox: await run("sandbox"), live: await run("live") };
  });

/** Aplica no app as compras já pagas no provedor que não foram liberadas (somente AppManager). */
export const reconcilePurchases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!isAppManagerIdentity(context.claims)) throw new Error("Apenas o AppManager pode executar isso.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { reconcilePurchasesFromProvider } = await import("@/lib/purchase-sync.server");

    type Out = { checked: number; recorded: number; coins: number; packs: number; skipped: number; error?: string };
    const empty: Out = { checked: 0, recorded: 0, coins: 0, packs: 0, skipped: 0 };
    const run = async (env: "sandbox" | "live"): Promise<Out> => {
      try {
        return await reconcilePurchasesFromProvider(supabaseAdmin, env);
      } catch (e) {
        return { ...empty, error: e instanceof Error ? e.message : "falha" };
      }
    };
    return { sandbox: await run("sandbox"), live: await run("live") };
  });

/**
 * Remove todos os objetos de storage sob a pasta do usuário num bucket
 * (`${userId}/...`), percorrendo subpastas e páginas. Qualquer falha aborta
 * a exclusão da conta para não deixar arquivos órfãos.
 */
async function purgeUserStorageFolder(
  admin: SupabaseAdmin,
  bucket: string,
  userId: string,
): Promise<void> {
  const storage = admin.storage.from(bucket);
  const pendingFolders = [userId];
  const files: string[] = [];

  while (pendingFolders.length) {
    const folder = pendingFolders.pop()!;
    let offset = 0;

    while (true) {
      const { data: entries, error } = await storage.list(folder, {
        limit: 1000,
        offset,
      });
      if (error) {
        throw new Error(`Falha ao listar Storage (${bucket}/${folder}): ${error.message}`);
      }
      if (!entries?.length) break;

      for (const entry of entries) {
        const path = `${folder}/${entry.name}`;
        // Entradas de pasta não têm id/metadata no retorno do Storage.
        if (entry.id === null) pendingFolders.push(path);
        else files.push(path);
      }

      if (entries.length < 1000) break;
      offset += entries.length;
    }
  }

  for (let offset = 0; offset < files.length; offset += 1000) {
    const { error } = await storage.remove(files.slice(offset, offset + 1000));
    if (error) {
      throw new Error(`Falha ao remover Storage (${bucket}): ${error.message}`);
    }
  }
}

/**
 * Exclusão definitiva da conta (LGPD).
 * Guarda apenas o registro fiscal das compras e apaga tudo o mais.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ confirm: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const normalized = data.confirm.trim().toUpperCase();
    if (normalized !== "EXCLUIR" && normalized !== "DELETE") {
      throw new Error("Confirmação inválida.");
    }
    if (isAppManagerIdentity(context.claims)) throw new Error("A conta do AppManager não pode ser excluída.");

    const email = String((context.claims as any)?.email ?? "").toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // 1) Arquiva o histórico de compras para fins fiscais.
    const [{ data: packs }, { data: txs }] = await Promise.all([
      supabaseAdmin
        .from("user_purchases")
        .select("product_id, price_id, paddle_transaction_id, amount_cents, currency, environment, purchased_at, expires_at, refunded_at")
        .eq("user_id", userId),
      supabaseAdmin
        .from("purchases")
        .select("product_id, price_id, paddle_transaction_id, amount_cents, currency, environment, created_at")
        .eq("user_id", userId),
    ]);

    const rows = [
      ...(packs ?? []).map((p: any) => ({
        former_user_id: userId,
        email,
        product_id: p.product_id,
        price_id: p.price_id,
        paddle_transaction_id: p.paddle_transaction_id,
        amount_cents: p.amount_cents,
        currency: p.currency,
        environment: p.environment,
        purchased_at: p.purchased_at,
        expires_at: p.expires_at,
        refunded_at: p.refunded_at,
        source: "user_purchases",
      })),
      ...(txs ?? []).map((p: any) => ({
        former_user_id: userId,
        email,
        product_id: p.product_id,
        price_id: p.price_id,
        paddle_transaction_id: p.paddle_transaction_id,
        amount_cents: p.amount_cents,
        currency: p.currency,
        environment: p.environment,
        purchased_at: p.created_at,
        source: "purchases",
      })),
    ];
    if (rows.length) await supabaseAdmin.from("billing_archive").insert(rows);

    // 2) Arquivos de storage (imagens de notas/mapas mentais) também não saem
    // em cascata do banco. Uma falha interrompe a exclusão antes de remover a
    // conta, evitando deixar arquivos órfãos e retidos para sempre.
    await Promise.all([
      purgeUserStorageFolder(supabaseAdmin, "note-images", userId),
      purgeUserStorageFolder(supabaseAdmin, "flashcard-mindmaps", userId),
    ]);

    // 3) Anotações não saem em cascata: apaga antes.
    await supabaseAdmin.from("notes").delete().eq("user_id", userId);
    await supabaseAdmin.from("note_categories").delete().eq("user_id", userId);

    // 4) Apaga a conta; o restante sai em cascata.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);

    return { ok: true, archived: rows.length };
  });

/**
 * Retrato do que já foi confirmado pelo provedor de pagamentos para este usuário.
 * Serve para o app esperar o webhook antes de mostrar o item como liberado.
 */
export const purchaseSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: purchases }] = await Promise.all([
      context.supabase
        .from("user_purchases")
        .select("product_id, purchased_at, expires_at")
        .in("environment", ["live", "owner", ...(process.env.PADDLE_ENV_INCLUDE_SANDBOX === "0" ? [] : ["sandbox"])])
        .is("refunded_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("purchased_at", { ascending: false })
        .limit(1),
    ]);
    const { getAvailableFlashcoins } = await import("./ai-quota.server");
    const availableBalance = await getAvailableFlashcoins(context.userId);
    const last = purchases?.[0];
    return {
      lastPurchaseAt: last?.purchased_at ?? null,
      lastProductId: last?.product_id ?? null,
      balance: availableBalance,
    };
  });

/**
 * Confirma no provedor o pagamento que o cliente acabou de concluir e aplica os
 * efeitos na hora, sem depender do aviso (webhook). Idempotente: o mesmo
 * pagamento nunca credita nem libera duas vezes.
 */
export const confirmCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        transactionId: z.string().min(6).max(80),
        environment: z.enum(["sandbox", "live"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.environment !== getPaddleEnvironment()) {
      return { ok: false as const, reason: "environment" as const };
    }

    const { gatewayFetch } = await import("@/lib/paddle.server");
    const res = await gatewayFetch(data.environment, `/transactions/${data.transactionId}`);
    if (!res.ok) return { ok: false as const, reason: "provider" as const };
    const json: any = await res.json();
    const tx = json?.data;
    const status = String(tx?.status ?? "");
    if (status !== "completed" && status !== "paid") {
      return { ok: false as const, reason: "pending" as const };
    }
    // Só o próprio comprador pode confirmar o pagamento.
    if (String(tx?.custom_data?.userId ?? "") !== context.userId) {
      return { ok: false as const, reason: "owner" as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveCatalogPriceId } = await import("@/lib/payment-resolve.server");
    const { applyStoreEffects, must } = await import("@/lib/store-fulfillment.server");

    const item = tx?.items?.[0];
    const priceId = await resolveCatalogPriceId({
      admin: supabaseAdmin,
      env: data.environment,
      transactionId: data.transactionId,
      item,
      customData: tx?.custom_data,
    });
    if (!priceId) return { ok: false as const, reason: "unknown-item" as const };

    const amountCents = tx?.details?.totals?.total
      ? parseInt(tx.details.totals.total, 10)
      : null;
    const currency = tx?.currency_code ?? null;

    must(
      "registrar pagamento",
      await supabaseAdmin.from("purchases").upsert(
        {
          user_id: context.userId,
          paddle_transaction_id: data.transactionId,
          product_id: item?.price?.product_id ?? "",
          price_id: priceId,
          amount_cents: amountCents,
          currency,
          environment: data.environment,
        } as any,
        { onConflict: "paddle_transaction_id" },
      ),
      { transactionId: data.transactionId },
    );

    if (tx?.subscription_id) return { ok: true as const, applied: null };

    const out = await applyStoreEffects({
      client: supabaseAdmin,
      userId: context.userId,
      priceId,
      storeProductId: tx?.custom_data?.productId ?? null,
      transactionId: data.transactionId,
      amountCents,
      currency,
      env: data.environment,
    });
    return { ok: true as const, applied: out.applied };
  });
