import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ScopeInput, resolveScope, countCards, type SupabaseCtx } from "./notebooks.helpers.server";

export const listNotebooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as SupabaseCtx;
    const { data, error } = await supabase
      .from("study_notebooks")
      .select("*")
      .eq("user_id", userId)
      .order("last_studied_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const out = [];
    for (const nb of data ?? []) {
      const scope = await resolveScope({ supabase, userId }, nb.id);
      const totalCards = await countCards({ supabase, userId }, scope);
      out.push({
        id: nb.id as string,
        name: nb.name as string,
        mode: nb.mode as string,
        order_mode: nb.order_mode as string,
        current_card_id: (nb.current_card_id ?? null) as string | null,
        reviewed_count: ((nb.reviewed_card_ids ?? []) as string[]).length,
        last_studied_at: (nb.last_studied_at ?? null) as string | null,
        total_cards: totalCards,
      });
    }
    return out;
  });

export const getNotebook = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as SupabaseCtx;
    const { data: nb, error } = await supabase
      .from("study_notebooks")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!nb) throw new Error("Flash Session não encontrada");

    const { data: scopes, error: sErr } = await supabase
      .from("study_notebook_scopes")
      .select("subject_id, topic_id")
      .eq("notebook_id", data.id)
      .eq("user_id", userId);
    if (sErr) throw new Error(sErr.message);

    const scope = await resolveScope({ supabase, userId }, data.id);

    return {
      notebook: {
        id: nb.id as string,
        name: nb.name as string,
        mode: nb.mode as string,
        order_mode: nb.order_mode as string,
        shuffle_seed: nb.shuffle_seed as number,
        current_card_id: (nb.current_card_id ?? null) as string | null,
        reviewed_card_ids: (nb.reviewed_card_ids ?? []) as string[],
      },
      scopes: (scopes ?? []).map((s: any) => ({
        subjectId: s.subject_id as string | null,
        topicId: s.topic_id as string | null,
      })),
      resolved: scope,
    };
  });

export const notebookScope = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as SupabaseCtx;
    return await resolveScope(ctx, data.id);
  });

export const createNotebook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(1),
        mode: z.string().default("all"),
        orderMode: z.string().default("alpha"),
        scopes: z.array(ScopeInput).default([]),
        flashcardIds: z.array(z.string().uuid()).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as SupabaseCtx;
    const { data: nb, error } = await supabase
      .from("study_notebooks")
      .insert({ user_id: userId, name: data.name.trim(), mode: data.mode, order_mode: data.orderMode })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.scopes.length > 0) {
      const rows = data.scopes.map((s) => ({
        notebook_id: nb.id,
        user_id: userId,
        subject_id: s.subjectId ?? null,
        topic_id: s.topicId ?? null,
      }));
      const { error: sErr } = await supabase.from("study_notebook_scopes").insert(rows);
      if (sErr) throw new Error(sErr.message);
    }
    if (data.flashcardIds.length > 0) {
      const rows = data.flashcardIds.map((id) => ({
        notebook_id: nb.id,
        user_id: userId,
        flashcard_id: id,
      }));
      const { error: cErr } = await supabase.from("study_notebook_cards").upsert(rows, {
        onConflict: "notebook_id,flashcard_id",
        ignoreDuplicates: true,
      });
      if (cErr) throw new Error(cErr.message);
    }
    return { id: nb.id as string };
  });

export const updateNotebook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        mode: z.string().optional(),
        orderMode: z.string().optional(),
        scopes: z.array(ScopeInput).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as SupabaseCtx;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) patch['name'] = data.name.trim();
    if (data.mode !== undefined) patch['mode'] = data.mode;
    if (data.orderMode !== undefined) patch['order_mode'] = data.orderMode;

    const { error } = await supabase
      .from("study_notebooks")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    if (data.scopes) {
      const { error: delErr } = await supabase
        .from("study_notebook_scopes")
        .delete()
        .eq("notebook_id", data.id)
        .eq("user_id", userId);
      if (delErr) throw new Error(delErr.message);
      if (data.scopes.length > 0) {
        const rows = data.scopes.map((s) => ({
          notebook_id: data.id,
          user_id: userId,
          subject_id: s.subjectId ?? null,
          topic_id: s.topicId ?? null,
        }));
        const { error: insErr } = await supabase.from("study_notebook_scopes").insert(rows);
        if (insErr) throw new Error(insErr.message);
      }
    }
    return { ok: true };
  });

