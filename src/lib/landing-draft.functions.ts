import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LANDING_LIMITS } from "./landing-rules";
import { getPaddleEnvironment } from "./paddle";
import { subnetForAddress } from "./welcome-kit-network";

/**
 * Onboarding da landing page: o visitante envia um texto, guardamos o rascunho
 * no backend (TTL de 24h) e enviamos um link de ativação com token. Na ativação
 * a conta é criada, o Kit de Boas-Vindas (40 FlashCoins) é concedido e a geração
 * dos flashcards debita 1 FlashCoin por card via save_flashcards_atomically.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CreateInput = z.object({
  actionId: z.string().uuid(),
  email: z
    .string()
    .trim()
    .max(320)
    .refine((v) => EMAIL_RE.test(v), "Invalid email"),
  fullName: z.string().trim().min(2).max(120),
  content: z.string().trim().min(1).max(15_000),
  lang: z.string().trim().min(2).max(35),
  wantNote: z.boolean().default(false),
  wantMap: z.boolean().default(false),
});

const TokenInput = z.object({
  token: z.string().trim().min(32).max(128),
  actionId: z.string().uuid(),
});

const ActivateInput = TokenInput.extend({
  password: z.string().min(8).max(128),
  deviceId: z.string().uuid(),
});

const ActionInput = z.object({ actionId: z.string().uuid() });

type DraftRow = {
  id: string;
  email: string;
  full_name: string | null;
  content: string;
  lang: string;
  token_hash: string;
  status: string;
  user_id: string | null;
  subject_id: string | null;
  error: string | null;
  expires_at: string;
};

async function sha256Hex(message: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Mesma chave do kit de boas-vindas (ver welcome-kit.functions.ts).
function welcomeKitHmacKeyMaterial(): string {
  const keyValue = process.env.WELCOME_KIT_HMAC_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!keyValue) throw new Error("Configuração de segurança indisponível.");
  return keyValue;
}

async function hmacSha256Hex(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(welcomeKitHmacKeyMaterial()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

const CLIENT_IP_HEADERS = ["cf-connecting-ip", "true-client-ip", "x-real-ip", "x-forwarded-for"];

function clientSubnetFromRequest(): string | null {
  const headers = getRequest()?.headers;
  if (!headers) return null;
  for (const name of CLIENT_IP_HEADERS) {
    const raw = headers.get(name);
    if (!raw) continue;
    for (const candidate of raw.split(",")) {
      const subnet = subnetForAddress(candidate.trim());
      if (subnet) return subnet;
    }
  }
  return null;
}

async function hashClientSubnet(userId: string): Promise<string> {
  const subnet = clientSubnetFromRequest();
  return subnet
    ? hmacSha256Hex(`welcome-kit-subnet:v1:${subnet}`)
    : hmacSha256Hex(`welcome-kit-subnet:v1:unresolved:${userId}`);
}

function requestOrigin(): string {
  try {
    const url = getRequest()?.url;
    if (url) return new URL(url).origin;
  } catch {
    /* fallback abaixo */
  }
  return "https://flashpilot.net";
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function findDraft(actionId: string): Promise<DraftRow | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("landing_drafts")
    .select(
      "id, email, full_name, content, lang, token_hash, status, user_id, subject_id, error, expires_at",
    )
    .eq("id", actionId)
    .maybeSingle();
  if (error) throw error;
  return (data as DraftRow | null) ?? null;
}

async function sendActivationEmail(draft: DraftRow, token: string): Promise<void> {
  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
  const activationUrl = `${requestOrigin()}/activate?token=${encodeURIComponent(token)}&actionId=${draft.id}`;
  await sendTemplateEmail("landing-activation", draft.email, {
    templateData: { lang: draft.lang, activationUrl, fullName: draft.full_name },
    idempotencyKey: `landing-activation-${draft.id}`,
  });
}

async function emailAlreadyRegistered(email: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("get_trial_status_by_email", { p_email: email });
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

/** Passo 1 da landing: guarda o rascunho e dispara o e-mail de ativação. */
export const createLandingDraft = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = normalizeEmail(data.email);

    // Idempotência: reenvio do mesmo actionId devolve o estado atual.
    const existing = await findDraft(data.actionId);
    if (existing) {
      return { existing: existing.status === "existing_user", actionId: existing.id };
    }

    const registered = await emailAlreadyRegistered(email);
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
    const { error } = await supabaseAdmin.from("landing_drafts").insert({
      id: data.actionId,
      email,
      full_name: data.fullName,
      content: data.content,
      lang: data.lang,
      want_note: data.wantNote,
      want_map: data.wantMap,
      token_hash: await sha256Hex(token),
      status: registered ? "existing_user" : "pending",
    });
    if (error) throw error;

    if (registered) {
      // Usuário já cadastrado: nada de e-mail; a landing aponta para o login.
      return { existing: true as const, actionId: data.actionId };
    }

    await sendActivationEmail((await findDraft(data.actionId)) as DraftRow, token);
    return { existing: false as const, actionId: data.actionId };
  });

