export function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function ensureDestinationForUser(
  userId: string,
  input: {
    subjectName?: string;
    topicName?: string;
    language?: string;
    cards?: Array<{ question: string; answer: string }>;
  },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { resolveDestinationNames } = await import("./destination-names.server");
  const names = await resolveDestinationNames({
    subject: input.subjectName,
    topic: input.topicName,
    cards: input.cards,
    lang: input.language ?? "pt",
  });
  if (names.source !== "given") {
    console.warn(
      "[destination-names] nomes ausentes ou genéricos; usando",
      names.source,
      names.subject,
      "/",
      names.topic,
    );
  }
  const subjectName = escapeIlike(names.subject);
  const topicName = escapeIlike(names.topic);

  const { data: subjects, error: subjectsError } = await supabaseAdmin
    .from("subjects")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", subjectName)
    .order("created_at", { ascending: true })
    .limit(1);
  if (subjectsError) throw subjectsError;

  let subjectId = subjects?.[0]?.id;
  if (!subjectId) {
    const { data: subject, error } = await supabaseAdmin
      .from("subjects")
      .insert({ user_id: userId, name: names.subject, language: input.language ?? null })
      .select("id")
      .single();
    if (error) throw error;
    subjectId = subject.id;
  }

  const { data: topics, error: topicsError } = await supabaseAdmin
    .from("topics")
    .select("id")
    .eq("user_id", userId)
    .eq("subject_id", subjectId)
    .ilike("name", topicName)
    .is("parent_id", null)
    .order("created_at", { ascending: true })
    .limit(1);
  if (topicsError) throw topicsError;

  let topicId = topics?.[0]?.id;
  if (!topicId) {
    const { data: topic, error } = await supabaseAdmin
      .from("topics")
      .insert({
        user_id: userId,
        subject_id: subjectId,
        parent_id: null,
        name: names.topic,
      })
      .select("id")
      .single();
    if (error) throw error;
    topicId = topic.id;
  }

  return { subjectId, topicId };
}
