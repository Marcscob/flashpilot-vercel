import { createFileRoute } from "@tanstack/react-router";
import { TTS_ORIGINS, TTS_RETENTION_DAYS, type TtsOrigin } from "@/lib/tts-retention";

const MAX_PER_RUN = 500;

function authorized(request: Request): boolean {
  const secret = process.env["TTS_CLEANUP_SECRET"];
  if (!secret) return false;
  const sent =
    request.headers.get("x-cleanup-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (sent.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i += 1) diff |= sent.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

/**
 * Fase 8 — limpeza por retenção do catálogo compartilhado de áudios.
 * Remove do banco e do armazenamento os áudios que passaram do prazo de guarda
 * da sua origem, contado desde o último uso. Áudios em uso nunca são apagados.
 */
async function runCleanup(dryRun: boolean) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result: Record<string, number> = {};
  let removedFiles = 0;

  for (const origin of TTS_ORIGINS as readonly TtsOrigin[]) {
    const cutoff = new Date(Date.now() - TTS_RETENTION_DAYS[origin] * 86_400_000).toISOString();
    const { data: stale, error } = await supabaseAdmin
      .from("tts_cache")
      .select("id, storage_path")
      .eq("origin", origin)
      .lt("last_used_at", cutoff)
      .limit(MAX_PER_RUN);
    if (error) throw new Error(error.message);

    result[origin] = stale?.length ?? 0;
    if (dryRun || !stale?.length) continue;

    const paths = stale.map((row) => row.storage_path).filter(Boolean) as string[];
    if (paths.length) {
      const removal = await supabaseAdmin.storage.from("tts-cache").remove(paths);
      if (!removal.error) removedFiles += paths.length;
    }

    const del = await supabaseAdmin
      .from("tts_cache")
      .delete()
      .in(
        "id",
        stale.map((row) => row.id),
      );
    if (del.error) throw new Error(del.error.message);
  }

  return { dryRun, retentionDays: TTS_RETENTION_DAYS, expired: result, removedFiles };
}

async function handle(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  try {
    const report = await runCleanup(dryRun);
    return Response.json(report);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Falha na limpeza" },
      { status: 500 },
    );
  }
}

export const Route = createFileRoute("/api/public/tts-cache-cleanup")({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
      GET: ({ request }) => handle(request),
    },
  },
});
