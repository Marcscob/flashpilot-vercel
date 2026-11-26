import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAppManagerIdentity } from "./app-manager";
import { CurationReviewSchema, selectedMaterials } from "./community-curation";

function assertManager(claims: unknown) {
  if (!isAppManagerIdentity(claims)) throw new Error("Área restrita ao AppManager.");
}

export const listCommunityCuration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertManager(context.claims);
    const { data, error } = await context.supabase.from("community_curation").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const prepareCommunityCuration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ limit: z.number().int().min(1).max(20).default(10) }).parse(data))
  .handler(async ({ context, data }) => {
    assertManager(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { pendingCards } = await import("./ugc.functions");
    const { prepareCuratedFlashcard, auditChars } = await import("./ugc.server");
    const { recordAiUsage } = await import("./ai-credits.server");
    const { runWithAiGenerationLease } = await import("./ai-quota.server");
    const candidates = await pendingCards(200, true);
    const { data: existing, error } = await supabaseAdmin.from("community_curation").select("source_card_id").in("source_card_id", candidates.map(c => c.id));
    if (error) throw new Error(error.message);
    const seen = new Set((existing ?? []).map(c => c.source_card_id));
    const cards = candidates.filter(c => !seen.has(c.id)).slice(0, data.limit);
    return runWithAiGenerationLease({ userId: context.userId, actionId: crypto.randomUUID() }, async signal => {
      let prepared = 0;
      const errors: string[] = [];
      for (const card of cards) {
        try {
          const verdict = await prepareCuratedFlashcard({ ...card, signal });
          if (signal.aborted) throw new Error("Auditoria interrompida.");
          const { eligible, risk, reason, ...draft } = verdict;
          const { error: insertError } = await supabaseAdmin.from("community_curation").upsert({
            ...draft, source_card_id: card.id, source_question: card.question, source_answer: card.answer,
            eligible, risk, audit_reason: reason,
          }, { onConflict: "source_card_id", ignoreDuplicates: true });
          if (insertError) throw new Error(insertError.message);
          prepared++;
          await recordAiUsage(context.userId, "chat", auditChars(card.question, card.answer));
        } catch (e) {
          if (signal.aborted) throw e;
          errors.push(e instanceof Error ? e.message : "Falha na auditoria.");
        }
      }
      return { prepared, errors };
    });
  });

export const reviewCommunityCuration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CurationReviewSchema.parse(data))
  .handler(async ({ context, data }) => {
    assertManager(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, version, decision, reviewNotes, rightsNotes, rightsConfirmed, materials, ...draft } = data;
    const { data: officialCardId, error } = await supabaseAdmin.rpc("review_community_curation", {
      p_id: id, p_version: version, p_reviewer: context.userId, p_decision: decision,
      p_draft: draft, p_notes: reviewNotes, p_rights: rightsNotes, p_confirmed: rightsConfirmed,
    });
    if (error) throw new Error(error.message);
    let copied: string[] = [];
    if (decision === "approve" && officialCardId) {
      copied = await copyCuratedMaterials(supabaseAdmin, id, officialCardId as string, context.userId, materials);
    }
    return { officialCardId, copied };
  });
type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
const MAP_BUCKET = "flashcard-mindmaps";

async function loadSourceMaterials(admin: Admin, curationId: string) {
  const { data: cur, error } = await admin.from("community_curation").select("source_card_id").eq("id", curationId).single();
  if (error || !cur) throw new Error("Candidato não encontrado.");
  const { data: card } = await admin.from("flashcards").select("id, linked_note_id, image_url, card_format, video_url_1, video_url_2").eq("id", cur.source_card_id).maybeSingle();
  if (!card) return null;
  const note = card.linked_note_id ? (await admin.from("notes").select("id, title, content_html").eq("id", card.linked_note_id).maybeSingle()).data : null;
  const { data: videos } = await admin.from("card_videos").select("*").eq("card_id", card.id).order("created_at", { ascending: false });
  const links = [card.video_url_1, card.video_url_2].filter((v): v is string => !!v && v.trim() !== "");
  const map = card.card_format !== "imagepilot" && card.image_url ? card.image_url : null;
  return { card, note, map, links, videos: videos ?? [] };
}

