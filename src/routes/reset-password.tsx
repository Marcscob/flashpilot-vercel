import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { authFlowCopy } from "@/lib/auth-flow-i18n";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Nova senha | FlashPilot" },
      { name: "description", content: "Crie uma nova senha para sua conta FlashPilot." },
      { property: "og:title", content: "Nova senha | FlashPilot" },
      { property: "og:description", content: "Crie uma nova senha para sua conta FlashPilot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const router = useRouter();
  const { lang } = useLang();
  const fc = authFlowCopy(lang);
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else setTimeout(() => setInvalid((v) => v || !window.location.hash.includes("access_token")), 3000);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) return toast.error(fc.mismatch);
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(fc.passwordUpdated);
    router.navigate({ to: "/home", replace: true });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <BrandLogo priority className="mx-auto mb-8 h-auto w-full max-w-[260px]" />
        <div className="bg-card border border-border rounded-2xl p-6 shadow-card space-y-4">
          <h1 className="text-lg font-semibold">{fc.newPasswordTitle}</h1>
          {!ready && invalid ? (
            <>
              <p className="text-sm text-muted-foreground">{fc.invalidLink}</p>
              <Button className="w-full" onClick={() => router.navigate({ to: "/auth" })}>{fc.backToLogin}</Button>
            </>
          ) : (
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pw">{fc.newPassword}</Label>
                <Input id="pw" type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw2">{fc.confirmPassword}</Label>
                <Input id="pw2" type="password" required minLength={6} value={pw2} onChange={(e) => setPw2(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !ready}>{fc.savePassword}</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
