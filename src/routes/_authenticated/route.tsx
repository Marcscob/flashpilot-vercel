import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { LandingHandoffConsumer } from "@/components/LandingHandoffConsumer";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      // Somente no servidor de desenvolvimento (removido do build de produção):
      // permite pré-visualizar telas sem login. Chamadas autenticadas ao backend não funcionam.
      if (import.meta.env.DEV) {
        return {
          user: { id: "dev-preview", email: "preview@localhost" } as NonNullable<typeof data.user>,
        };
      }
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: () => (
    <AppShell>
      <LandingHandoffConsumer />
      <Outlet />
    </AppShell>
  ),
});