/** Lê o rascunho para a tela /activate (sem expor conteúdo nem token). */
export const getLandingActivation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    const draft = await findDraft(data.actionId);
    if (!draft || draft.token_hash !== (await sha256Hex(data.token))) {
      return { valid: false as const, expired: false as const };
    }
    const expired = Date.parse(draft.expires_at) <= Date.now();
    if (expired || draft.status !== "pending") {
      return { valid: false as const, expired };
    }
    return {
      valid: true as const,
      expired: false as const,
      email: draft.email,
      fullName: draft.full_name,
    };
  });

/** Gera novo token e reenvia o link (usado na tela de link expirado). */
export const resendLandingActivation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const draft = await findDraft(data.actionId);
    if (!draft || draft.token_hash !== (await sha256Hex(data.token))) {
      throw new Error("Link inválido.");
    }
    if (draft.status !== "pending") throw new Error("Este pedido já foi ativado.");
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
    const { error } = await supabaseAdmin
      .from("landing_drafts")
      .update({
        token_hash: await sha256Hex(token),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", draft.id);
    if (error) throw error;
    await sendActivationEmail({ ...draft, token_hash: "" }, token);
    return { ok: true as const };
  });

/** Passo 2: cria a conta com senha, marca o aceite e concede o Kit de Boas-Vindas. */
export const activateLandingAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ActivateInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const draft = await findDraft(data.actionId);
    if (!draft || draft.token_hash !== (await sha256Hex(data.token))) {
      throw new Error("Link de ativação inválido.");
    }
    if (Date.parse(draft.expires_at) <= Date.now()) {
      throw new Error("Este link expirou. Solicite um novo.");
    }
    if (draft.status !== "pending") {
      throw new Error("Este pedido já foi ativado. Faça login para continuar.");
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: draft.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: draft.full_name ?? undefined,
        ui_lang: draft.lang,
        terms_accepted: true,
      },
    });
    if (createError) {
      if (/already|registered|exists/i.test(createError.message)) {
        throw new Error("Este e-mail já tem conta. Faça login para continuar.");
      }
      throw createError;
    }
    const userId = created.user.id;

    const { error: updateError } = await supabaseAdmin
      .from("landing_drafts")
      .update({ status: "activated", user_id: userId, activated_at: new Date().toISOString() })
      .eq("id", draft.id)
      .eq("status", "pending");
    if (updateError) throw updateError;

    try {
      await supabaseAdmin.rpc("grant_ai_welcome_kit", {
        p_user_id: userId,
        p_device_hash: await hmacSha256Hex(data.deviceId),
        p_subnet_hash: await hashClientSubnet(userId),
      });
    } catch (kitError) {
      console.error("Failed to grant welcome kit on landing activation", kitError);
    }

    return { ok: true as const, email: draft.email };
  });

/**
 * Passo 3: gera matéria/assunto/flashcards a partir do rascunho e debita
 * 1 FlashCoin por card (save_flashcards_atomically). Valida estritamente que
 * o e-mail do rascunho é o e-mail do usuário autenticado.
 */
