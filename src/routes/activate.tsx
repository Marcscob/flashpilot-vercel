import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, Loader2, MailWarning } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { BrandLogo } from "@/components/BrandLogo";
import { T } from "@/lib/i18n-ui";
import {
  activateLandingAccount,
  getLandingActivation,
  resendLandingActivation,
} from "@/lib/landing-draft.functions";

const DEVICE_ID_KEY = "flashpilot:device-id";

function getDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
  const deviceId = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

type ActivationState =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "expired" }
  | { kind: "ready"; email: string; fullName: string | null };

export const Route = createFileRoute("/activate")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
    actionId: typeof search.actionId === "string" ? search.actionId : "",
  }),
  head: () => ({
    meta: [
      { title: "Ativar conta | FlashPilot" },
      { name: "description", content: "Ative sua conta do FlashPilot e veja seus flashcards." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ActivatePage,
});

function ActivatePage() {
  const { token, actionId } = Route.useSearch();
  const router = useRouter();
  const getActivation = useServerFn(getLandingActivation);
  const resendActivation = useServerFn(resendLandingActivation);
  const activateAccount = useServerFn(activateLandingAccount);

  const [state, setState] = useState<ActivationState>({ kind: "loading" });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const passwordOk = password.length >= 8;

  useEffect(() => {
    let active = true;
    if (!token || !actionId) {
      setState({ kind: "invalid" });
      return;
    }
    void getActivation({ data: { token, actionId } })
      .then((result) => {
        if (!active) return;
        if (result.valid) setState({ kind: "ready", email: result.email, fullName: result.fullName });
        else setState({ kind: result.expired ? "expired" : "invalid" });
      })
      .catch(() => active && setState({ kind: "invalid" }));
    return () => {
      active = false;
    };
  }, [token, actionId, getActivation]);

  async function resend() {
    setResending(true);
    try {
      await resendActivation({ data: { token, actionId } });
      setResent(true);
      toast.success(T("Novo link enviado! Verifique seu e-mail."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : T("Não foi possível reenviar o link."));
    } finally {
      setResending(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!passwordOk || !acceptedTerms || state.kind !== "ready") return;
    setLoading(true);
    try {
      const result = await activateAccount({
        data: { token, actionId, password, deviceId: getDeviceId() },
      });
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: result.email,
        password,
      });
      if (signInError) throw signInError;
      // Primeiro acesso: a revisão obrigatória cuida da geração dos flashcards.
      await router.navigate({ to: "/review", search: { actionId, first: "1" }, replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : T("Não foi possível ativar sua conta."));
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <BrandLogo priority className="mx-auto h-auto w-full max-w-[280px] sm:max-w-[320px]" />
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          {state.kind === "loading" && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {T("Verificando seu link...")}
            </div>
          )}

          {state.kind === "invalid" && (
            <div className="space-y-4 py-4 text-center">
              <MailWarning className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {T("Este link de ativação é inválido ou já foi usado.")}
              </p>
              <Button asChild className="w-full">
                <Link to="/">{T("Voltar para a página inicial")}</Link>
              </Button>
            </div>
          )}

          {state.kind === "expired" && (
            <div className="space-y-4 py-4 text-center">
              <MailWarning className="mx-auto h-10 w-10 text-muted-foreground" />
              <h1 className="text-lg font-semibold">{T("Seu link expirou")}</h1>
              <p className="text-sm text-muted-foreground">
                {T("O link de ativação é válido por 24 horas. Solicite um novo link para continuar.")}
              </p>
              <Button onClick={() => void resend()} disabled={resending || resent} className="w-full">
                {resending ? <Loader2 className="animate-spin" /> : null}
                {resent ? T("Link enviado! Verifique seu e-mail") : T("Solicitar novo link")}
              </Button>
            </div>
          )}

          {state.kind === "ready" && (
            <form onSubmit={submit} className="space-y-4">
              <h1 className="text-center text-lg font-semibold">
                {T("Ative sua conta para ver seus flashcards")}
              </h1>
              <div className="space-y-2">
                <Label htmlFor="activate-email">{T("E-mail")}</Label>
                <Input id="activate-email" type="email" value={state.email} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="activate-password">{T("Crie sua senha")}</Label>
                <div className="relative">
                  <Input
                    id="activate-password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? T("Ocultar senha") : T("Mostrar senha")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p
                  className={`text-xs ${passwordOk ? "text-success" : "text-muted-foreground"}`}
                  role="status"
                >
                  {T("Mínimo de 8 caracteres")}
                </p>
              </div>
              <div className="flex items-start gap-2.5 rounded-lg bg-muted/60 p-3">
                <Checkbox
                  id="activate-terms"
                  checked={acceptedTerms}
                  onCheckedChange={(v) => setAcceptedTerms(v === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="activate-terms" className="text-xs font-normal leading-relaxed text-muted-foreground">
                  {T("Li e aceito os")}{" "}
                  <Link to="/termos" className="text-foreground underline">{T("Termos de Uso")}</Link>{" "}
                  {T("e a")}{" "}
                  <Link to="/privacidade" className="text-foreground underline">{T("Política de Privacidade")}</Link>.
                </Label>
              </div>
              <Button type="submit" disabled={loading || !passwordOk || !acceptedTerms} className="w-full">
                {loading ? <Loader2 className="animate-spin" /> : null}
                {T("Ativar conta e Estudar")}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
