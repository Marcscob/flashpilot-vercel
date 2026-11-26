import { supabase } from "@/integrations/supabase/client";
import { generateStudyNote } from "@/lib/card-note.functions";
import { generateMindMap } from "@/lib/mindmap-generate.functions";
import { renderMindMapPng } from "@/lib/mindmap-render";
import { uploadMindMapImage } from "@/lib/mindmap-image";
import { generateCardVideo } from "@/lib/card-video.functions";
import { importLandingCardVideoFn } from "@/lib/landing-handoff.functions";
import type { LandingGeneratedCard } from "@/lib/landing-handoff.server";
import type { GeneratedVisitorCard } from "@/lib/landing-visitor.functions";

/** Pedido marcado na landing; executado automaticamente após o primeiro login. */
export const LANDING_MATERIALS_KEY = "flashpilot:landing-materials";
export const LANDING_VISITOR_HANDOFF_KEY = "flashpilot:landing-visitor-handoff";
export type LandingMaterialsRequest = {
  text: string;
  note: boolean;
  map: boolean;
  video: boolean;
  at: number;
};
export type LandingVisitorHandoff = {
  actionId: string;
  email: string;
  lang: string;
  text: string;
  cards: GeneratedVisitorCard[];
  subject?: string;
  topic?: string;
  note: boolean;
  map: boolean;
  video: boolean;
  at: number;
};

