import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhook, EventName, type PaddleEnv } from "@/lib/paddle.server";
import { subscriptionCatalogIds, subscriptionCoinGrant } from "@/lib/payment-catalog";

async function getSupabase() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function assertDatabaseSuccess(
  label: string,
  result: { error?: { message?: string } | null },
) {
  if (result.error) {
    console.error(`[webhook] ${label} falhou`, result.error);
    throw new Error(`${label}: ${result.error.message ?? "erro de banco"}`);
  }
}

async function handleSubscriptionCreated(data: any, env: PaddleEnv) {
  const { id, customerId, items, status, currentBillingPeriod, customData } = data;
  const userId = customData?.userId;
  if (!userId) {
    console.error("No userId in customData");
    return;
  }
  const item = items?.[0];
  const ids = subscriptionCatalogIds(item, env);
  if (!ids) {
    console.warn("Skipping subscription: missing importMeta.externalId", {
      rawPriceId: item?.price?.id,
      rawProductId: item?.product?.id,
    });
    return;
  }
  const { priceId, productId } = ids;
  const result = await (await getSupabase())
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        paddle_subscription_id: id,
        paddle_customer_id: customerId,
        product_id: productId,
        price_id: priceId,
        status,
        current_period_start: currentBillingPeriod?.startsAt,
        current_period_end: currentBillingPeriod?.endsAt,
        environment: env,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "paddle_subscription_id" },
    );
  assertDatabaseSuccess("gravar assinatura criada", result);

  if (status === "active" || status === "trialing") {
    await sendSubscriberWelcomeEmailIfNeeded(userId, priceId);
  }
}

/**
 * E-mail de boas-vindas ao assinante: enviado uma única vez na vida do usuário
 * quando ele se torna assinante (inclui quem assina durante o próprio
 * período de teste). Distinto da régua de reengajamento/encerramento do
 * teste, que nunca é enviada a assinantes.
 */
