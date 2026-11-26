import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { LanguageProvider, useT, detectAppLocale } from "@/lib/i18n";
import { useUiMicrocopy } from "@/lib/useUiMicrocopy";
import { getInitialAppLocale } from "@/lib/lang.functions";
import { isLang } from "@/lib/lang-match";
import { APP_EXT_LANGS, isExtLang, resolveRequestedAppLocale } from "@/lib/app-ext-langs";
import { ThemeProvider } from "@/lib/theme";
import { CookieBanner } from "@/components/CookieBanner";
import { NoCoinsDialog } from "@/components/NoCoinsDialog";
import { InitialPasswordDialog } from "@/components/InitialPasswordDialog";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";

function NotFoundComponent() {
  const t = useT();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-serif text-foreground">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.errors.notFoundBody}</p>
        <a
          href="/"
          className="mt-6 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {t.errors.home}
        </a>
      </div>
    </div>
  );
}

export function ErrorComponent({ error, reset }: { error?: unknown; reset?: () => void }) {
  console.error(error);
  const router = useRouter();
  const t = useT();
  useEffect(() => {
    // O valor lançado pode não ser um Error (inclusive undefined) — normalizamos
    // para nunca quebrar o próprio boundary.
    const safe = error instanceof Error ? error : new Error(String(error ?? "Erro desconhecido"));
    reportLovableError(safe, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-serif text-foreground">{t.errors.somethingWrong}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.errors.retryHint}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset?.();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {t.errors.retry}
          </button>
          <a href="/" className="rounded-md border border-input px-4 py-2 text-sm font-medium">
            {t.errors.home}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Não é async de propósito: no cliente o idioma é resolvido de forma síncrona,
  // sem promessa pendente para o router aguardar (evita telas em branco).
  loader: ({ location }) => {
    const requested =
      location.pathname === "/" ? new URLSearchParams(location.searchStr).get("lang") : null;
    const resolved = resolveRequestedAppLocale(requested);
    if (resolved) return resolved;
    if (typeof window !== "undefined") return detectAppLocale();
    return getInitialAppLocale().catch(() => ({
      lang: "en" as const,
      extLang: null,
    }));
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "google-site-verification", content: "j8cKrfAGPHp7sXPTMjujy-qbmum2i7oBn7LpumsN7ZE" },
      { name: "theme-color", content: "#faf5ec" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon-visible-48.png?v=9", type: "image/png", sizes: "48x48" },
      { rel: "icon", href: "/favicon-visible-32.png?v=9", type: "image/png", sizes: "32x32" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png?v=9", sizes: "180x180" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

const HTML_LANG_ATTR: Record<string, string> = {
  pt: "pt-BR",
  "pt-PT": "pt-PT",
  es: "es",
  en: "en",
  fr: "fr",
  it: "it",
  de: "de",
};

function RootShell({ children }: { children: ReactNode }) {
  const { lang = "en", extLang = null } = Route.useLoaderData() ?? {};
  const extInfo = extLang ? APP_EXT_LANGS.find((item) => item.code === extLang) : undefined;
  return (
    <html
      lang={extInfo?.code ?? HTML_LANG_ATTR[lang] ?? "en"}
      dir={extInfo?.dir === "rtl" ? "rtl" : "ltr"}
    >
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/** Aplica idioma da interface a placeholders, rótulos e tooltips em todo o app. */
function UiMicrocopy() {
  useUiMicrocopy();
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { lang = "en", extLang = null } = Route.useLoaderData() ?? {};
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "USER_UPDATED"
      ) {
        setUserId(session?.user.id ?? null);
      }
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setUserId(data.user?.id ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider initialLang={lang} initialExtLang={extLang}>
        <UiMicrocopy />
        <ThemeProvider>
          <Outlet />
          <PwaInstallPrompt />
          <CookieBanner />
          <AnalyticsTracker userId={userId} />
          <NoCoinsDialog />
          <InitialPasswordDialog key={userId ?? "signed-out"} userId={userId} />
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