export function readLandingMaterials(): LandingMaterialsRequest | null {
  try {
    const raw = localStorage.getItem(LANDING_MATERIALS_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<LandingMaterialsRequest>;
    const parsed: LandingMaterialsRequest = {
      text: typeof stored.text === "string" ? stored.text : "",
      note: stored.note === true,
      map: stored.map === true,
      video: stored.video === true,
      at: typeof stored.at === "number" ? stored.at : 0,
    };
    if (!parsed.at || Date.now() - parsed.at > 3 * 24 * 3600 * 1000) {
      localStorage.removeItem(LANDING_MATERIALS_KEY);
      return null;
    }
    return (parsed.note || parsed.map || parsed.video) && parsed.text.trim().length >= 40
      ? parsed
      : null;
  } catch {
    return null;
  }
}

const LANDING_MATERIAL_PREF_KEY = "flashpilot:landing-material-pref";
const ALL_MATERIALS = { note: true, map: true, video: true };

// The landing is automatic by default: note, map and video are created for the
// first cards unless the visitor explicitly unchecked them. Independent of the source
// text, so every capture source (YouTube, files, photos, audio) gets them.
export function readLandingMaterialPreference(): { note: boolean; map: boolean; video: boolean } {
  try {
    const raw = localStorage.getItem(LANDING_MATERIAL_PREF_KEY);
    if (!raw) return { ...ALL_MATERIALS };
    const stored = JSON.parse(raw) as Partial<typeof ALL_MATERIALS>;
    return {
      note: stored.note !== false,
      map: stored.map !== false,
      video: stored.video !== false,
    };
  } catch {
    return { ...ALL_MATERIALS };
  }
}

export function saveLandingMaterialPreference(pref: typeof ALL_MATERIALS) {
  try {
    localStorage.setItem(LANDING_MATERIAL_PREF_KEY, JSON.stringify(pref));
  } catch {
    // Preference is optional.
  }
}

export function saveLandingVisitorHandoff(handoff: LandingVisitorHandoff) {
  localStorage.setItem(LANDING_VISITOR_HANDOFF_KEY, JSON.stringify(handoff));
}

export function readLandingVisitorHandoff(): LandingVisitorHandoff | null {
  try {
    const raw = localStorage.getItem(LANDING_VISITOR_HANDOFF_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<LandingVisitorHandoff>;
    if (
      typeof value.at !== "number" ||
      Date.now() - value.at > 3 * 24 * 3600 * 1000 ||
      typeof value.actionId !== "string" ||
      typeof value.email !== "string" ||
      typeof value.lang !== "string" ||
      typeof value.text !== "string" ||
      !Array.isArray(value.cards) ||
      value.cards.length < 1 ||
      value.cards.length > 10
    ) {
      localStorage.removeItem(LANDING_VISITOR_HANDOFF_KEY);
      return null;
    }
    return {
      actionId: value.actionId,
      email: value.email,
      lang: value.lang,
      text: value.text.slice(0, 15_000),
      subject: typeof value.subject === "string" ? value.subject.slice(0, 120) : undefined,
      topic: typeof value.topic === "string" ? value.topic.slice(0, 120) : undefined,
      cards: value.cards.filter(
        (card): card is GeneratedVisitorCard =>
          !!card &&
          typeof card.question === "string" &&
          typeof card.answer === "string" &&
          card.question.length <= 2000 &&
          card.answer.length <= 4000,
      ),
      note: value.note === true,
      map: value.map === true,
      video: value.video === true,
      at: value.at,
    };
  } catch {
    return null;
  }
}

export function clearLandingVisitorHandoff() {
  localStorage.removeItem(LANDING_VISITOR_HANDOFF_KEY);
}

function textToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/**
 * Cria a anotação e/ou o mapa mental pedidos na landing, no tópico criado
 * automaticamente com os flashcards, e vincula a anotação aos cards.
 */
export async function runLandingMaterials(
  req: LandingMaterialsRequest,
  lang: string,
  targetTopicId?: string,
  generated: Record<string, LandingGeneratedCard> = {},
) {
  const stored = Object.keys(generated)
    .map(Number)
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => a - b)
    .map((n) => generated[String(n)]);
  const storedNote = stored.find((g) => g?.note?.text)?.note;
  const storedMap = stored.find((g) => g?.map?.tree)?.map;
  if (!req.note && !req.map && !req.video) return { note: false, map: false, video: 0 };
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { note: false, map: false, video: 0 };
  let topicQuery = supabase.from("topics").select("id, subject_id").eq("user_id", u.user.id);
  if (targetTopicId) topicQuery = topicQuery.eq("id", targetTopicId);
  else topicQuery = topicQuery.order("created_at", { ascending: false }).limit(1);
  const { data: topic } = await topicQuery.maybeSingle();
  if (!topic) return { note: false, map: false, video: 0 };
  let categoryId: string | null = null;
  for (let i = 0; i < 5 && !categoryId; i++) {
    const { data: cat } = await supabase
      .from("note_categories")
      .select("id")
      .eq("topic_id", topic.id)
      .limit(1)
      .maybeSingle();
    categoryId = cat?.id ?? null;
    if (!categoryId) {
      const { data: sub } = await supabase
        .from("note_categories")
        .select("id")
        .eq("subject_id", topic.subject_id)
        .is("topic_id", null)
        .limit(1)
        .maybeSingle();
      categoryId = sub?.id ?? null;
    }
    if (!categoryId) await new Promise((r) => setTimeout(r, 1500));
  }
  const text = req.text.slice(0, 20_000);
  const done = { note: false, map: false, video: 0 };
  let noteId: string | null = null;
  if (req.note) {
    const { data: linkedCard, error: linkedCardError } = await supabase
      .from("flashcards")
      .select("linked_note_id")
      .eq("topic_id", topic.id)
      .not("linked_note_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (linkedCardError) throw linkedCardError;
    if (linkedCard?.linked_note_id) {
      noteId = linkedCard.linked_note_id;
    } else {
      const draft = storedNote ?? (await generateStudyNote({
        data: { actionId: crypto.randomUUID(), text, lang },
      }));
      const { data, error } = await supabase
        .from("notes")
        .insert({
          user_id: u.user.id,
          title: draft.title.slice(0, 200),
          content_html: textToHtml(draft.text),
          category_id: categoryId,
        })
        .select("id")
        .single();
      if (error) throw error;
      noteId = data.id;
      const { error: linkError } = await supabase
        .from("flashcards")
        .update({ linked_note_id: noteId })
        .eq("topic_id", topic.id)
        .is("linked_note_id", null);
      if (linkError) throw linkError;
    }
    done.note = true;
  }
  if (req.map) {
    if (!noteId) {
      const { data: noteCard } = await supabase
        .from("flashcards")
        .select("linked_note_id")
        .eq("topic_id", topic.id)
        .not("linked_note_id", "is", null)
        .limit(1)
        .maybeSingle();
      noteId = noteCard?.linked_note_id ?? null;
    }
    const { data: linkedMapCard, error: linkedMapCardError } = await supabase
      .from("flashcards")
      .select("image_url")
      .eq("topic_id", topic.id)
      .not("image_url", "is", null)
      .limit(1)
      .maybeSingle();
    if (linkedMapCardError) throw linkedMapCardError;
    if (!linkedMapCard?.image_url) {
      const tree =
        (storedMap?.tree as Awaited<ReturnType<typeof generateMindMap>>["tree"] | undefined) ??
        (
          await generateMindMap({
            data: {
              actionId: crypto.randomUUID(),
              source: "text",
              text,
              lang,
              detail: "normal",
              title: "",
            },
          })
        ).tree;
      const png = await renderMindMapPng(tree);
      const path = await uploadMindMapImage(
        new File([png], `${Date.now()}.png`, { type: "image/png" }),
        categoryId,
      );
      const { error } = await supabase.from("note_media").insert({
        user_id: u.user.id,
        kind: "mindmap",
        title: (tree.title || "Mapa mental").slice(0, 160),
        storage_path: path,
        url: JSON.stringify(tree),
        category_id: categoryId,
        note_id: noteId,
      });
      if (error) throw error;
      const { error: linkError } = await supabase
        .from("flashcards")
        .update({ image_url: path, image_category_id: categoryId })
        .eq("topic_id", topic.id)
        .is("image_url", null)
        .or("card_format.is.null,card_format.neq.imagepilot");
      if (linkError) throw linkError;
    }
    done.map = true;
  }
  if (req.video) {
    const { data: cards, error } = await supabase
      .from("flashcards")
      .select("id, question, answer")
      .eq("topic_id", topic.id)
      .order("order_index", { ascending: true })
      .limit(10);
    if (error) throw error;
    if (!cards?.length) return done;
    const { data: existingVideos, error: videosError } = await supabase
      .from("card_videos")
      .select("card_id")
      .in(
        "card_id",
        (cards ?? []).map((card) => card.id),
      );
    if (videosError) throw videosError;
    const cardsWithVideos = new Set((existingVideos ?? []).map((video) => video.card_id));
    for (const [index, card] of (cards ?? []).entries()) {
      if (cardsWithVideos.has(card.id)) continue;
      try {
        const storedScenes = generated[String(index)]?.video?.scenes;
        if (Array.isArray(storedScenes) && storedScenes.length) {
          await importLandingCardVideoFn({ data: { cardId: card.id, lang, scenes: storedScenes } });
        } else {
          await generateCardVideo({
            data: {
              actionId: crypto.randomUUID(),
              cardId: card.id,
              isOfficial: false,
              question: card.question,
              answer: card.answer,
              lang,
              style: "both",
            },
          });
        }
        done.video += 1;
      } catch (error) {
        // Cards are processed in order, so a quota/limit stop leaves the first cards covered.
        if (done.video === 0 && cardsWithVideos.size === 0) throw error;
        break;
      }
    }
  }
  return done;
}
