import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Bump a kind's version when its prompt or model changes to invalidate stored results. */
export const AI_CACHE_VERSIONS = {
  "video-script": "v1",
  mindmap: "v1",
  "ugc-audit": "v1",
  "ugc-curation": "v1",
  "prazos-scan": "v1",
  "landing-note": "v1",
  "landing-map": "v1",
} as const;

export type AiCacheKind = keyof typeof AI_CACHE_VERSIONS;

type Table = {
  select: (c: string) => {
    eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: { payload: unknown } | null }> };
  };
  upsert: (row: Record<string, unknown>, o: { onConflict: string }) => Promise<unknown>;
};

const table = () =>
  (supabaseAdmin as unknown as { from: (t: string) => Table }).from("ai_result_cache");

export async function aiCacheKey(kind: AiCacheKind, ...parts: string[]): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode([kind, AI_CACHE_VERSIONS[kind], ...parts].join("\u0000")),
    ),
  );
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function readAiCache<T>(key: string): Promise<T | null> {
  try {
    const { data } = await table().select("payload").eq("cache_key", key).maybeSingle();
    return (data?.payload as T | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function writeAiCache(kind: AiCacheKind, key: string, payload: unknown): Promise<void> {
  try {
    await table().upsert(
      { cache_key: key, kind, payload, last_hit_at: new Date().toISOString() },
      { onConflict: "cache_key" },
    );
  } catch {
    // Cache failures must never break generation.
  }
}
