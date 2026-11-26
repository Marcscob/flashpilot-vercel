import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALL_LANGS } from "@/lib/lang-match";
import type { Database } from "@/integrations/supabase/types";

const langSchema = z.enum(ALL_LANGS as [string, ...string[]]);

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("full_name, phone, phone_country, ui_lang")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    const claims = context.claims as Record<string, unknown>;
    const email = typeof claims.email === "string" ? claims.email : "";
    return {
      email,
      fullName: data?.full_name ?? "",
      phone: data?.phone ?? "",
      phoneCountry: data?.phone_country ?? "",
      uiLang: (data?.ui_lang ?? null) as string | null,
    };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        fullName: z.string().trim().min(2).max(120).optional(),
        phone: z
          .string()
          .trim()
          .max(24)
          .regex(/^(\+?\d{6,20})?$/)
          .optional(),
        phoneCountry: z.string().trim().length(2).optional().or(z.literal("")),
        uiLang: langSchema.optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const patch: Database["public"]["Tables"]["profiles"]["Update"] = {};
    if (data.fullName !== undefined) patch.full_name = data.fullName;
    if (data.phone !== undefined) patch.phone = data.phone || null;
    if (data.phoneCountry !== undefined) patch.phone_country = data.phoneCountry || null;
    if (data.uiLang !== undefined) patch.ui_lang = data.uiLang;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error, data: updated } = await supabaseAdmin
      .from("profiles")
      .update(patch)
      .eq("user_id", context.userId)
      .select("user_id")
      .maybeSingle();
    if (error) throw error;
    if (!updated) throw new Error("Perfil não encontrado.");
    return { ok: true };
  });

export const recordCookieConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error, data } = await supabaseAdmin
      .from("profiles")
      .update({ cookies_accepted_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .select("cookies_accepted_at")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Perfil não encontrado.");
    return data;
  });
