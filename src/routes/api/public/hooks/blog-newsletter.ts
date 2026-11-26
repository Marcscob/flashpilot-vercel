import { createFileRoute } from "@tanstack/react-router";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/hooks/blog-newsletter")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
          return Response.json({ error: "CRON_SECRET missing" }, { status: 500 });
        }
        const provided =
          request.headers.get("x-cron-secret") ??
          (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!safeEqual(provided, cronSecret)) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const { processBlogNewsletter } = await import("@/lib/blog-newsletter.server");
          const result = await processBlogNewsletter();
          return Response.json({ ok: true, ...result });
        } catch (error) {
          const detail = error as { code?: unknown; message?: unknown };
          const info = {
            errorType: error instanceof Error ? error.name : typeof error,
            code: typeof detail?.code === "string" ? detail.code : undefined,
            message: typeof detail?.message === "string" ? detail.message.slice(0, 300) : undefined,
          };
          console.error("Blog newsletter processing failed", info);
          return Response.json({ error: "Newsletter processing failed", ...info }, { status: 500 });
        }
      },
    },
  },
});