/** Lists the student's materials so the curator can tick them one by one. */
export const listCurationMaterials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    assertManager(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const src = await loadSourceMaterials(supabaseAdmin, data.id);
    if (!src) return { note: null, mapUrl: null, links: [] as string[], videos: [] as { id: string; style: string; lang: string; transcript: string }[] };
    let mapUrl: string | null = null;
    if (src.map) mapUrl = (await supabaseAdmin.storage.from(MAP_BUCKET).createSignedUrl(src.map, 3600)).data?.signedUrl ?? null;
    return {
      note: src.note ? { title: src.note.title, html: src.note.content_html.slice(0, 20000) } : null,
      mapUrl, links: src.links,
      videos: src.videos.map(v => ({ id: v.id, style: v.style, lang: v.lang, transcript: v.transcript })),
    };
  });

async function copyCuratedMaterials(admin: Admin, curationId: string, officialCardId: string, managerId: string, pick: { note: boolean; map: boolean; links: boolean; videoIds: string[] }) {
  const src = await loadSourceMaterials(admin, curationId);
  if (!src) return [];
  const sel = selectedMaterials(pick, { note: !!src.note, map: !!src.map, links: src.links.length > 0, videoIds: src.videos.map(v => v.id) });
  const { data: official } = await admin.from("flashcards").select("topic_id").eq("id", officialCardId).single();
  const patch: { linked_note_id?: string; image_url?: string; image_category_id?: string | null; video_url_1?: string | null; video_url_2?: string | null } = {};
  const copied: string[] = [];
  let categoryId: string | null = null;
  if (official && (sel.note || sel.map)) {
    const { data: cat } = await admin.from("note_categories").select("id").eq("user_id", managerId).eq("topic_id", official.topic_id).order("created_at").limit(1).maybeSingle();
    categoryId = cat?.id ?? null;
  }
  if (sel.note && src.note) {
    const { data: n, error } = await admin.from("notes").insert({ user_id: managerId, title: src.note.title, content_html: src.note.content_html, category_id: categoryId }).select("id").single();
    if (error) throw new Error(`Card aprovado, mas a anotação não foi copiada: ${error.message}`);
    patch.linked_note_id = n.id; copied.push("note");
  }
  if (sel.map && src.map) {
    const ext = (src.map.split(".").pop() || "png").replace(/[^a-z0-9]/gi, "") || "png";
    const dest = `${managerId}/${categoryId ?? "curated"}/${crypto.randomUUID()}.${ext}`;
    const { error } = await admin.storage.from(MAP_BUCKET).copy(src.map, dest);
    if (error) throw new Error(`Card aprovado, mas o mapa não foi copiado: ${error.message}`);
    patch.image_url = dest; patch.image_category_id = categoryId; copied.push("map");
  }
  if (sel.links) { patch.video_url_1 = src.links[0] ?? null; patch.video_url_2 = src.links[1] ?? null; copied.push("links"); }
  if (Object.keys(patch).length) {
    const { error } = await admin.from("flashcards").update(patch).eq("id", officialCardId);
    if (error) throw new Error(`Card aprovado, mas os materiais não foram ligados: ${error.message}`);
  }
  const videos = src.videos.filter(v => sel.videoIds.includes(v.id));
  if (videos.length) {
    const { error } = await admin.from("card_videos").insert(videos.map(v => ({
      user_id: managerId, card_id: officialCardId, is_official: true, lang: v.lang, style: v.style, scenes: v.scenes,
      transcript: v.transcript, transcript_note: v.transcript_note, audio_storage_path: v.audio_storage_path, audio_voice: v.audio_voice, audio_mime: v.audio_mime,
    })));
    if (error) throw new Error(`Card aprovado, mas os vídeos não foram copiados: ${error.message}`);
    copied.push(...videos.map(() => "video"));
  }
  return copied;
}
