import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ensureDestinationForUser } from "./bulk-demo.server";
import { getPaddleEnvironment } from "./paddle";

const MAX_MATERIAL_ATTEMPTS = 2;
const MAX_MATERIAL_JOBS = 3;
const MATERIALS_WINDOW_MS = 7 * 24 * 3600 * 1000;
const REVIEW_WINDOW_MS = 48 * 3600 * 1000;

export type LandingMaterialsJob = {
  handoffId: string;
  topicId: string;
  lang: string;
  text: string;
  note: boolean;
  map: boolean;
  video: boolean;
  /** Content already generated on the landing, by card position; imported without AI. */
  generated: Record<string, LandingGeneratedCard>;
};

export type LandingGeneratedCard = {
  note?: { title: string; text: string };
  map?: { tree: Record<string, never> };
  video?: { scenes: Record<string, never>[] };
};

export type LandingFinalizeResult = {
  savedCards: number;
  subjectId: string | null;
  /** A landing test was saved into this account within the review window (even by an earlier call). */
  recentlySaved: boolean;
  materials: LandingMaterialsJob[];
};

type HandoffRow = {
  id: string;
  test_id: string;
  lang: string;
  subject: string | null;
  topic: string | null;
  source_text: string;
  want_note: boolean;
  want_map: boolean;
  want_video: boolean;
  topic_id: string | null;
  cards_saved_at: string | null;
  materials_done_at: string | null;
  materials_attempts: number;
  generated_materials: Record<string, LandingGeneratedCard> | null;
  created_at: string;
};

const HANDOFF_COLUMNS =
  "id, test_id, lang, subject, topic, source_text, want_note, want_map, want_video, topic_id, cards_saved_at, materials_done_at, materials_attempts, generated_materials, created_at";

/**
 * Moves every pending landing test of the signed-in user's email into the
 * account (subject, topic and cards) and reports which attachments still need
 * to be created. Idempotent: safe to call on every login and from any device.
 */