async function sendSubscriberWelcomeEmailIfNeeded(userId: string, priceId?: string | null) {
  const supabase = await getSupabase();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("subscriber_welcome_email_sent_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileError) {
    console.error("Failed to load subscriber-welcome email status", profileError);
    throw new Error(`consultar status do e-mail de boas-vindas: ${profileError.message}`);
  }
  if (profile?.subscriber_welcome_email_sent_at) return;

  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
  const email = userData?.user?.email;
  if (userError) {
    console.error("Failed to load subscriber email", userError);
    throw new Error(`consultar e-mail do assinante: ${userError.message}`);
  }
  if (!email) return;

  try {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const isPro2 = priceId === "pro_2_monthly" || priceId === "pro_2_yearly";
    await sendTemplateEmail("subscriber-welcome", email, {
      idempotencyKey: `subscriber-welcome-${userId}`,
      templateData: {
        planName: isPro2 ? "FlashPilot Pro 2" : "FlashPilot Pro",
        isPro2,
      },
    });
  } catch (sendError) {
    console.error("Failed to send subscriber-welcome email", sendError);
    throw sendError;
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ subscriber_welcome_email_sent_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (updateError) {
    console.error("Failed to mark subscriber-welcome email as sent", updateError);
    throw new Error(`marcar e-mail de boas-vindas: ${updateError.message}`);
  }
}

async function handleSubscriptionUpdated(data: any, env: PaddleEnv) {
  const { id, status, currentBillingPeriod, scheduledChange, items } = data;
  const item = items?.[0];
  const ids = subscriptionCatalogIds(item, env);
  const priceId = ids?.priceId;
  const productId = ids?.productId;
  const update: {
    status: string;
    current_period_start?: string | null;
    current_period_end?: string | null;
    cancel_at_period_end: boolean;
    updated_at: string;
    price_id?: string;
    product_id?: string;
  } = {
    status,
    current_period_start: currentBillingPeriod?.startsAt,
    current_period_end: currentBillingPeriod?.endsAt,
    cancel_at_period_end: scheduledChange?.action === "cancel",
    updated_at: new Date().toISOString(),
  };
  if (priceId) update.price_id = priceId;
  if (productId) update.product_id = productId;
  const result = await (await getSupabase())
    .from("subscriptions")
    .update(update)
    .eq("paddle_subscription_id", id)
    .eq("environment", env);
  assertDatabaseSuccess("atualizar assinatura", result);

  if (status === "active" || status === "trialing") {
    const userId = await findUserBySubscription(id, env);
    if (userId) await sendSubscriberWelcomeEmailIfNeeded(userId, priceId);
  }
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  const result = await (await getSupabase())
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("paddle_subscription_id", data.id)
    .eq("environment", env);
  assertDatabaseSuccess("cancelar assinatura", result);
}

async function handleTransactionCompleted(data: any, env: PaddleEnv) {
  // Só pagamento aprovado libera algo. Qualquer outro estado é ignorado.
  const status = String(data?.status ?? "completed");
  if (status !== "completed" && status !== "paid") return;
  const userId =
    data.customData?.userId ?? (await findUserBySubscription(data.subscriptionId, env));
  if (!userId) {
    console.error("[webhook] transação sem usuário", { transactionId: data.id });
    return;
  }
  const item = data.items?.[0];
  // Cobranças criadas pelo app têm preço avulso (nome amigável na fatura) e o aviso
  // do provedor não traz o identificador do catálogo: a resolução tenta vários caminhos.
  const { resolveCatalogPriceId } = await import("@/lib/payment-resolve.server");
  const priceId = await resolveCatalogPriceId({
    admin: await getSupabase(),
    env,
    transactionId: String(data.id ?? ""),
    item,
    customData: data.customData,
  });
  if (!priceId) {
    // Não engolir pagamento aprovado: erro força o provedor a reenviar o aviso.
    console.error("[webhook] não foi possível identificar o item pago", {
      transactionId: data.id,
      userId,
    });
    throw new Error("item pago não identificado");
  }
  const productId = item?.price?.productId ?? "";
  const amountCents = data.details?.totals?.total ? parseInt(data.details.totals.total, 10) : null;
  const { must, applyStoreEffects } = await import("@/lib/store-fulfillment.server");
  must(
    "registrar pagamento",
    await (await getSupabase()).from("purchases").upsert(
      {
        user_id: userId,
        paddle_transaction_id: data.id,
        product_id: productId,
        price_id: priceId,
        amount_cents: amountCents,
        currency: data.currencyCode ?? null,
        environment: env,
      },
      { onConflict: "paddle_transaction_id" },
    ),
    { transactionId: data.id, userId },
  );

  // Assinatura Pro: cada cobrança (contratação ou renovação) credita FlashCoins.
  // Idempotente pelo id da transação dentro de apply_flashcoins.
  if (data.subscriptionId) {
    const coins = subscriptionCoinGrant(priceId);
    if (coins > 0) {
      must(
        "creditar FlashCoins da assinatura",
        await (await getSupabase()).rpc("apply_flashcoins", {
          p_user_id: userId,
          p_amount: coins,
          p_reason: "subscription",
          p_action_id: priceId,
          p_transaction_id: data.id,
        }),
        { transactionId: data.id, userId },
      );
    }
    return;
  }

  // Etapa 1 — loja: o mesmo evento libera pacote (365 dias) ou credita FlashCoins.
  await applyStoreEffects({
    client: await getSupabase(),
    userId,
    priceId,
    storeProductId: data.customData?.productId ?? null,
    transactionId: data.id,
    amountCents,
    currency: data.currencyCode ?? null,
    env,
  });
}

/** Acha o dono da assinatura quando a transação de renovação não traz customData. */
async function findUserBySubscription(
  subscriptionId: string | undefined,
  env: PaddleEnv,
): Promise<string | null> {
  if (!subscriptionId) return null;
  const { data, error } = await (await getSupabase())
    .from("subscriptions")
    .select("user_id")
    .eq("paddle_subscription_id", subscriptionId)
    .eq("environment", env)
    .maybeSingle();
  if (error) {
    console.error("Failed to find subscription owner", error);
    throw new Error(`consultar dono da assinatura: ${error.message}`);
  }
  return (data as any)?.user_id ?? null;
}

/** Reembolso aprovado: corta acesso da matéria e estorna FlashCoins. */
async function handleAdjustment(data: any, env: PaddleEnv) {
  const action = String(data?.action ?? "");
  const status = String(data?.status ?? "");
  if (action !== "refund" || status !== "approved") return;
  const transactionId = String(data?.transactionId ?? data?.transaction_id ?? "");
  const adjustmentId = String(data?.id ?? "");
  if (!transactionId || !adjustmentId) return;
  const { revokeForRefund } = await import("@/lib/refunds.server");
  await revokeForRefund(await getSupabase(), { transactionId, adjustmentId, env, adjustment: data });
}

async function handleWebhook(event: any, env: PaddleEnv) {
  switch (event.eventType) {
    case EventName.SubscriptionCreated:
      await handleSubscriptionCreated(event.data, env);
      break;
    case EventName.SubscriptionUpdated:
      await handleSubscriptionUpdated(event.data, env);
      break;
    case EventName.SubscriptionCanceled:
      await handleSubscriptionCanceled(event.data, env);
      break;
    case EventName.TransactionCompleted:
      await handleTransactionCompleted(event.data, env);
      break;
    case EventName.AdjustmentCreated:
    case EventName.AdjustmentUpdated:
      await handleAdjustment(event.data, env);
      break;
    default:
      console.log("Unhandled event:", event.eventType);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const environment = url.searchParams.get("env") || "sandbox";
        if (environment !== "sandbox" && environment !== "live") {
          return new Response("Invalid environment", { status: 400 });
        }
        const env: PaddleEnv = environment;

        let event: any;
        try {
          event = await verifyWebhook(request, env);
        } catch (e) {
          console.error("Webhook verification error:", e);
          return new Response("Invalid webhook", { status: 400 });
        }

        try {
          await handleWebhook(event, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook processing error:", e);
          return new Response("Webhook processing error", { status: 500 });
        }
      },
    },
  },
});
