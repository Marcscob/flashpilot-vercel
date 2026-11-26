import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Bump when the translation prompt or model changes to invalidate stored results. */
export const TRANSLATION_CACHE_VERSION = "v2";

type Table = {
  select: (c: string) => {
    eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: { translation: string } | null }> };
  };
  upsert: (row: Record<string, unknown>, o: { onConflict: string }) => Promise<unknown>;
};

const table = () =>
  (supabaseAdmin as unknown as { from: (t: string) => Table }).from("translation_cache");

export async function translationCacheKey(
  text: string,
  targetLang: string,
  sourceLang?: string | null,
): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        `${TRANSLATION_CACHE_VERSION}\u0000${targetLang}\u0000${sourceLang ?? ""}\u0000${text.trim()}`,
      ),
    ),
  );
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function readCachedTranslation(key: string): Promise<string | null> {
  try {
    const { data } = await table().select("translation").eq("cache_key", key).maybeSingle();
    return data?.translation || null;
  } catch {
    return null;
  }
}

export async function saveCachedTranslation(
  key: string,
  sourceLang: string | null | undefined,
  translation: string,
): Promise<void> {
  try {
    await table().upsert(
      { cache_key: key, source_lang: sourceLang ?? null, translation, last_hit_at: new Date().toISOString() },
      { onConflict: "cache_key" },
    );
  } catch {
    // Cache failures must never break the translation.
  }
}
