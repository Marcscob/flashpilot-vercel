import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { isProAiUser } from "./ai-quota.server";
import { validateAiImages } from "./ai-input-limits.server";

/** Um flashcard já gerado pelo PilotAI e guardado no banco durante o processamento. */
export type JobCard = {
  question: string;
  answer: string;
  image_index: number | null;
  generatedOutputId?: string;
};

export type DocumentJob = {
  action_id: string | null;
  created_at: string;
  id: string;
  document_name: string;
  status: "processing" | "completed" | "failed";
  mode: string;
  total_parts: number;
  processed_parts: number;
  requested_cards: number;
  failed_parts: number;
  cards_count: number;
  result_cards: JobCard[];
  input_slices: string[];
  input_images: string[];
  hint: string | null;
  focus: string | null;
  error_message: string | null;
  updated_at: string;
  expires_at: string;
  dismissed: boolean;
  user_id: string;
};

const COLS =
  "id, action_id, created_at, dismissed, user_id, document_name, status, mode, total_parts, processed_parts, requested_cards, failed_parts, cards_count, result_cards, input_slices, input_images, hint, focus, error_message, updated_at, expires_at";

function normalize(row: Database["public"]["Tables"]["document_jobs"]["Row"]): DocumentJob {
  return {
    ...row,
    result_cards: Array.isArray(row.result_cards) ? (row.result_cards as JobCard[]) : [],
    input_slices: Array.isArray(row.input_slices) ? (row.input_slices as string[]) : [],
    input_images: Array.isArray(row.input_images) ? (row.input_images as string[]) : [],
  } as DocumentJob;
}

/**
 * Cria o registro do processamento antes da primeira chamada do PilotAI.
 * Assim, se a aba fechar ou a conexão cair, o progresso já está no banco.
 */
const CreateJobInput = z.object({
  actionId: z.string().uuid(),
  documentName: z.string().max(500),
  mode: z.string().max(40),
  totalParts: z.number().int().min(1).max(100),
  requestedCards: z.number().int().min(1).max(2500),
  slices: z.array(z.string().max(150_000)).max(100),
  images: z.array(z.string().max(14_000_000)).max(20).optional(),
  hint: z.string().max(500).optional(),
  focus: z.string().max(2000).optional(),
});

const createDocumentJobFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((args: unknown) => CreateJobInput.parse(args))
  .handler(async ({ context, data }) => {
    const isPro = await isProAiUser(context.supabase, context.userId, context.claims);
    const maxTextChars = isPro ? 150_000 : 30_000;
    const maxParts = isPro ? 10 : 4;
    const maxCards = isPro ? 150 : 40;
    const textChars = data.slices.reduce((total, slice) => total + slice.length, 0);
    if (data.totalParts !== Math.max(data.slices.length, 1) || data.slices.length > maxParts) {
      throw new Error(
        `Um trabalho pode ter até ${maxParts} blocos no seu plano. Reduza o documento e tente novamente.`,
      );
    }
    if (textChars > maxTextChars) {
      throw new Error(
        `O documento excede o limite de ${maxTextChars.toLocaleString()} caracteres do seu plano.`,
      );
    }
    if (data.requestedCards > maxCards || data.requestedCards < data.totalParts) {
      throw new Error(
        `Escolha entre ${data.totalParts} e ${maxCards} flashcards para este processamento.`,
      );
    }
    validateAiImages(data.images ?? [], isPro);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: cleanupError } = await supabaseAdmin.rpc("delete_expired_document_jobs");
    if (cleanupError) throw cleanupError;

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("document_jobs")
      .select(COLS)
      .eq("user_id", context.userId)
      .eq("action_id", data.actionId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return normalize(existing);

    const { data: row, error } = await supabaseAdmin
      .from("document_jobs")
      .insert({
        user_id: context.userId,
        action_id: data.actionId,
        document_name: data.documentName,
        mode: data.mode,
        total_parts: data.totalParts,
        requested_cards: data.requestedCards,
        input_slices: data.slices,
        input_images: data.images ?? [],
        hint: data.hint ?? null,
        focus: data.focus ?? null,
        status: "processing",
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select(COLS)
      .single();
    if (error?.code === "23505") {
      const { data: duplicate, error: duplicateError } = await supabaseAdmin
        .from("document_jobs")
        .select(COLS)
        .eq("user_id", context.userId)
        .eq("action_id", data.actionId)
        .maybeSingle();
      if (duplicateError) throw duplicateError;
      if (duplicate) return normalize(duplicate);
    }
    if (error) throw error;
    return normalize(row);
  });

export async function createDocumentJob(args: {
  actionId: string;
  documentName: string;
  mode: string;
  totalParts: number;
  requestedCards: number;
  slices: string[];
  images?: string[];
  hint?: string;
  focus?: string;
}): Promise<DocumentJob> {
  return createDocumentJobFn({ data: args });
}

/** Grava o andamento (partes feitas e flashcards já gerados). */
const SaveProgressInput = z.object({
  id: z.string().uuid(),
  patch: z.object({
    processed_parts: z.number().int().min(0).optional(),
    failed_parts: z.number().int().min(0).optional(),
    cards: z
      .array(
        z.object({
          question: z.string().max(20_000),
          answer: z.string().max(40_000),
          image_index: z.number().int().min(0).nullable(),
          generatedOutputId: z.string().uuid().optional(),
        }),
      )
      .max(2500)
      .optional(),
    remaining_slices: z.array(z.string().max(200_000)).max(100).optional(),
    status: z.enum(["processing", "completed", "failed"]).optional(),
    error_message: z.string().max(2000).nullable().optional(),
  }),
});

const saveDocumentJobProgressFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveProgressInput.parse(input))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch = data.patch;
    const update: Database["public"]["Tables"]["document_jobs"]["Update"] = {};
    if (patch.processed_parts != null) update.processed_parts = patch.processed_parts;
    if (patch.failed_parts != null) update.failed_parts = patch.failed_parts;
    if (patch.cards) {
      update.result_cards = patch.cards;
      update.cards_count = patch.cards.length;
    }
    if (patch.remaining_slices) update.input_slices = patch.remaining_slices;
    if (patch.status) update.status = patch.status;
    if (patch.error_message !== undefined) update.error_message = patch.error_message;
    const { data: row, error } = await supabaseAdmin
      .from("document_jobs")
      .update(update)
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .eq("dismissed", false)
      .gt("expires_at", new Date().toISOString())
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("O trabalho não existe, expirou ou não pertence a esta conta.");
  });

export async function saveDocumentJobProgress(
  id: string,
  patch: z.infer<typeof SaveProgressInput>["patch"],
) {
  return saveDocumentJobProgressFn({ data: { id, patch } });
}

/** Último processamento ainda não dispensado pelo aluno. */
const fetchActiveDocumentJobFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("document_jobs")
      .select(COLS)
      .eq("user_id", context.userId)
      .eq("dismissed", false)
      .gt("expires_at", new Date().toISOString())
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? normalize(data) : null;
  });

export async function fetchActiveDocumentJob(): Promise<DocumentJob | null> {
  return fetchActiveDocumentJobFn({ data: undefined });
}

const discardDocumentJobFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.string().uuid().parse(data))
  .handler(async ({ context, data: id }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("discard_ai_generated_flashcard_job", {
      p_user_id: context.userId,
      p_job_id: id,
    });
    if (error) throw error;
  });

export async function discardDocumentJob(id: string) {
  return discardDocumentJobFn({ data: id });
}
