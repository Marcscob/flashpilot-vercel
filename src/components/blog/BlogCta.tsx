import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { isLang } from "@/lib/lang-match";
import { isExtLang } from "@/lib/app-ext-langs";
import { findBlogLang } from "@/lib/blog-langs";

const TEXT: Record<string, string> = {
  // Português
  pt: "Crie seus flashcards grátis aqui",
  "pt-PT": "Crie os seus flashcards grátis aqui",
  // English
  en: "Create your free flashcards here",
  "en-GB": "Create your free flashcards here",
  // Español
  es: "Crea tus flashcards gratis aquí",
  "es-AR": "Creá tus flashcards gratis acá",
  "es-ES": "Crea tus flashcards gratis aquí",
  // Français
  fr: "Créez vos flashcards gratuitement ici",
  "fr-CA": "Créez vos flashcards gratuitement ici",
  // Italiano
  it: "Crea qui i tuoi flashcard gratis",
  // Deutsch
  de: "Erstelle hier kostenlos deine Karteikarten",
  "de-AT": "Erstelle hier kostenlos deine Karteikarten",
  "de-CH": "Erstelle hier kostenlos deine Karteikarten",
  // Chinês
  "zh-CN": "在此免费创建您的抽认卡",
  "zh-TW": "在此免費建立您的抽認卡",
  "zh-HK": "在此免費建立您的抽認卡",
  // Demais idiomas
  ja: "ここで無料の単語帳を作成",
  ko: "여기서 무료 플래시카드를 만드세요",
  ar: "أنشئ بطاقاتك التعليمية المجانية هنا",
  he: "צור כאן את כרטיסיות הלימוד החינמיות שלך",
  fa: "فلش‌کارت‌های رایگان خود را اینجا بسازید",
  tr: "Ücretsiz bilgi kartlarınızı burada oluşturun",
  ru: "Создайте свои бесплатные карточки здесь",
  uk: "Створіть свої безкоштовні картки тут",
  pl: "Stwórz tutaj swoje darmowe fiszki",
  cs: "Vytvořte si zde své bezplatné kartičky",
  sk: "Vytvorte si tu svoje bezplatné kartičky",
  hu: "Hozza létre ingyenes tanulókártyáit itt",
  ro: "Creează-ți flashcardurile gratuite aici",
  bg: "Създайте своите безплатни флашкарти тук",
  hr: "Izradite svoje besplatne kartice ovdje",
  bs: "Kreirajte svoje besplatne kartice ovdje",
  sq: "Krijoni kartat tuaja falas këtu",
  el: "Δημιουργήστε τις δωρεάν κάρτες σας εδώ",
  lt: "Sukurkite nemokamas korteles čia",
  lv: "Izveidojiet bezmaksas zibatmiņas kartītes šeit",
  et: "Loo siin oma tasuta sähvikud",
  fi: "Luo ilmaiset muistikorttisi täällä",
  sv: "Skapa dina gratis flashcards här",
  da: "Opret dine gratis flashcards her",
  nb: "Lag dine gratis flashcards her",
  is: "Búðu til ókeypis leifturspjöld hér",
  nl: "Maak hier je gratis flashcards",
  af: "Skep jou gratis flitskaarte hier",
  ca: "Crea les teves flashcards gratis aquí",
  gl: "Crea os teus flashcards de balde aquí",
  ga: "Cruthaigh do chártaí splaince saor in aisce anseo",
  hy: "Ստեղծեք ձեր անվճար ֆլեշ քարտերն այստեղ",
  ka: "შექმენით თქვენი უფასო ბარათები აქ",
  az: "Pulsuz kartlarınızı burada yaradın",
  tk: "Mugt kartlaryňyzy şu ýerde dörediň",
  uz: "Bu yerda bepul fleshkartalaringizni yarating",
};

/** Retorna o texto do botão CTA no idioma exato do artigo. */
export function blogCtaText(lang: string): string {
  if (TEXT[lang]) return TEXT[lang]!;
  const base = findBlogLang(lang)?.base;
  if (base && TEXT[base]) return TEXT[base]!;
  const short = lang.split("-")[0]!;
  if (TEXT[short]) return TEXT[short]!;
  return TEXT.en!;
}

/** Resolve o idioma do post para o destino do link da landing page. */
export function blogCtaLang(lang: string): string {
  if (isLang(lang) || isExtLang(lang)) return lang;
  const base = findBlogLang(lang)?.base;
  if (base && (isLang(base) || isExtLang(base))) return base;
  const short = lang.split("-")[0]!;
  if (isLang(short) || isExtLang(short)) return short;
  return "en";
}

export function BlogCta({ lang }: { lang: string }) {
  const targetLang = blogCtaLang(lang);
  const text = blogCtaText(lang);
  return (
    <div className="not-prose my-10 flex justify-center">
      <Link
        to="/"
        search={{ lang: targetLang }}
        className="group flex w-full max-w-xl items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary px-5 py-4 text-base font-semibold text-primary-foreground shadow-md transition hover:-translate-y-0.5 hover:shadow-lg sm:px-7 sm:text-lg"
      >
        <span className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 shrink-0" />
          {text}
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 transition group-hover:translate-x-1" />
      </Link>
    </div>
  );
}

/** Divide o HTML do artigo num fechamento de parágrafo/bloco perto do meio. */
export function splitArticleHtml(html: string): [string, string] {
  const re = /<\/(p|ul|ol|blockquote|figure|div)>/gi;
  const mid = html.length / 2;
  let best = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const end = m.index + m[0].length;
    if (best < 0 || Math.abs(end - mid) < Math.abs(best - mid)) best = end;
  }
  if (best <= 0 || best >= html.length) return [html, ""];
  return [html.slice(0, best), html.slice(best)];
}
