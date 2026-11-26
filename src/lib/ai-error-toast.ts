import { toast } from "sonner";
import { T } from "@/lib/i18n-ui";
import { getErrorMessage } from "@/lib/error-message";

/**
 * Mensagens do PilotAI sempre cuidadosas e no idioma do aluno. Quando o problema é
 * falta de recurso (cota, créditos, assinatura), explica e oferece a Loja.
 */
type Friendly = { text: string; store: boolean };

const MSG = {
  daily: "A cota diária de degustação gratuita do PilotAI foi atingida. Tente novamente amanhã ou assine o Pro na Loja para continuar agora.",
  paused: "O PilotAI gratuita está em manutenção por alguns instantes. Tente novamente em breve ou conheça os planos na Loja.",
  noTrial: "Seu kit gratuito ainda não está disponível. Confirme seu e-mail e entre novamente — ou visite a Loja para liberar ao PilotAI agora.",
  freeUsed: "Você usou todos os recursos gratuitos desta função. Para continuar praticando, visite a Loja e escolha um plano ou pacote.",
  proOnly: "Este recurso faz parte do plano Pro. Visite a Loja para conhecer os planos.",
  proUsed: "Você atingiu o limite deste recurso no ciclo atual da assinatura. Na Loja você encontra pacotes extras.",
  billing: "Não conseguimos confirmar sua assinatura agora. Aguarde alguns instantes e tente novamente.",
  coins: "Seu saldo de FlashCoins não é suficiente para esta ação. Recarregue na Loja para continuar.",
  timeout: "A resposta demorou mais que o esperado. Tente novamente.",
  busy: "Outra ação do PilotAI ainda está em andamento na sua conta. Aguarde alguns segundos e tente novamente.",
  trialExpired: "Seu período de teste acabou. Assine o FlashPilot Pro para continuar criando conteúdo.",
  generic: "Algo não saiu como esperado. Tente novamente em instantes.",
};

export function friendlyAiError(raw: unknown, localized?: { busy: string }): Friendly {
  const m = getErrorMessage(raw, String(raw ?? ""));
  const has = (re: RegExp) => re.test(m);
  if (has(/Trial expirado|trial expired/i)) return { text: T(MSG.trialExpired), store: true };
  if (has(/(?:PilotAI|AI) budget exhausted|Daily free (?:AI job|PilotAI job) quota exhausted/i)) {
    return { text: T(MSG.daily), store: true };
  }
  if (has(/budget protection is not activated|budget limits are not configured/i)) return { text: T(MSG.paused), store: true };
  if (has(/Free (?:PilotAI|AI)?\s+trial is not available/i)) return { text: T(MSG.noTrial), store: true };
  if (has(/Free resource quota exhausted|Free flashcard collection limit|free .* allowance.*(?:reached|exceeded)/i)) {
    return { text: T(MSG.freeUsed), store: true };
  }
  if (has(/(?:Resource|feature) is not available on Free|not available on Free/i)) {
    return { text: T(MSG.proOnly), store: true };
  }
  if (has(/Pro resource quota exhausted|not available on Pro/i)) return { text: T(MSG.proUsed), store: true };
  if (has(/billing cycle is not verified|ciclo atual da assinatura/i)) return { text: T(MSG.billing), store: false };
  if (has(/(?:insufficient|not enough).*FlashCoins?|FlashCoins?.*(?:insufficient|not enough)|saldo.*(?:insuficiente|não é suficiente)/i)) return { text: T(MSG.coins), store: true };
  if (has(/Generated flashcard output is invalid or already saved/i)) {
    return { text: T("Parte destes flashcards já foi salva. Abra a matéria para conferir; os restantes podem ser gerados novamente."), store: false };
  }
  if (has(/60 segundos|timeout/i)) return { text: T(MSG.timeout), store: false };
  if (has(/Outra operação do PilotAI/i)) return { text: localized?.busy ?? T(MSG.busy), store: false };
  if (has(/excede o limite|blocos no seu plano|Escolha entre \d+ e \d+ flashcards/i)) return { text: T(m), store: true };
  // Mensagens já escritas para o aluno (em português) seguem, traduzidas quando possível.
  if (/[ãçéêóáíõúà]/i.test(m) && !/trava|lease|quota|reconcil/i.test(m)) {
    return { text: T(m), store: /assin|crédito|limite|plano|Loja|Pro\b/i.test(m) };
  }
  return { text: T(MSG.generic), store: false };
}

export function toastAiError(raw: unknown, opts?: { persistent?: boolean }) {
  const { text, store } = friendlyAiError(raw);
  console.error(raw);
  toast.error(text, {
    duration: opts?.persistent || store ? Infinity : undefined,
    closeButton: true,
    ...(store
      ? { action: { label: T("Ir para a Loja"), onClick: () => window.location.assign("/store") } }
      : {}),
  });
}
