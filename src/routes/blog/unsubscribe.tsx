import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, MailWarning } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { blogUnsubscribe } from "@/lib/blog.functions";
import { blogNewsletterEmailCopy } from "@/lib/email-templates/blog-newsletter-i18n";

type PageState = "ready" | "loading" | "success" | "invalid" | "error";

export const Route = createFileRoute("/blog/unsubscribe")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
    lang: typeof search.lang === "string" ? search.lang : "en",
  }),
  head: () => ({
    meta: [{ title: "Cancelar inscrição | FlashPilot" }, { name: "robots", content: "noindex" }],
  }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const { token, lang: rawLang } = Route.useSearch();
  const { copy } = blogNewsletterEmailCopy(rawLang);
  const unsubscribe = useServerFn(blogUnsubscribe);
  const [state, setState] = useState<PageState>(token ? "ready" : "invalid");

  useEffect(() => {
    setState(token ? "ready" : "invalid");
  }, [token]);

  async function confirmUnsubscribe() {
    if (!token || state === "loading") return;
    setState("loading");
    try {
      await unsubscribe({ data: { token } });
      setState("success");
    } catch {
      setState("error");
    }
  }

  const completed = state === "success";
  const invalid = state === "invalid";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <a href="/" aria-label="FlashPilot">
            <BrandLogo priority className="mx-auto h-auto w-full max-w-[280px] sm:max-w-[320px]" />
          </a>
        </div>
        <section className="rounded-2xl border border-border bg-card p-6 text-center shadow-card sm:p-8">
          {completed ? (
            <>
              <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-green-600" aria-hidden="true" />
              <h1 className="text-xl font-semibold text-foreground">{copy.unsubscribeSuccess}</h1>
            </>
          ) : invalid ? (
            <>
              <MailWarning
                className="mx-auto mb-4 h-10 w-10 text-muted-foreground"
                aria-hidden="true"
              />
              <h1 className="text-xl font-semibold text-foreground">{copy.unsubscribeInvalid}</h1>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-foreground">{copy.unsubscribe}</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {copy.unsubscribePrompt}
              </p>
              {state === "error" && (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {copy.actionError}
                </p>
              )}
              <Button
                type="button"
                variant="destructive"
                className="mt-6 w-full"
                onClick={() => void confirmUnsubscribe()}
                disabled={state === "loading"}
              >
                {state === "loading" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {copy.unsubscribe}
              </Button>
            </>
          )}
          <a
            href="/blog"
            className="mt-6 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {copy.backToBlog}
          </a>
        </section>
      </div>
    </main>
  );
}