export const processLandingDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ActionInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const draft = await findDraft(data.actionId);
    if (!draft) throw new Error("Rascunho não encontrado.");

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    if (userError) throw userError;
    const userEmail = normalizeEmail(userData.user?.email ?? "");
    if (!userEmail || draft.email !== userEmail) {
      throw new Error("Este rascunho pertence a outro e-mail.");
    }
    if (draft.user_id && draft.user_id !== context.userId) {
      throw new Error("Este rascunho pertence a outra conta.");
    }

    if (draft.status === "done") {
      return { status: "done" as const, subjectId: draft.subject_id };
    }
    if (draft.status === "pending" && Date.parse(draft.expires_at) <= Date.now()) {
      throw new Error("Este rascunho expirou. Envie o texto novamente pela página inicial.");
    }
    if (!draft.user_id) {
      await supabaseAdmin
        .from("landing_drafts")
        .update({ user_id: context.userId })
        .eq("id", draft.id);
    }

    // Marca como processing apenas se ainda não estava (evita corrida de duas abas).
    const { data: claimed } = await supabaseAdmin
      .from("landing_drafts")
      .update({ status: "processing", error: null })
      .eq("id", draft.id)
      .in("status", ["pending", "activated", "existing_user", "failed"])
      .select("id");
    if (!claimed?.length) {
      return { status: "processing" as const, subjectId: null };
    }

    try {
      const { createDocumentJob, saveDocumentJobProgress } = await import("./bulk-jobs");
      const { parseFlashcardsFromFile } = await import("./parse-cards-file.functions");

      const job = await createDocumentJob({
        actionId: draft.id,
        documentName: "Material enviado pela landing page",
        mode: "sample",
        totalParts: 1,
        requestedCards: LANDING_LIMITS.cards,
        slices: [draft.content],
        images: [],
        hint: "Material enviado pela landing page",
      });

      const result = await parseFlashcardsFromFile({
        data: {
          actionId: draft.id,
          jobId: job.id,
          requestedCards: LANDING_LIMITS.cards,
          text: draft.content,
          hint: "Material enviado pela landing page",
          mode: "sample",
          identifyDestination: true,
          outputLang: draft.lang,
        },
      });
      if (!result.cards.length) throw new Error("O PilotAI não conseguiu gerar cards deste texto.");

      const { resolveDestinationNames } = await import("./destination-names.server");
      const resolved = await resolveDestinationNames({
        subject: result.destination?.subject,
        topic: result.destination?.topic,
        cards: result.cards
          .slice(0, 12)
          .map((card) => ({ question: card.question, answer: card.answer })),
        lang: draft.lang,
      });
      const subjectName = resolved.subject;
      const topicName = resolved.topic;
      const { data: subject, error: subjectError } = await supabaseAdmin
        .from("subjects")
        .insert({ user_id: context.userId, name: subjectName, language: draft.lang })
        .select("id")
        .single();
      if (subjectError) throw subjectError;
      const { data: topic, error: topicError } = await supabaseAdmin
        .from("topics")
        .insert({
          user_id: context.userId,
          subject_id: subject.id,
          parent_id: null,
          name: topicName,
        })
        .select("id")
        .single();
      if (topicError) throw topicError;

      const { error: saveError } = await supabaseAdmin.rpc("save_flashcards_atomically", {
        p_user_id: context.userId,
        p_action_id: crypto.randomUUID(),
        p_cards: result.cards.slice(0, LANDING_LIMITS.cards).map((card, index) => ({
          topic_id: topic.id,
          question: card.question,
          answer: card.answer,
          card_format: "plain",
          reviewed: false,
          order_index: index,
          generated_job_id: job.id,
          generated_output_id: card.generatedOutputId ?? null,
        })),
        p_environment: getPaddleEnvironment(),
      });
      if (saveError) throw saveError;

      await saveDocumentJobProgress(job.id, {
        processed_parts: 1,
        cards: result.cards.slice(0, LANDING_LIMITS.cards).map((card) => ({
          question: card.question,
          answer: card.answer,
          image_index: card.image_index ?? null,
          generatedOutputId: card.generatedOutputId,
        })),
        status: "completed",
      });

      await supabaseAdmin
        .from("landing_drafts")
        .update({ status: "done", subject_id: subject.id, processed_at: new Date().toISOString() })
        .eq("id", draft.id);
      return { status: "done" as const, subjectId: subject.id };
    } catch (processError) {
      const message =
        processError instanceof Error
          ? processError.message.slice(0, 2000)
          : "Falha no processamento.";
      await supabaseAdmin
        .from("landing_drafts")
        .update({ status: "failed", error: message })
        .eq("id", draft.id);
      throw processError;
    }
  });

/** Polling da tela de revisão: status do rascunho do próprio usuário. */
export const getLandingDraftStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ActionInput.parse(input))
  .handler(async ({ data, context }) => {
    const draft = await findDraft(data.actionId);
    if (!draft) return { status: "missing" as const, subjectId: null, error: null };
    const callerEmail =
      typeof context.claims?.email === "string" ? context.claims.email.trim().toLowerCase() : "";
    const owns = draft.user_id
      ? draft.user_id === context.userId
      : !!callerEmail && draft.email?.trim().toLowerCase() === callerEmail;
    if (!owns) {
      return { status: "missing" as const, subjectId: null, error: null };
    }
    return {
      status: draft.status,
      subjectId: draft.subject_id,
      error: draft.error,
    };
  });

/**
 * Entrega uma única vez o pedido de anotação/mapa feito na landing, para o
 * dono do rascunho já processado. Fica no servidor porque o link do e-mail
 * pode abrir em outro navegador.
 */
export const claimLandingMaterials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ActionInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("landing_drafts")
      .select("id, content, lang, want_note, want_map")
      .eq("id", data.actionId)
      .eq("user_id", context.userId)
      .eq("status", "done")
      .maybeSingle();
    if (error) throw error;
    if (!row || (!row.want_note && !row.want_map)) return null;
    const { data: claimed } = await supabaseAdmin
      .from("landing_drafts")
      .update({ want_note: false, want_map: false })
      .eq("id", row.id)
      .or("want_note.eq.true,want_map.eq.true")
      .select("id");
    if (!claimed?.length) return null;
    return {
      content: row.content as string,
      lang: row.lang as string,
      note: row.want_note,
      map: row.want_map,
    };
  });