export const deleteNotebook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as SupabaseCtx;
    const { error } = await supabase
      .from("study_notebooks")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveNotebookProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        currentCardId: z.string().uuid().nullable().optional(),
        reviewedCardIds: z.array(z.string().uuid()).optional(),
        orderMode: z.string().optional(),
        shuffleSeed: z.number().int().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as SupabaseCtx;
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      last_studied_at: new Date().toISOString(),
    };
    if (data.currentCardId !== undefined) patch['current_card_id'] = data.currentCardId;
    if (data.reviewedCardIds !== undefined) patch['reviewed_card_ids'] = data.reviewedCardIds;
    if (data.orderMode !== undefined) patch['order_mode'] = data.orderMode;
    if (data.shuffleSeed !== undefined) patch['shuffle_seed'] = data.shuffleSeed;

    const { error } = await supabase
      .from("study_notebooks")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetNotebookProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as SupabaseCtx;
    const { error } = await supabase
      .from("study_notebooks")
      .update({ current_card_id: null, reviewed_card_ids: [], updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetNotebookSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as SupabaseCtx;
    const { supabase, userId } = ctx;
    const scope = await resolveScope(ctx, data.id);
    const today = new Date().toISOString().slice(0, 10);

    const ids = new Set<string>(scope.cardIds);
    if (scope.topicIds.length > 0) {
      const PAGE = 1000;
      for (let page = 0; ; page++) {
        const { data: rows, error } = await supabase
          .from("flashcards")
          .select("id")
          .eq("user_id", userId)
          .in("topic_id", scope.topicIds)
          .range(page * PAGE, page * PAGE + PAGE - 1);
        if (error) throw new Error(error.message);
        (rows ?? []).forEach((r: any) => ids.add(r.id));
        if ((rows ?? []).length < PAGE) break;
      }
    }
    const list = Array.from(ids);
    const CHUNK = 200;
    for (let i = 0; i < list.length; i += CHUNK) {
      const slice = list.slice(i, i + CHUNK);
      const { error } = await supabase
        .from("flashcards")
        .update({
          ease_factor: 2.5,
          interval_days: 0,
          repetitions: 0,
          due_date: today,
          last_reviewed_at: null,
        })
        .eq("user_id", userId)
        .in("id", slice);
      if (error) throw new Error(error.message);
      const { error: hErr } = await supabase
        .from("flashcard_reviews")
        .delete()
        .eq("user_id", userId)
        .in("flashcard_id", slice);
      if (hErr) throw new Error(hErr.message);
    }

    await supabase
      .from("study_notebooks")
      .update({ current_card_id: null, reviewed_card_ids: [] })
      .eq("id", data.id)
      .eq("user_id", userId);

    return { reset: list.length };
  });

export const addCardsToNotebook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ notebookId: z.string().uuid(), flashcardIds: z.array(z.string().uuid()).min(1) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as SupabaseCtx;
    const rows = data.flashcardIds.map((id) => ({
      notebook_id: data.notebookId,
      user_id: userId,
      flashcard_id: id,
    }));
    const { error } = await supabase
      .from("study_notebook_cards")
      .upsert(rows, { onConflict: "notebook_id,flashcard_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return { added: rows.length };
  });

export const removeCardsFromNotebook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ notebookId: z.string().uuid(), flashcardIds: z.array(z.string().uuid()).min(1) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as SupabaseCtx;
    const { error } = await supabase
      .from("study_notebook_cards")
      .delete()
      .eq("notebook_id", data.notebookId)
      .eq("user_id", userId)
      .in("flashcard_id", data.flashcardIds);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const notebooksForCard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ flashcardId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as SupabaseCtx;
    const { supabase, userId } = ctx;

    const { data: card, error: cardErr } = await supabase
      .from("flashcards")
      .select("id, topic_id")
      .eq("id", data.flashcardId)
      .eq("user_id", userId)
      .maybeSingle();
    if (cardErr) throw new Error(cardErr.message);

    const { data: notebooks, error } = await supabase
      .from("study_notebooks")
      .select("id, name")
      .eq("user_id", userId)
      .order("name");
    if (error) throw new Error(error.message);

    const out: Array<{ id: string; name: string; source: "scope" | "manual" | null }> = [];
    for (const nb of notebooks ?? []) {
      const scope = await resolveScope(ctx, nb.id);
      const manual = scope.cardIds.includes(data.flashcardId);
      const byScope = !!card && scope.topicIds.includes(card.topic_id);
      out.push({
        id: nb.id as string,
        name: nb.name as string,
        source: manual ? "manual" : byScope ? "scope" : null,
      });
    }
    return out;
  });
