import type { EmailLang } from "./signup-i18n";
import { normalizeLang, resolveWelcomeLang } from "./signup-i18n";
import { extraTrialKit } from "./welcome-extra-copy";
import { matchBlogTag } from "../blog-langs";

export interface TrialKitCopy {
  badge: string;
  headline: string;
  /** Contém {date}. */
  endsOn: string;
  listTitle: string;
  eligibilityNote: string;
  perks: { title: string; desc: string }[];
  safeTitle: string;
  safeText: string;
}

const LOCALE: Record<EmailLang, string> = {
  pt: "pt-BR",
  "pt-PT": "pt-PT",
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  it: "it-IT",
  de: "de-DE",
};

export const TRIAL_KIT: Record<EmailLang, TrialKitCopy> = {
  pt: {
    badge: "15 DIAS DE TESTE GRATUITO",
    headline: "Seu teste gratuito de 15 dias começou",
    endsOn: "Aproveite tudo até {date}.",
    listTitle: "O que você pode usar durante o teste",
    eligibilityNote:
      "O kit é liberado após a confirmação do e-mail e está sujeito aos limites de elegibilidade e segurança.",
    perks: [
      {
        title: "40 FlashCoins e até 100 flashcards",
        desc: "Gere até 40 flashcards com o PilotAI (1 moeda por card salvo) dentro do limite de até 100 cards no total, incluindo os manuais, importados e gerados com IA.",
      },
      {
        title: "Revisão inteligente no momento certo",
        desc: "Revise seus cards quando vencerem. Vincule o Telegram e ative os alertas nas Configurações para receber lembretes diários.",
      },
      {
        title: "15 turnos com o tutor PilotAI",
        desc: "Converse, tire dúvidas e pratique idiomas, inclusive no modo Repita depois de mim.",
      },
      { title: "2 mapas mentais", desc: "Transforme suas anotações em mapas visuais." },
      {
        title: "3 formatações com PilotAI",
        desc: "Transforme suas anotações em apostilas com estrutura e acabamento profissional.",
      },
      {
        title: "Anotações, cadernos e ditado por voz",
        desc: "Escreva ou dite suas anotações e organize por matéria. O ditado gratuito inclui até 60 transcrições por mês.",
      },
    ],
    safeTitle: "Sem cartão de crédito. Sem cobrança automática.",
    safeText:
      "Tudo o que você criar fica salvo. Depois do teste, você continua revisando seu material; para criar conteúdo novo com PilotAI, é só assinar o Pro.",
  },
  "pt-PT": {
    badge: "15 DIAS DE TESTE GRATUITO",
    headline: "O seu teste gratuito de 15 dias começou",
    endsOn: "Aproveite tudo até {date}.",
    listTitle: "O que pode usar durante o teste",
    eligibilityNote:
      "O kit é disponibilizado após a confirmação do e-mail e está sujeito aos limites de elegibilidade e segurança.",
    perks: [
      {
        title: "40 FlashCoins e até 100 flashcards",
        desc: "Gere até 40 flashcards com o PilotAI (1 moeda por cartão guardado) dentro do limite de 100 no total, incluindo cartões manuais, importados e gerados por IA.",
      },
      {
        title: "Revisão inteligente no momento certo",
        desc: "Reveja os cartões quando vencerem. Associe o Telegram e ative os alertas nas Configurações para receber lembretes diários.",
      },
      {
        title: "15 turnos com o tutor PilotAI",
        desc: "Converse, esclareça dúvidas e pratique idiomas, incluindo o modo Repita depois de mim.",
      },
      { title: "2 mapas mentais", desc: "Transforme as suas anotações em mapas visuais." },
      {
        title: "3 formatações com PilotAI",
        desc: "Transforme as suas anotações em sebentas com estrutura e acabamento profissional.",
      },
      {
        title: "Anotações, cadernos e ditado por voz",
        desc: "Escreva ou dite as suas anotações e organize-as por disciplina. O ditado gratuito inclui até 60 transcrições por mês.",
      },
    ],
    safeTitle: "Sem cartão de crédito. Sem cobrança automática.",
    safeText:
      "Tudo o que criar fica guardado. Depois do teste, continua a rever o seu material; para criar conteúdo novo com PilotAI, basta subscrever o Pro.",
  },
  en: {
    badge: "15-DAY FREE TRIAL",
    headline: "Your 15-day free trial has started",
    endsOn: "Enjoy everything until {date}.",
    listTitle: "What you can use during the trial",
    eligibilityNote:
      "The kit is unlocked after email confirmation and is subject to eligibility and security limits.",
    perks: [
      {
        title: "40 FlashCoins and up to 100 flashcards",
        desc: "Generate up to 40 flashcards with PilotAI (1 coin per saved card) within the 100-card total limit, including manual, imported and AI-generated cards.",
      },
      {
        title: "Smart spaced review",
        desc: "Review cards when they are due. Link Telegram and enable alerts in Settings to receive daily reminders.",
      },
      {
        title: "15 PilotAI tutor turns",
        desc: "Chat, clear doubts and practice languages, including Repeat after me mode.",
      },
      { title: "2 mind maps", desc: "Turn your notes into visual maps." },
      {
        title: "3 PilotAI formatting passes",
        desc: "Turn your notes into study booklets with professional structure and finish.",
      },
      {
        title: "Notes, notebooks and voice dictation",
        desc: "Write or dictate notes and organize them by subject. Free dictation includes up to 60 transcriptions per month.",
      },
    ],
    safeTitle: "No credit card. No automatic charges.",
    safeText:
      "Everything you create stays saved. After the trial you can keep reviewing your material; to create new content with PilotAI, just subscribe to Pro.",
  },
  es: {
    badge: "15 DÍAS DE PRUEBA GRATIS",
    headline: "Tu prueba gratuita de 15 días ha comenzado",
    endsOn: "Disfruta de todo hasta el {date}.",
    listTitle: "Lo que puedes usar durante la prueba",
    eligibilityNote:
      "El kit se activa después de confirmar el correo y está sujeto a los límites de elegibilidad y seguridad.",
    perks: [
      {
        title: "40 FlashCoins y hasta 100 flashcards",
        desc: "Genera hasta 40 flashcards con PilotAI (1 moneda por tarjeta guardada) dentro del límite total de 100, contando las manuales, importadas y generadas con IA.",
      },
      {
        title: "Repaso inteligente en el momento justo",
        desc: "Repasa tus tarjetas cuando venzan. Vincula Telegram y activa las alertas en Configuración para recibir recordatorios diarios.",
      },
      {
        title: "15 turnos con el tutor PilotAI",
        desc: "Conversa, resuelve dudas y practica idiomas, incluido el modo Repite después de mí.",
      },
      { title: "2 mapas mentales", desc: "Convierte tus notas en mapas visuales." },
      {
        title: "3 formatos con PilotAI",
        desc: "Convierte tus notas en apuntes de estudio con estructura y acabado profesional.",
      },
      {
        title: "Notas, cuadernos y dictado por voz",
        desc: "Escribe o dicta tus notas y organízalas por materia. El dictado gratuito incluye hasta 60 transcripciones al mes.",
      },
    ],
    safeTitle: "Sin tarjeta de crédito. Sin cobros automáticos.",
    safeText:
      "Todo lo que crees queda guardado. Tras la prueba podrás seguir repasando tu material; para crear contenido nuevo con PilotAI, solo suscríbete a Pro.",
  },
  fr: {
    badge: "ESSAI GRATUIT DE 15 JOURS",
    headline: "Votre essai gratuit de 15 jours a commencé",
    endsOn: "Profitez de tout jusqu’au {date}.",
    listTitle: "Ce que vous pouvez utiliser pendant l’essai",
    eligibilityNote:
      "Le kit est débloqué après confirmation de l’e-mail et reste soumis aux limites d’éligibilité et de sécurité.",
    perks: [
      {
        title: "40 FlashCoins et jusqu’à 100 flashcards",
        desc: "Générez jusqu’à 40 flashcards avec PilotAI (1 FlashCoin par carte enregistrée), dans la limite totale de 100 cartes, manuelles, importées et générées par IA.",
      },
      {
        title: "Révision espacée au bon moment",
        desc: "Révisez les cartes arrivées à échéance. Associez Telegram et activez les alertes dans les Paramètres pour recevoir des rappels quotidiens.",
      },
      {
        title: "15 échanges avec le tuteur PilotAI",
        desc: "Discutez, levez vos doutes et pratiquez les langues, y compris le mode Répétez après moi.",
      },
      { title: "2 cartes mentales", desc: "Transformez vos notes en cartes visuelles." },
      {
        title: "3 mises en forme avec PilotAI",
        desc: "Transformez vos notes en supports de révision à la structure et à la finition professionnelles.",
      },
      {
        title: "Notes, carnets et dictée vocale",
        desc: "Écrivez ou dictez vos notes et classez-les par matière. La dictée gratuite inclut jusqu’à 60 transcriptions par mois.",
      },
    ],
    safeTitle: "Sans carte bancaire. Sans prélèvement automatique.",
    safeText:
      "Tout ce que vous créez reste enregistré. Après l’essai, vous pouvez continuer à réviser ; pour créer du nouveau contenu avec PilotAI, abonnez-vous à Pro.",
  },
  it: {
    badge: "15 GIORNI DI PROVA GRATUITA",
    headline: "La tua prova gratuita di 15 giorni è iniziata",
    endsOn: "Approfitta di tutto fino al {date}.",
    listTitle: "Cosa puoi usare durante la prova",
    eligibilityNote:
      "Il kit si sblocca dopo la conferma dell’e-mail ed è soggetto ai limiti di idoneità e sicurezza.",
    perks: [
      {
        title: "40 FlashCoins e fino a 100 flashcard",
        desc: "Genera fino a 40 flashcard con PilotAI (1 moneta per card salvata) entro il limite totale di 100, incluse quelle manuali, importate e generate con IA.",
      },
      {
        title: "Ripasso intelligente al momento giusto",
        desc: "Ripassa le card quando sono in scadenza. Collega Telegram e attiva gli avvisi nelle Impostazioni per ricevere promemoria giornalieri.",
      },
      {
        title: "15 turni con il tutor PilotAI",
        desc: "Conversa, chiarisci dubbi e pratica le lingue, anche in modalità Ripeti dopo di me.",
      },
      { title: "2 mappe mentali", desc: "Trasforma i tuoi appunti in mappe visive." },
      {
        title: "3 formattazioni con PilotAI",
        desc: "Trasforma i tuoi appunti in dispense con struttura e finitura professionali.",
      },
      {
        title: "Appunti, quaderni e dettatura vocale",
        desc: "Scrivi o detta i tuoi appunti e organizzali per materia. La dettatura gratuita include fino a 60 trascrizioni al mese.",
      },
    ],
    safeTitle: "Nessuna carta di credito. Nessun addebito automatico.",
    safeText:
      "Tutto ciò che crei resta salvato. Dopo la prova continui a ripassare il tuo materiale; per creare nuovi contenuti con PilotAI basta abbonarsi a Pro.",
  },
  de: {
    badge: "15 TAGE KOSTENLOS TESTEN",
    headline: "Deine 15-tägige Gratis-Testphase hat begonnen",
    endsOn: "Nutze alles bis zum {date}.",
    listTitle: "Was du in der Testphase nutzen kannst",
    eligibilityNote:
      "Das Paket wird nach Bestätigung der E-Mail freigeschaltet und unterliegt den Teilnahme- und Sicherheitslimits.",
    perks: [
      {
        title: "40 FlashCoins und bis zu 100 Karteikarten",
        desc: "Erstelle bis zu 40 Karteikarten mit PilotAI (1 Coin pro gespeicherter Karte) innerhalb des Gesamtlimits von 100 Karten, einschließlich manuell erstellter, importierter und KI-generierter Karten.",
      },
      {
        title: "Intelligente Wiederholung zum richtigen Zeitpunkt",
        desc: "Wiederhole fällige Karten. Verbinde Telegram und aktiviere die Hinweise in den Einstellungen für tägliche Erinnerungen.",
      },
      {
        title: "15 Runden mit dem PilotAI-Tutor",
        desc: "Sprich, kläre Fragen und übe Sprachen, auch im Modus Sprich mir nach.",
      },
      { title: "2 Mindmaps", desc: "Verwandle deine Notizen in visuelle Karten." },
      {
        title: "3 Formatierungen mit PilotAI",
        desc: "Verwandle deine Notizen in Lernskripte mit professioneller Struktur und Gestaltung.",
      },
      {
        title: "Notizen, Hefte und Sprachdiktat",
        desc: "Schreibe oder diktiere Notizen und ordne sie nach Fach. Das kostenlose Diktat umfasst bis zu 60 Transkriptionen pro Monat.",
      },
    ],
    safeTitle: "Keine Kreditkarte. Keine automatische Abbuchung.",
    safeText:
      "Alles, was du erstellst, bleibt gespeichert. Nach der Testphase kannst du weiter wiederholen; für neue Inhalte mit PilotAI genügt ein Pro-Abo.",
  },
};

export function trialKitCopy(locale: string): TrialKitCopy {
  const resolved = resolveWelcomeLang(locale);
  const extra = extraTrialKit(resolved);
  if (extra) return extra;
  const native = TRIAL_KIT[normalizeLang(matchBlogTag(resolved))] ?? TRIAL_KIT.en;
  // Keep engine branding consistent in every welcome surface.
  const brand = (s: string) => s.replace(/\bIA\b|\bAI-generated\b|\bKI-generierter\b/g, "PilotAI");
  const regional = (s: string) => resolved === "de-CH" ? brand(s).replaceAll("ß", "ss") : brand(s);
  return { ...native, perks: native.perks.map(p => ({ title: regional(p.title), desc: regional(p.desc) })) };
}

export function trialEndLabel(lang: string, iso?: string | null): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return "";
  const d = new Date(iso);
  const locale = resolveWelcomeLang(lang);
  return new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}
