const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUSES = new Set([429]);

function wait(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.reject(signal.reason ?? new Error("PilotAI provider request aborted."));
  }

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason ?? new Error("PilotAI provider request aborted."));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function retryDelay(response: Response, attempt: number): number | null {
  const retryAfter = response.headers.get("retry-after")?.trim();
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const serverDate = Date.parse(response.headers.get("date") ?? "");
    const referenceTime = Number.isFinite(serverDate) ? serverDate : Date.now();
    const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - referenceTime;
    if (!Number.isFinite(delay) || delay < 0 || delay > 2_000) return null;
    return delay;
  }
  return attempt === 0 ? 500 : 1_000;
}

export async function fetchAiProvider(
  input: RequestInfo | URL,
  init: RequestInit,
  signal: AbortSignal,
  beforeAttempt?: () => void,
): Promise<Response> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    beforeAttempt?.();
    const response = await fetch(input, { ...init, signal });
    if (!RETRYABLE_STATUSES.has(response.status) || attempt === MAX_ATTEMPTS - 1) {
      return response;
    }

    const delay = retryDelay(response, attempt);
    if (delay === null) return response;
    await response.body?.cancel();
    await wait(delay, signal);
  }

  throw new Error("PilotAI provider retry loop ended unexpectedly.");
}
