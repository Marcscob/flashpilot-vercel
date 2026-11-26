import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { isAbortError } from "./lib/is-abort-error";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(request: Request, response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  const capturedError = consumeLastCapturedError();
  // srvx reports a closed response stream as a generic h3 500. The browser has
  // already abandoned this request, so return quietly rather than surfacing a
  // fatal SSR page or carrying that AbortError into a subsequent navigation.
  if (request.signal.aborted || isAbortError(capturedError)) {
    return new Response(null, { status: 204 });
  }

  console.error(capturedError ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Cabeçalhos de segurança aplicados a toda resposta. Evitamos X-Frame-Options e
// qualquer CSP com frame-ancestors restritivo de propósito: o app roda embutido
// em iframe dentro do editor Lovable (ver previewAuthStorage.ts) e bloquear
// framing quebraria esse fluxo legítimo.
function withSecurityHeaders(response: Response): Response {
  try {
    if (!response.headers.has("x-content-type-options")) {
      response.headers.set("x-content-type-options", "nosniff");
    }
    if (!response.headers.has("referrer-policy")) {
      response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
    }
    if (!response.headers.has("strict-transport-security")) {
      response.headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
    }
    return response;
  } catch {
    // Some Response kinds (e.g. certain redirects) have immutable headers.
    // Never fail the request just to add hardening headers.
    return response;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withSecurityHeaders(await normalizeCatastrophicSsrResponse(request, response));
    } catch (error) {
      // The requester is already gone, so rendering an error page here can only
      // turn an expected navigation cancellation into a false blank-screen 500.
      if (isAbortError(error)) throw error;
      console.error(error);
      return withSecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
};
