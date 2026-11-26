import { RefundLink } from "@/components/MoneyBackGuarantee";
import { createFileRoute, useRouter, redirect, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useT, useLang } from "@/lib/i18n";
import { T } from "@/lib/i18n-ui";
import { PhoneField, composePhone } from "@/components/PhoneField";
import { defaultCountryForLang } from "@/lib/countries";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { BrandLogo } from "@/components/BrandLogo";
import { Checkbox } from "@/components/ui/checkbox";
import { TrustBadges } from "@/components/TrustBadges";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { checkEmailRegistered } from "@/lib/auth-check.functions";
import { authFlowCopy } from "@/lib/auth-flow-i18n";
import { welcomeLocale } from "@/lib/welcome-locale";

const AUTH_INTRO: Record<string, { title: string; desc: string }> = {
  pt: { title: "Estude com flashcards e revisão espaçada", desc: "Flashcards inteligentes com o PilotAI" },
  "pt-PT": { title: "Estude com flashcards e revisão espaçada", desc: "Flashcards inteligentes com o PilotAI" },
  en: { title: "Study with flashcards and spaced repetition", desc: "Smart flashcards with PilotAI" },
  es: { title: "Estudia con flashcards y repaso espaciado", desc: "Flashcards inteligentes con PilotAI" },
  fr: { title: "Étudiez avec des flashcards et la répétition espacée", desc: "Des flashcards intelligents avec PilotAI" },
  it: { title: "Studia con flashcard e ripetizione dilazionata", desc: "Flashcard intelligenti con PilotAI" },
  de: { title: "Lernen mit Karteikarten und verteilter Wiederholung", desc: "Intelligente Karteikarten mit PilotAI" },
};

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { actionId?: string } => ({
    actionId: typeof search.actionId === "string" ? search.actionId : undefined,
  }),
  head: () => ({
    links: [{ rel: "canonical", href: "https://flashpilot.net/auth" }],
    meta: [
      { property: "og:url", content: "https://flashpilot.net/auth" },
      { title: "Entrar | FlashPilot" },
      { name: "description", content: "Entre no FlashPilot para criar flashcards e organizar suas revisões." },
      { property: "og:title", content: "Entrar | FlashPilot" },
      { property: "og:description", content: "Entre no FlashPilot para criar flashcards e organizar suas revisões." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      // Login com rascunho da landing: vai direto para a revisão obrigatória.
      if (search.actionId) throw redirect({ to: "/review", search: { actionId: search.actionId, first: "1" } });
      throw redirect({ to: "/home" });
    }
  },
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const { actionId } = Route.useSearch();
  const t = useT();
  const { lang, extLang } = useLang();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneCountry, setPhoneCountry] = useState(defaultCountryForLang(lang));
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [notFoundOpen, setNotFoundOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const fc = authFlowCopy(lang);

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success(fc.resetSent);
      setResetOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.auth.authError);
    } finally {
      setResetLoading(false);
    }
  }

  useEffect(() => {
    setPhoneCountry((cur) => cur || defaultCountryForLang(lang));
  }, [lang]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) {
        router.navigate(
          actionId
            ? { to: "/review", search: { actionId, first: "1" }, replace: true }
            : { to: "/home", replace: true },
        );
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router, actionId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!acceptedTerms) {
          toast.error(t.authExtra.mustAccept);
          return;
        }
        if (fullName.trim().length < 2) {
          toast.error(t.profile.nameRequired);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/?lang=${encodeURIComponent(welcomeLocale(extLang ?? lang, navigator.languages))}`,
            data: {
              full_name: fullName.trim(),
              phone: composePhone(phoneCountry, phone),
              phone_country: phone ? phoneCountry : null,
              ui_lang: welcomeLocale(extLang ?? lang, navigator.languages),
              terms_accepted: true,
            },
          },
        });
        if (error) throw error;
        setMode("signin");
        setConfirmOpen(true);

      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (/invalid login credentials/i.test(error.message)) {
            try {
              const r = await checkEmailRegistered({ data: { email } });
              if (!r.exists) {
                setNotFoundOpen(true);
                return;
              }
            } catch {
              /* fall through to generic error */
            }
          }
          throw error;
        }
        router.navigate(
          actionId
            ? { to: "/review", search: { actionId, first: "1" }, replace: true }
            : { to: "/home", replace: true },
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.auth.authError);
    } finally {
      setLoading(false);
    }
  }

  async function oauth(provider: "google" | "microsoft" | "apple") {
    if (mode === "signup" && !acceptedTerms) {
      toast.error(t.authExtra.mustAccept);
      return;
    }
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(provider === "google" ? t.auth.googleError : provider === "apple" ? t.auth.appleError : t.auth.microsoftError);
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    router.navigate(
      actionId
        ? { to: "/review", search: { actionId, first: "1" }, replace: true }
        : { to: "/home", replace: true },
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-4">
          <LanguageSwitcher />
        </div>
        <div className="text-center mb-8">
          <BrandLogo priority className="mx-auto h-auto w-full max-w-[280px] sm:max-w-[320px]" />
          <p className="mt-4 text-sm text-muted-foreground">{extLang ? T(AUTH_INTRO.pt.desc) : (AUTH_INTRO[lang] ?? AUTH_INTRO.en).desc}</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
          <div className="flex gap-1 mb-6 p-1 bg-muted rounded-lg">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 py-2 text-sm rounded-md transition ${mode === "signin" ? "bg-card shadow-soft font-medium" : "text-muted-foreground"}`}
            >
              {t.auth.signIn}
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 py-2 text-sm rounded-md transition ${mode === "signup" ? "bg-card shadow-soft font-medium" : "text-muted-foreground"}`}
            >
              {t.auth.signUp}
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="full-name">{t.profile.name}</Label>
                <Input
                  id="full-name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t.profile.namePh}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t.auth.email}</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.auth.emailPh} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.auth.password}</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.auth.passwordPh} />
              {mode === "signin" && (
                <div className="text-right">
                  <button type="button" className="text-xs text-primary underline-offset-2 hover:underline" onClick={() => { setResetEmail(email); setResetOpen(true); }}>
                    {fc.forgot}
                  </button>
                </div>
              )}
            </div>
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="phone">
                  {t.profile.phone}{" "}
                  <span className="text-xs font-normal text-muted-foreground">({t.profile.phoneOptional})</span>
                </Label>
                <PhoneField
                  country={phoneCountry}
                  onCountryChange={setPhoneCountry}
                  value={phone}
                  onChange={setPhone}
                />
              </div>
            )}
            {mode === "signup" && (
              <div className="flex items-start gap-2.5 rounded-lg bg-muted/60 p-3">
                <Checkbox
                  id="accept-terms"
                  checked={acceptedTerms}
                  onCheckedChange={(v) => setAcceptedTerms(v === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="accept-terms" className="text-xs font-normal leading-relaxed text-muted-foreground">
                  {t.authExtra.readAccept}{" "}
                  <Link to="/termos" className="text-foreground underline">{t.shell.terms}</Link>{" "}
                  {t.authExtra.and}{" "}
                  <Link to="/privacidade" className="text-foreground underline">{t.shell.privacy}</Link>.
                </Label>
              </div>
            )}
            <Button type="submit" disabled={loading || (mode === "signup" && !acceptedTerms)} className="w-full">
              {loading ? t.auth.loading : mode === "signin" ? t.auth.signIn : t.auth.signUp}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            {t.common.or}
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={() => oauth("google")} disabled={loading}>
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {t.auth.google}
          </Button>

          <Button type="button" variant="outline" className="w-full" onClick={() => oauth("microsoft")} disabled={loading}>
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
              <path fill="#F25022" d="M1 1h10.4v10.4H1z"/>
              <path fill="#7FBA00" d="M12.6 1H23v10.4H12.6z"/>
              <path fill="#00A4EF" d="M1 12.6h10.4V23H1z"/>
              <path fill="#FFB900" d="M12.6 12.6H23V23H12.6z"/>
            </svg>
            {t.auth.microsoft}
          </Button>

          <Button type="button" variant="outline" className="w-full" onClick={() => oauth("apple")} disabled={loading}>
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
              <path fill="currentColor" d="M16.365 1.43c0 1.14-.46 2.2-1.21 3-.96 1.03-2.5 1.82-3.77 1.72-.14-1.1.42-2.28 1.13-3.03.79-.85 2.16-1.5 3.24-1.55.03.11.05.24.05.38zM20.94 17.1c-.57 1.3-.84 1.87-1.57 3.02-1.02 1.6-2.46 3.6-4.25 3.61-1.58.02-2-1.04-4.16-1.02-2.15.01-2.6 1.04-4.19 1.02-1.79-.02-3.16-1.82-4.18-3.42C.42 17.3.11 12.63 2.02 10.08c1.33-1.78 3.42-2.82 5.39-2.82 1.99 0 3.24 1.09 4.89 1.09 1.6 0 2.58-1.09 4.88-1.09 1.74 0 3.58.95 4.89 2.59-4.3 2.36-3.6 8.49-.23 10.25z"/>
            </svg>
            {t.auth.apple}
          </Button>
        </div>

        <TrustBadges className="mt-6" />

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/termos" className="underline">{t.shell.terms}</Link>
          {" · "}
          <Link to="/privacidade" className="underline">{t.shell.privacy}</Link>
          {" · "}
          <RefundLink className="underline" />
        </p>
      </div>

      <Dialog open={notFoundOpen} onOpenChange={setNotFoundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{fc.notFoundTitle}</DialogTitle>
            <DialogDescription>{fc.notFoundBody(email)}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNotFoundOpen(false)}>{fc.tryOther}</Button>
            <Button onClick={() => { setNotFoundOpen(false); setMode("signup"); }}>{fc.createAccount}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{fc.confirmTitle}</DialogTitle>
            <DialogDescription>{fc.confirmBody(email)}</DialogDescription>
          </DialogHeader>
          <p className="rounded-lg bg-muted p-3 text-sm font-medium text-foreground">{fc.confirmSpam}</p>
          <DialogFooter>
            <Button onClick={() => setConfirmOpen(false)}>{fc.gotIt}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{fc.resetTitle}</DialogTitle>
            <DialogDescription>{fc.resetBody}</DialogDescription>
          </DialogHeader>
          <form onSubmit={sendReset} className="space-y-4">
            <Input type="email" required value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder={t.auth.emailPh} />
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>{fc.cancel}</Button>
              <Button type="submit" disabled={resetLoading}>{resetLoading ? t.auth.loading : fc.sendLink}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
