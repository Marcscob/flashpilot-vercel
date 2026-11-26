import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { subnetForAddress } from "./welcome-kit-network";

const Input = z.object({ deviceId: z.string().uuid() });

// Chave dedicada e estável para o HMAC antifraude. Preferir WELCOME_KIT_HMAC_SECRET
// (configurável separadamente) evita acoplar este hash à service-role key: trocar a
// service key por rotação de segurança não deveria invalidar o histórico antifraude
// nem enfraquecer os limites de dispositivo/rede já registrados. Mantém fallback para
// não quebrar ambientes onde o segredo dedicado ainda não foi configurado.
function welcomeKitHmacKeyMaterial(): string {
  const keyValue = process.env.WELCOME_KIT_HMAC_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!keyValue) throw new Error("Configuração de segurança indisponível.");
  return keyValue;
}

async function hmacSha256Hex(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(welcomeKitHmacKeyMaterial()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashDeviceId(deviceId: string): Promise<string> {
  return hmacSha256Hex(deviceId);
}

// Em produção o tráfego passa pela borda, que envia `cf-connecting-ip`. Em ambientes
// locais/preview esse cabeçalho não existe: tentamos os cabeçalhos de proxy usuais e,
// se nenhum resolver uma rede, entramos em modo observação com um marcador por usuário
// (não bloqueia o kit, apenas deixa de contribuir para o limite por sub-rede).
const CLIENT_IP_HEADERS = [
  "cf-connecting-ip",
  "true-client-ip",
  "x-real-ip",
  "x-forwarded-for",
];

function clientSubnetFromRequest(): string | null {
  const headers = getRequest()?.headers;
  if (!headers) return null;
  for (const name of CLIENT_IP_HEADERS) {
    const raw = headers.get(name);
    if (!raw) continue;
    for (const candidate of raw.split(",")) {
      const subnet = subnetForAddress(candidate.trim());
      if (subnet) return subnet;
    }
  }
  return null;
}

async function hashClientSubnet(userId: string): Promise<string> {
  const subnet = clientSubnetFromRequest();
  return subnet
    ? hmacSha256Hex(`welcome-kit-subnet:v1:${subnet}`)
    : hmacSha256Hex(`welcome-kit-subnet:v1:unresolved:${userId}`);
}

export const claimWelcomeKit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: granted, error } = await supabaseAdmin.rpc("grant_ai_welcome_kit", {
      p_user_id: context.userId,
      p_device_hash: await hashDeviceId(data.deviceId),
      p_subnet_hash: await hashClientSubnet(context.userId),
    });

    if (error) throw error;
    return { granted };
  });
