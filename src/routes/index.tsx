import { createFileRoute, redirect } from "@tanstack/react-router";
import { shouldOpenStudentHome } from "@/lib/landing-session-rules";
import { LandingPage } from "@/components/LandingPage";
import { getInitialAppLocale } from "@/lib/lang.functions";
import { detectAppLocale } from "@/lib/i18n";
import { isSupportedAppLang, resolveRequestedAppLocale } from "@/lib/app-ext-langs";
import { landingHead } from "@/lib/landing-head";
export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { lang?: string; resume?: string } => ({
    lang:
      typeof search.lang === "string" && isSupportedAppLang(search.lang)
        ? search.lang
        : undefined,
    resume: search.resume === "1" ? "1" : undefined,
  }),
  loaderDeps: ({ search }) => ({ lang: search.lang }),
  beforeLoad: async ({ search }) => {
    // The public SSR page has no browser session; check before client rendering.
    if (typeof window === "undefined") return;
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    if (data.session?.user && search.resume === "1") {
      throw redirect({ to: "/review", replace: true });
    }
    if (shouldOpenStudentHome(Boolean(data.session?.user), search.resume)) {
      throw redirect({ to: "/home", replace: true });
    }
  },
  loader: async ({ deps }) => {
    if (deps.lang) {
      const resolved = resolveRequestedAppLocale(deps.lang);
      if (resolved) {
        return {
          ...resolved,
          explicit: true,
        };
      }
    }
    const locale = typeof window !== "undefined" ? detectAppLocale() : await getInitialAppLocale();
    return { ...locale, explicit: false };
  },
  head: ({ loaderData }) =>
    landingHead(loaderData?.extLang ?? loaderData?.lang ?? "en", loaderData?.explicit),
  component: LandingPage,
});
