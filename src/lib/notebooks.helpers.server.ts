import { z } from "zod";

export type SupabaseCtx = { supabase: any; userId: string };

export const ScopeInput = z.object({
  subjectId: z.string().uuid().nullable().optional(),
  topicId: z.string().uuid().nullable().optional(),
});


export async function resolveScope(
  { supabase, userId }: SupabaseCtx,
  notebookId: string,
): Promise<{ topicIds: string[]; cardIds: string[] }> {
  const { data: scopes, error: scopeErr } = await supabase
    .from("study_notebook_scopes")
    .select("subject_id, topic_id")
    .eq("notebook_id", notebookId)
    .eq("user_id", userId);
  if (scopeErr) throw new Error(scopeErr.message);

  const subjectIds = (scopes ?? []).map((s: any) => s.subject_id).filter(Boolean) as string[];
  const directTopicIds = (scopes ?? []).map((s: any) => s.topic_id).filter(Boolean) as string[];

  const topicIds = new Set<string>();
  if (subjectIds.length > 0 || directTopicIds.length > 0) {
    const { data: topics, error: topicsErr } = await supabase
      .from("topics")
      .select("id, subject_id, parent_id")
      .eq("user_id", userId);
    if (topicsErr) throw new Error(topicsErr.message);
    const all = (topics ?? []) as Array<{ id: string; subject_id: string; parent_id: string | null }>;
    for (const tp of all) {
      if (subjectIds.includes(tp.subject_id)) topicIds.add(tp.id);
    }
    // topic + descendants
    const wanted = new Set(directTopicIds);
    let changed = true;
    while (changed) {
      changed = false;
      for (const tp of all) {
        if (tp.parent_id && wanted.has(tp.parent_id) && !wanted.has(tp.id)) {
          wanted.add(tp.id);
          changed = true;
        }
      }
    }
    wanted.forEach((id) => topicIds.add(id));
  }

  const { data: manual, error: manualErr } = await supabase
    .from("study_notebook_cards")
    .select("flashcard_id")
    .eq("notebook_id", notebookId)
    .eq("user_id", userId);
  if (manualErr) throw new Error(manualErr.message);

  return {
    topicIds: Array.from(topicIds),
    cardIds: (manual ?? []).map((r: any) => r.flashcard_id as string),
  };
}

export async function countCards(
  { supabase, userId }: SupabaseCtx,
  scope: { topicIds: string[]; cardIds: string[] },
): Promise<number> {
  const ids = new Set<string>(scope.cardIds);
  if (scope.topicIds.length > 0) {
    const PAGE = 1000;
    for (let page = 0; ; page++) {
      const { data, error } = await supabase
        .from("flashcards")
        .select("id")
        .eq("user_id", userId)
        .in("topic_id", scope.topicIds)
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      rows.forEach((r: any) => ids.add(r.id));
      if (rows.length < PAGE) break;
    }
  }
  return ids.size;
}

