import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { claimWelcomeKit } from "@/lib/welcome-kit.functions";
import { sendWelcomeEmailIfNeeded } from "@/lib/welcome-email.functions";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { T } from "@/lib/i18n-ui";
import { welcomeLocale } from "@/lib/welcome-locale";

const DEVICE_ID_KEY = "flashpilot:device-id";

function getDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)) {
    return existing;
  }
  const deviceId = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

export function WelcomeKitBootstrap() {
  const claim = useServerFn(claimWelcomeKit);
  const sendWelcomeEmail = useServerFn(sendWelcomeEmailIfNeeded);
  const { lang, extLang } = useLang();
  const queryClient = useQueryClient();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!data.user) return;
        const result = await claim({ data: { deviceId: getDeviceId() } });
        if (result.granted) {
          await queryClient.invalidateQueries();
          toast.success(T("Kit de boas-vindas ativado: 40 FlashCoins, 2 mapas, 3 formatações e 15 turnos de conversa."));
        }
      } catch (error) {
        // Verificação em segundo plano: nunca incomodar o aluno com um aviso de erro.
        console.error("Failed to claim welcome kit", error);
      }

      try {
        // Quem entra pelo Google não recebe o e-mail de confirmação: este envio
        // garante a mensagem de boas-vindas uma única vez, no idioma do aluno.
        await sendWelcomeEmail({ data: { lang: welcomeLocale(extLang ?? lang, navigator.languages) } });
      } catch (error) {
        console.error("Failed to send welcome email", error);
      }
    })();
  }, [claim, sendWelcomeEmail, lang, extLang, queryClient]);

  return null;
}
