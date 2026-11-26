import { createServerFn } from "@tanstack/react-start";

export const checkEmailRegistered = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) => {
    const email = String(input?.email ?? "").trim().toLowerCase();
    if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Invalid email");
    }
    return { email };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("get_trial_status_by_email", { p_email: data.email });
    if (error) return { exists: true };
    return { exists: Array.isArray(rows) && rows.length > 0 };
  });
