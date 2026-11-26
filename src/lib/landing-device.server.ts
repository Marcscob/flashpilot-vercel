import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function requestIp(): string {
  const headers = getRequest()?.headers;
  for (const name of ["cf-connecting-ip", "true-client-ip", "x-real-ip", "x-forwarded-for"]) {
    const raw = headers?.get(name);
    if (raw) return raw.split(",")[0]!.trim();
  }
  return "";
}

/** Owner devices (comma-separated IPs in LANDING_UNLIMITED_IPS) skip device throttles. */
function isUnlimitedClient(ip: string): boolean {
  const allowed = (process.env["LANDING_UNLIMITED_IPS"] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return !!ip && allowed.includes(ip);
}

async function clientKey(ip: string, scope: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${scope}:v1:${ip || "unknown"}`),
    ),
  );
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Counts one use for this device; returns false when its daily limit is reached. */
export async function reserveDevice(
  scope: "landing-source" | "landing-claim" | "landing-material",
  perClient: number,
  global: number,
): Promise<boolean> {
  const ip = requestIp();
  if (isUnlimitedClient(ip)) return true;
  const { data, error } = await (
    supabaseAdmin as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: { ok: boolean; reason?: string } | null; error: unknown }>;
    }
  ).rpc("reserve_landing_source", {
    _client_key: await clientKey(ip, scope),
    _per_client: perClient,
    _global: global,
  });
  if (error || !data) throw new Error("Não foi possível iniciar o teste agora. Tente novamente.");
  return data.ok;
}
