import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, UserCog } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneField, composePhone } from "@/components/PhoneField";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { defaultCountryForLang, splitPhone } from "@/lib/countries";
import { useLang, useT } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

/** Seção "Meus dados": nome, telefone, e-mail e senha. */
export function MyDetailsCard() {
  const t = useT().profile;
  const { lang } = useLang();
  const qc = useQueryClient();
  const profileFn = useServerFn(getMyProfile);
  const saveFn = useServerFn(updateMyProfile);

  const q = useQuery({ queryKey: ["my-profile"], queryFn: () => profileFn({} as any), staleTime: 60_000 });

  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState(defaultCountryForLang(lang));
  const [phone, setPhone] = useState("");
  const [savingData, setSavingData] = useState(false);

  const [email, setEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!q.data) return;
    setFullName(q.data.fullName ?? "");
    setEmail(q.data.email ?? "");
    const parts = splitPhone(q.data.phone);
    setPhone(parts.local);
    setCountry(q.data.phoneCountry || parts.country || defaultCountryForLang(lang));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);

  async function saveData() {
    if (fullName.trim().length < 2) {
      toast.error(t.nameRequired);
      return;
    }
    setSavingData(true);
    try {
      await saveFn({
        data: {
          fullName: fullName.trim(),
          phone: composePhone(country, phone),
          phoneCountry: phone ? country : "",
        },
      } as any);
      await qc.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success(t.saved);
    } catch {
      toast.error(t.error);
    } finally {
      setSavingData(false);
    }
  }

  async function saveEmail() {
    const next = email.trim();
    if (!next || next === q.data?.email) return;
    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: next });
      if (error) throw error;
      toast.success(t.emailSent);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.error);
    } finally {
      setSavingEmail(false);
    }
  }

  async function savePassword() {
    if (newPassword.length < 6) {
      toast.error(t.passwordMin);
      return;
    }
    if (newPassword !== repeatPassword) {
      toast.error(t.passwordMismatch);
      return;
    }
    setSavingPassword(true);
    try {
      if (currentPassword && q.data?.email) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: q.data.email,
          password: currentPassword,
        });
        if (signInError) throw signInError;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
      toast.success(t.passwordChanged);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.error);
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 font-serif text-foreground">
        <UserCog className="h-5 w-5 text-primary" /> {t.sectionTitle}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.sectionDesc}</p>

      {q.isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="acc-name">{t.name}</Label>
              <Input
                id="acc-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t.namePh}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc-phone">
                {t.phone}{" "}
                <span className="text-xs font-normal text-muted-foreground">({t.phoneOptional})</span>
              </Label>
              <PhoneField
                id="acc-phone"
                country={country}
                onCountryChange={setCountry}
                value={phone}
                onChange={setPhone}
              />
            </div>
          </div>
          <Button onClick={saveData} disabled={savingData}>
            {savingData ? t.saving : t.save}
          </Button>

          <div className="border-t border-border pt-5">
            <div className="space-y-2">
              <Label htmlFor="acc-email">{t.email}</Label>
              <Input id="acc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <p className="text-xs text-muted-foreground">{t.emailHint}</p>
            </div>
            <Button
              className="mt-3"
              variant="secondary"
              onClick={saveEmail}
              disabled={savingEmail || !email.trim() || email.trim() === q.data?.email}
            >
              {savingEmail ? t.saving : t.changeEmail}
            </Button>
          </div>

          <div className="border-t border-border pt-5">
            <h3 className="text-sm font-medium text-foreground">{t.password}</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="acc-cur-pw">{t.currentPassword}</Label>
                <Input
                  id="acc-cur-pw"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acc-new-pw">{t.newPassword}</Label>
                <Input
                  id="acc-new-pw"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acc-rep-pw">{t.repeatPassword}</Label>
                <Input
                  id="acc-rep-pw"
                  type="password"
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                />
              </div>
            </div>
            <Button className="mt-3" variant="secondary" onClick={savePassword} disabled={savingPassword}>
              {savingPassword ? t.saving : t.changePassword}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
