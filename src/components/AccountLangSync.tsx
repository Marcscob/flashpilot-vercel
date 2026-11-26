import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { useLang } from "@/lib/i18n";
import { isLang } from "@/lib/lang-match";

/**
 * Liga o idioma da interface à conta: aplica o idioma salvo no perfil e,
 * quando o perfil ainda não tem idioma, guarda o idioma detectado.
 */
// Vale uma vez por sessão: a troca de idioma remonta a tela e não pode
// reaplicar o idioma antigo do perfil.
let synced = false;

export function AccountLangSync() {
  const { lang, applyAccountLang } = useLang();
  const profileFn = useServerFn(getMyProfile);
  const saveFn = useServerFn(updateMyProfile);

  const profile = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => profileFn({} as any),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (synced || !profile.data) return;
    synced = true;
    const saved = profile.data.uiLang;
    if (isLang(saved)) {
      if (saved !== lang) applyAccountLang(saved);
    } else {
      void saveFn({ data: { uiLang: lang } } as any).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.data]);

  return null;
}
