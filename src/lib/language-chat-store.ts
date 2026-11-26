/**
 * Fase 10 — leitura e gravação das conversas de idiomas.
 *
 * Usa o cliente do usuário (RLS por auth.uid()), como o resto do app.
 * Não há autoria oficial aqui: toda conversa é do próprio aluno.
 */
import { supabase } from "@/integrations/supabase/client";

export type ChatSession = {
  id: string;
  lang: string;
  title: string;
  updated_at: string;
  last_message_at: string | null;
  /** Fase 12 — configuração da conversa. */
  subject_id: string | null;
  level: string | null;
  topic: string | null;
  /** Fase 13 — modo pedagógico da conversa. */
  mode: string | null;
};

export type ChatSessionConfig = {
  subjectId?: string | null;
  level?: string | null;
  topic?: string | null;
  mode?: string | null;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  correction_data: unknown | null;
  created_at: string;
};

/** Título curto a partir da primeira mensagem, sem inventar conteúdo. */
export function titleFromFirstMessage(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean || "Conversa";
}

export async function listSessions(): Promise<ChatSession[]> {
  const { data, error } = await supabase
    .from("language_chat_sessions")
    .select("id, lang, title, updated_at, last_message_at, subject_id, level, topic, mode")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as ChatSession[];
}

export async function listMessages(sessionId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("language_chat_messages")
    .select("id, role, content, correction_data, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ChatMessage[];
}

export async function createSession(
  lang: string,
  title: string,
  config?: ChatSessionConfig,
): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sessão expirada. Entre novamente.");
  const { data, error } = await supabase
    .from("language_chat_sessions")
    .insert({
      user_id: u.user.id,
      lang,
      title,
      subject_id: config?.subjectId ?? null,
      level: config?.level ?? null,
      topic: config?.topic ?? null,
      mode: config?.mode ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

/** Teto absoluto de gravação — mesmo limite do CHECK no banco. */
const MAX_MESSAGE_CONTENT_LENGTH = 20000;

export async function appendMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  correctionData?: Record<string, unknown> | null,
): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sessão expirada. Entre novamente.");
  const safeContent =
    content.length > MAX_MESSAGE_CONTENT_LENGTH ? content.slice(0, MAX_MESSAGE_CONTENT_LENGTH) : content;
  const { error } = await supabase.from("language_chat_messages").insert({
    session_id: sessionId,
    user_id: u.user.id,
    role,
    content: safeContent,
    ...(correctionData ? { correction_data: correctionData as never } : {}),
  });
  if (error) throw new Error(error.message);
  // Mantém a lista ordenada pela conversa mais recente.
  await supabase
    .from("language_chat_sessions")
    .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", sessionId);
}

export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await supabase.from("language_chat_sessions").delete().eq("id", sessionId);
  if (error) throw new Error(error.message);
}
