/**
 * Modo "Repita depois de mim" — frases guardadas para reaproveitamento.
 *
 * Usa o cliente do usuário (RLS por auth.uid()), como o resto do app.
 * Toda frase é pessoal do aluno; nada aqui é conteúdo oficial.
 */
import { supabase } from "@/integrations/supabase/client";

export type RepeatPhrase = {
  id: string;
  lang: string;
  level: string | null;
  topic: string | null;
  text: string;
  times_practiced: number;
  best_score: number | null;
  last_practiced_at: string | null;
  created_at: string;
};

const COLUMNS = "id, lang, level, topic, text, times_practiced, best_score, last_practiced_at, created_at";

export async function listPhrases(lang: string): Promise<RepeatPhrase[]> {
  const { data, error } = await supabase
    .from("language_repeat_phrases")
    .select(COLUMNS)
    .eq("lang", lang)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as RepeatPhrase[];
}

/** Frase guardada ainda não praticada para reaproveitar antes de gastar PilotAI. */
export async function nextUnpracticedPhrase(
  lang: string,
  level: string | null,
  topic: string | null,
  excludeId?: string | null,
): Promise<RepeatPhrase | null> {
  let query = supabase
    .from("language_repeat_phrases")
    .select(COLUMNS)
    .eq("lang", lang)
    .eq("times_practiced", 0);
  if (excludeId) query = query.neq("id", excludeId);
  if (level) query = query.eq("level", level);
  if (topic) query = query.eq("topic", topic);
  const { data, error } = await query.order("created_at", { ascending: true }).limit(1);
  if (error) throw new Error(error.message);
  return ((data ?? [])[0] as RepeatPhrase | undefined) ?? null;
}

/** Grava a frase; se o mesmo texto já existe para o idioma, reutiliza a linha. */
export async function savePhrase(
  lang: string,
  text: string,
  level: string | null,
  topic: string | null,
): Promise<RepeatPhrase> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sessão expirada. Entre novamente.");

  const { data: existing, error: findError } = await supabase
    .from("language_repeat_phrases")
    .select(COLUMNS)
    .eq("lang", lang)
    .eq("text", text)
    .limit(1);
  if (findError) throw new Error(findError.message);
  const found = (existing ?? [])[0] as RepeatPhrase | undefined;
  if (found) return found;

  const { data, error } = await supabase
    .from("language_repeat_phrases")
    .insert({ user_id: u.user.id, lang, text, level, topic })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as RepeatPhrase;
}

/** Registra uma tentativa: contagem, melhor acerto e data (atômico via RPC). */
export async function recordAttempt(id: string, score: number): Promise<void> {
  const { error } = await supabase.rpc("record_repeat_phrase_practice", { p_id: id, p_score: score });
  if (error) throw new Error(error.message);
}

export async function deletePhrase(id: string): Promise<void> {
  const { error } = await supabase.from("language_repeat_phrases").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