export async function finalizeLandingHandoffs(userId: string): Promise<LandingFinalizeResult> {
  const empty: LandingFinalizeResult = {
    savedCards: 0,
    subjectId: null,
    recentlySaved: false,
    materials: [],
  };
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (userError) throw userError;
  const email = (userData.user?.email ?? "").trim().toLowerCase();
  if (!email) return empty;

  const { data: visitor, error: visitorError } = await supabaseAdmin
    .from("landing_visitors")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (visitorError) throw visitorError;
  if (!visitor) return empty;

  // Unsaved tests first (oldest first), plus the most recent saved ones for
  // attachment retries. A single "oldest 10" query hid new tests from
  // visitors who had already run many tests.
  const [pendingQuery, savedQuery] = await Promise.all([
    supabaseAdmin
      .from("landing_visitor_handoffs")
      .select(HANDOFF_COLUMNS)
      .eq("visitor_id", visitor.id)
      .is("cards_saved_at", null)
      .order("created_at", { ascending: true })
      .limit(10),
    supabaseAdmin
      .from("landing_visitor_handoffs")
      .select(HANDOFF_COLUMNS)
      .eq("visitor_id", visitor.id)
      .not("cards_saved_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  if (pendingQuery.error) throw pendingQuery.error;
  if (savedQuery.error) throw savedQuery.error;
  const handoffs = [
    ...((savedQuery.data ?? []) as unknown as HandoffRow[]),
    ...((pendingQuery.data ?? []) as unknown as HandoffRow[]),
  ].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  if (!handoffs.length) return empty;

  const result: LandingFinalizeResult = { ...empty };
  const topicByHandoff = new Map<string, string>();

  for (const handoff of handoffs) {
    if (handoff.cards_saved_at) {
      if (handoff.topic_id) topicByHandoff.set(handoff.id, handoff.topic_id);
      continue;
    }
    const { data: cards, error: cardsError } = await supabaseAdmin
      .from("landing_visitor_cards")
      .select("question, answer, ordinal")
      .eq("visitor_id", visitor.id)
      .eq("test_id", handoff.test_id)
      .order("ordinal", { ascending: true });
    if (cardsError) throw cardsError;
    if (!cards?.length) continue;

    const destination = await ensureDestinationForUser(userId, {
      subjectName: handoff.subject ?? undefined,
      topicName: handoff.topic ?? undefined,
      language: handoff.lang,
      cards: cards.map((card) => ({ question: card.question, answer: card.answer })),
    });
    const { error: saveError } = await supabaseAdmin.rpc("save_flashcards_atomically", {
      p_user_id: userId,
      p_action_id: handoff.id,
      p_cards: cards.map((card, index) => ({
        topic_id: destination.topicId,
        question: card.question,
        answer: card.answer,
        card_format: "plain",
        reviewed: false,
        order_index: index,
        language: handoff.lang,
      })),
      p_environment: getPaddleEnvironment(),
    });
    if (saveError) throw new Error(saveError.message);

    const nowIso = new Date().toISOString();
    await supabaseAdmin
      .from("landing_visitor_handoffs")
      .update({ user_id: userId, topic_id: destination.topicId, cards_saved_at: nowIso })
      .eq("id", handoff.id);
    await supabaseAdmin
      .from("landing_visitors")
      .update({ claimed_user_id: userId, claimed_at: nowIso })
      .eq("id", visitor.id);
    handoff.topic_id = destination.topicId;
    handoff.cards_saved_at = nowIso;
    topicByHandoff.set(handoff.id, destination.topicId);
    result.savedCards += cards.length;
    result.subjectId = destination.subjectId;
  }

  result.recentlySaved = handoffs.some(
    (handoff) =>
      handoff.cards_saved_at && Date.now() - Date.parse(handoff.cards_saved_at) < REVIEW_WINDOW_MS,
  );

  const wantsMaterials = (handoff: HandoffRow) =>
    handoff.want_note || handoff.want_map || handoff.want_video;
  // Material já presente no app (criado antes, em outro aparelho ou numa tentativa interrompida) não é recriado nem anunciado.
  for (const handoff of handoffs) {
    const topicId = topicByHandoff.get(handoff.id);
    if (
      !topicId ||
      !handoff.cards_saved_at ||
      handoff.materials_done_at ||
      !wantsMaterials(handoff)
    )
      continue;
    if (await landingMaterialsAlreadyPresent(topicId, handoff)) {
      handoff.materials_done_at = new Date().toISOString();
      await supabaseAdmin
        .from("landing_visitor_handoffs")
        .update({ materials_done_at: handoff.materials_done_at })
        .eq("id", handoff.id);
    }
  }

  const pendingHandoffs = [...handoffs]
    .reverse()
    .filter(
      (handoff) =>
        handoff.cards_saved_at &&
        !handoff.materials_done_at &&
        (handoff.want_note || handoff.want_map || handoff.want_video) &&
        handoff.materials_attempts < MAX_MATERIAL_ATTEMPTS &&
        Date.now() - Date.parse(handoff.created_at) < MATERIALS_WINDOW_MS &&
        topicByHandoff.has(handoff.id),
    )
    .slice(0, MAX_MATERIAL_JOBS);
  for (const pending of pendingHandoffs) {
    let text = pending.source_text.trim();
    if (text.length < 40) {
      const { data: cards } = await supabaseAdmin
        .from("landing_visitor_cards")
        .select("question, answer")
        .eq("visitor_id", visitor.id)
        .eq("test_id", pending.test_id)
        .order("ordinal", { ascending: true });
      text = (cards ?? []).map((card) => `${card.question}\n${card.answer}`).join("\n\n");
    }
    result.materials.push({
      handoffId: pending.id,
      topicId: topicByHandoff.get(pending.id)!,
      lang: pending.lang,
      text: text.slice(0, 15_000),
      note: pending.want_note,
      map: pending.want_map,
      video: pending.want_video,
      generated: pending.generated_materials ?? {},
    });
  }
  return result;
}

/** True when every kind the visitor asked for already exists in the topic. */
async function landingMaterialsAlreadyPresent(
  topicId: string,
  wants: { want_note: boolean; want_map: boolean; want_video: boolean },
): Promise<boolean> {
  const { data: cards, error } = await supabaseAdmin
    .from("flashcards")
    .select("id, linked_note_id, image_url")
    .eq("topic_id", topicId)
    .order("order_index", { ascending: true })
    .limit(50);
  if (error || !cards?.length) return false;
  if (wants.want_note && !cards.some((card) => card.linked_note_id)) return false;
  if (wants.want_map && !cards.some((card) => card.image_url)) return false;
  if (wants.want_video) {
    const { count, error: videoError } = await supabaseAdmin
      .from("card_videos")
      .select("id", { count: "exact", head: true })
      .in(
        "card_id",
        cards.map((card) => card.id),
      );
    if (videoError || !count) return false;
  }
  return true;
}

/** "start" conta a tentativa antes de gerar (um recarregamento no meio não repete para sempre); "finish" grava o resultado. */
export async function recordLandingMaterialsAttempt(
  userId: string,
  handoffId: string,
  phase: "start" | "finish",
  done = false,
) {
  const { data: row, error } = await supabaseAdmin
    .from("landing_visitor_handoffs")
    .select("materials_attempts")
    .eq("id", handoffId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!row) return;
  await supabaseAdmin
    .from("landing_visitor_handoffs")
    .update(
      phase === "start"
        ? { materials_attempts: row.materials_attempts + 1 }
        : { materials_done_at: done ? new Date().toISOString() : null },
    )
    .eq("id", handoffId)
    .eq("user_id", userId);
}

/** Saves a video script generated on the landing for one of the user's own cards; narration is rendered and cached on first play. */
export async function importLandingCardVideo(
  userId: string,
  cardId: string,
  lang: string,
  rawScenes: unknown,
) {
  const { normalizeScenes } = await import("./card-video");
  const scenes = normalizeScenes({ scenes: rawScenes });
  if (!scenes.length) throw new Error("landing_video_invalid");
  const { data: card, error: cardError } = await supabaseAdmin
    .from("flashcards")
    .select("id")
    .eq("id", cardId)
    .eq("user_id", userId)
    .maybeSingle();
  if (cardError) throw cardError;
  if (!card) throw new Error("landing_video_card_missing");
  const { data: existing } = await supabaseAdmin
    .from("card_videos")
    .select("id")
    .eq("card_id", cardId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (existing) return { id: existing.id };
  const { data: row, error } = await supabaseAdmin
    .from("card_videos")
    .insert({
      user_id: userId,
      card_id: cardId,
      is_official: false,
      lang,
      style: "both",
      scenes,
      transcript: scenes.map((scene) => scene.speech).join("\n\n"),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: row.id };
}
