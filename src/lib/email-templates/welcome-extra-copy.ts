import translations from "./welcome-translations.json";
import { matchBlogTag } from "../blog-langs";
import type { SignupCopy } from "./signup-i18n";
import type { TrialKitCopy } from "./trial-kit-i18n";

interface Translation { u: Record<string, string>; d: Record<string, string | null>; extra: string[] }
const catalog: Record<string, Translation> = translations;

export function welcomeTranslation(locale: string): Translation | undefined {
  return catalog[matchBlogTag(locale) ?? "en"];
}

export function extraSignupCopy(locale: string, site: string): SignupCopy | null {
  const row = welcomeTranslation(locale);
  if (!row) return null;
  const u = (key: string) => row.u[key] ?? "";
  const title = u("Bem-vindo(a) à comunidade FlashPilot!").replaceAll("FlashPilot", site);
  return {
    htmlLang: locale, title, subject: `${title} — ${row.extra[5]}`, preview: row.extra[0] ?? "",
    intro1: `${row.extra[5]} (`, intro2: ")", confirm: row.extra[5] ?? "",
    proKicker: "", proText: "", store: u("Ver planos e a Loja"),
    terms: u("Termos de uso"), privacy: u("Política de Privacidade"),
    ignore: "", tagline: "",
  };
}

export function extraTrialKit(locale: string): TrialKitCopy | null {
  const row = welcomeTranslation(locale);
  if (!row) return null;
  const u = (key: string) => row.u[key] ?? "";
  return {
    badge: row.extra[0] ?? "", headline: row.extra[0] ?? "",
    endsOn: `${row.d["account.accessUntil"] ?? ""}{date}`,
    listTitle: u("Seu kit de boas-vindas"), eligibilityNote: row.extra[5] ?? "",
    perks: [
      { title: `${u("40 FlashCoins")} · 100`, desc: row.extra[3] ?? "" },
      { title: row.d["pricing.fSpaced"] ?? "Telegram", desc: u("Vincule seu Telegram para receber lembretes automáticos de revisão.") },
      { title: `${u("15 turnos de conversação")} · PilotAI`, desc: u("Converse com o tutor PilotAI para tirar dúvidas e praticar idiomas.") },
      { title: u("2 mapas mentais"), desc: u("Transforme suas anotações em mapas visuais para revisar mais rápido.") },
      { title: u("3 formatações de notas"), desc: u("O PilotAI organiza textos longos em tópicos claros e prontos para estudar.") },
      { title: `${row.d["notes.title"] ?? ""} · ${row.d["pricing.fDictation"] ?? ""}`, desc: row.extra[4] ?? "" },
    ],
    safeTitle: row.extra[1] ?? "", safeText: row.extra[2] ?? "",
  };
}