import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  CARD_GENERATION_FORMAT_RULES,
  formatCardQuestion,
  splitCardQuestionOptions,
} from "../src/lib/card-format";
import { APP_EXT_LANGS } from "../src/lib/app-ext-langs";
import { UI_TABLE } from "../src/lib/i18n-ui";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const tStrings = (text: string) =>
  [...text.matchAll(/\bT\(\s*("(?:\\.|[^"\\])*")/g)].map(
    ([, literal]) => JSON.parse(literal!) as string,
  );

const LANDING_CARDS = source("../src/lib/landing-cards-prompt.ts");
const BULK_FILE_CARDS = source("../src/lib/parse-cards-file.functions.ts");
const BULK_IMAGE_CARDS = source("../src/lib/parse-cards-image.functions.ts");
const LANDING_RESULTS = source("../src/components/LandingResultsSection.tsx");
const IMAGE_ZOOM_VIEWER = source("../src/components/ImageZoomViewer.tsx");
const FLIP_CARD = source("../src/components/FlipCard.tsx");
const CARD_FONT_SIZE_HOOK = source("../src/hooks/useCardFontSize.ts");
const LANDING_CAPTURE = source("../src/components/LandingCapture.tsx");
const LANDING_PAGE = source("../src/components/LandingPage.tsx");
const HOME_STUDY_MATERIALS = source("../src/components/HomeStudyMaterials.tsx");
const TV_PLAYER = source("../src/components/FlashPilotTv.tsx");
const VISITOR_MATERIALS = source("../src/lib/landing-visitor-materials.functions.ts");
const TV_SCRIPT = source("../src/lib/card-video-generate.server.ts");
const LANDING_UI_STRINGS = [
  ...new Set([
    ...tStrings(LANDING_RESULTS),
    ...tStrings(IMAGE_ZOOM_VIEWER),
    "Os materiais selecionados (anotação, mapa mental e microvídeo) serão criados automaticamente pelo PilotAI e anexados aos flashcards.",
    "Controles do flashcard",
    "Diminuir fonte",
    "Aumentar fonte",
  ]),
];
const NEW_LANDING_UI_STRINGS = [
  "Crie flashcards inteligentes",
  "Ocorreu um erro ao processar o seu material. Por favor, tente novamente.",
  "Visualizar meus flashcards",
  "Seus dados são protegidos e usados para vincular seu teste gratuito.",
  "Como gostaria de ser chamado",
  "Criando seus flashcards com inteligência artificial...",
  "Por favor, informe seu nome.",
  "Por favor, informe um e-mail válido.",
  "Nosso modelo está lendo o conteúdo e estruturando perguntas e respostas atômicas com revisão espaçada.",
  "Processando material · aguarde alguns segundos",
  "Não foi possível gerar os flashcards",
  "Resultado do seu teste",
  "Seus Flashcards Gerados",
  "Card {current} de {total}",
  "Virar flashcard",
  "Clique para virar",
  "Clique no cartão para conferir a resposta",
  "Clique novamente para ver a pergunta",
  "Ir para o card {n}",
  "Anterior",
  "Próximo",
  "Novo Teste",
];

describe("landing study material flow", () => {
  test("landing and Bulk-v2 share the three-card-format prompt", () => {
    expect(CARD_GENERATION_FORMAT_RULES).toContain("na mesma proporção (1/3 cada)");
    expect(CARD_GENERATION_FORMAT_RULES).toContain('DENTRO do campo "question"');
    expect(CARD_GENERATION_FORMAT_RULES).toContain('SOMENTE no "answer"');
    expect(source("../src/lib/card-guidelines.ts")).toContain("CARD_GENERATION_FORMAT_RULES");
    expect(LANDING_CARDS).toContain("sharedCardGuidelines");
    expect(BULK_FILE_CARDS).toContain("sharedCardGuidelines");
    expect(BULK_IMAGE_CARDS).toContain("sharedCardGuidelines");
  });

  test("landing keeps the material checkboxes and card-back actions create previews directly", () => {
    expect(LANDING_RESULTS).toContain('kind: "map" as const');
    expect(LANDING_RESULTS).toContain('kind: "video" as const');
    expect(LANDING_RESULTS).toContain('kind: "note" as const');
    expect(LANDING_RESULTS).toContain("onClick={() => requestMaterial(kind)}");
    expect(LANDING_RESULTS).toContain("onGenerateMaterial(kind, activeCard)");
    expect(LANDING_RESULTS).not.toContain("signInWithOtp");
    expect(LANDING_CAPTURE).toContain('<HomeStudyMaterials variant="landing"');
    expect(LANDING_PAGE).toContain("readLandingMaterialPreference()");
    expect(LANDING_PAGE).toContain("returning?.materials ?? visitorMaterials");
    expect(HOME_STUDY_MATERIALS).toContain(
      "const DEFAULT_LANDING_MATERIALS = { note: true, map: true, video: true };",
    );
    expect(HOME_STUDY_MATERIALS).toContain("if (!landingPreferencesLoaded) return;");
    expect(HOME_STUDY_MATERIALS).toContain(
      "Os materiais selecionados (anotação, mapa mental e microvídeo) serão criados automaticamente pelo PilotAI e anexados aos flashcards.",
    );
    expect(HOME_STUDY_MATERIALS).not.toContain(
      "Escolhido: o PilotAI criará automaticamente após gerar os flashcards.",
    );
  });

  test("landing renders PNG mind maps in the shared zoom and pan viewer", () => {
    expect(LANDING_RESULTS).toContain("renderMindMapPng, type MindMapTree");
    expect(LANDING_RESULTS).toContain("renderMindMapPng(tree)");
    expect(LANDING_RESULTS).toContain(
      'import { ImageZoomViewer } from "@/components/ImageZoomViewer";',
    );
    expect(LANDING_RESULTS).toContain("<ImageZoomViewer");
    expect(LANDING_RESULTS).toContain("src={imageUrl}");
    expect(LANDING_RESULTS).toContain("title={tree.title}");
    expect(LANDING_RESULTS).toContain('height="min(64dvh, 64vh)"');
    expect(LANDING_RESULTS).not.toContain("MindMapBranches");
  });

  test("landing flashcards share font-size controls and keep long text scrollable", () => {
    expect(LANDING_RESULTS).toContain("useCardFontSize");
    expect(LANDING_RESULTS).toContain("A−");
    expect(LANDING_RESULTS).toContain("A+");
    expect(LANDING_RESULTS).toContain('T("Diminuir fonte")');
    expect(LANDING_RESULTS).toContain('T("Aumentar fonte")');
    expect(LANDING_RESULTS).toContain("my-auto w-full shrink-0");
    expect(FLIP_CARD).toContain("useCardFontSize");
    expect(CARD_FONT_SIZE_HOOK).toContain('"card-font-size"');
  });

  test("multiple-choice alternatives are rendered as a left-aligned column", () => {
    const question = formatCardQuestion(
      "Qual é a causa? a) pelo casamento b) pela colação de grau c) pela maioridade d) por decisão judicial",
    ).question;

    expect(splitCardQuestionOptions(question)).toEqual({
      prompt: "Qual é a causa?",
      options: [
        "a) pelo casamento",
        "b) pela colação de grau",
        "c) pela maioridade",
        "d) por decisão judicial",
      ],
    });
    expect(LANDING_RESULTS).toContain("splitCardQuestionOptions(activeCard.question)");
    expect(LANDING_RESULTS).toContain("text-left font-semibold leading-relaxed");
  });

  test("all landing and study card text is left-aligned", () => {
    expect(LANDING_RESULTS).toContain("py-5 text-left sm:py-6");
    expect(LANDING_RESULTS).toContain(
      "whitespace-pre-line text-left font-semibold leading-relaxed",
    );
    expect(LANDING_RESULTS).toContain("py-4 text-left sm:py-5");
    expect(LANDING_RESULTS).toContain("whitespace-pre-line text-left font-medium leading-relaxed");
    expect(LANDING_RESULTS).toContain("pt-4 text-left text-xs text-muted-foreground");
    expect(LANDING_RESULTS).toContain("pt-4 text-left text-xs opacity-75");
    expect(FLIP_CARD).toContain("text-left [&_*]:!text-left");
  });

  test("landing card controls reflow for narrow screens", () => {
    expect(LANDING_RESULTS).toContain("p-4 text-card-foreground");
    expect(LANDING_RESULTS).toContain("hidden sm:inline");
    expect(LANDING_RESULTS).toContain("order-3 flex basis-full justify-center");
    expect(LANDING_RESULTS).toContain("sm:order-none sm:basis-auto");
    expect(LANDING_RESULTS).toContain("break-words whitespace-pre-wrap");
  });

  test("landing flashcards include the additional 30px height", () => {
    expect(LANDING_RESULTS.match(/min-h-\[395px\]/g)).toHaveLength(3);
    expect(LANDING_RESULTS).not.toContain("min-h-[365px]");
    expect(LANDING_RESULTS).not.toContain("min-h-[340px]");
  });

  test("landing confirmation emails carry the active interface locale", () => {
    expect(LANDING_CAPTURE).toContain(
      "authEmailRedirectUrl(window.location.origin, emailLang, true)",
    );
    expect(LANDING_CAPTURE).toContain("data: { full_name: draft.fullName, ui_lang: emailLang }");
    expect(LANDING_CAPTURE).toContain("lang: emailLang");
    expect(LANDING_PAGE).toContain("authEmailRedirectUrl(window.location.origin, emailLang, true)");
    expect(LANDING_PAGE).toContain("data: { full_name: name, ui_lang: emailLang }");
  });

  test("landing labels and hints are translated for every supported UI locale", () => {
    expect(LANDING_PAGE).toContain('T("Crie flashcards inteligentes")');

    for (const text of LANDING_UI_STRINGS) {
      const row = UI_TABLE[text];
      expect(row, `Missing native UI catalog entry: ${text}`).toBeDefined();
      expect(row!.slice(0, 5).every((translation) => translation.trim().length > 0)).toBe(true);
    }

    for (const text of NEW_LANDING_UI_STRINGS) {
      const row = UI_TABLE[text]!;
      expect(row[1]).not.toBe(row[0]);
      expect(row[2]).not.toBe(row[0]);
      expect(row[3]).not.toBe(row[0]);
      expect(row[4]).not.toBe(row[0]);
      expect(row[5]).toBeTruthy();
    }

    for (const { code } of APP_EXT_LANGS) {
      const overlay = JSON.parse(source(`../public/i18n/${code}.json`)) as {
        u: Record<string, string>;
      };
      for (const text of LANDING_UI_STRINGS) {
        expect(overlay.u[text], `${code}: ${text}`).toBeTruthy();
      }
      for (const text of NEW_LANDING_UI_STRINGS) {
        expect(overlay.u[text], `${code}: ${text}`).toBeTruthy();
        expect(overlay.u[text]).not.toBe(UI_TABLE[text]?.[0]);
      }
    }
  });

  test("topic review labels are translated for every extra UI locale", () => {
    const required = {
      "topic.cardsInfo": {
        placeholders: ["arg0", "arg1"],
        source: "{arg0} flashcards · {arg1} to review today",
      },
      "topic.review": { placeholders: ["arg0"], source: "Review ({arg0})" },
      "topic.reviewOn": { placeholders: ["arg0"], source: "Review on {arg0}" },
      "topic.reviewsCount": { placeholders: ["arg0"], source: "{arg0} reviews" },
    } as const;

    for (const { code } of APP_EXT_LANGS) {
      const overlay = JSON.parse(source(`../public/i18n/${code}.json`)) as {
        d: Record<string, string>;
      };
      for (const [key, { placeholders, source: english }] of Object.entries(required)) {
        const translation = overlay.d[key];
        expect(translation, `${code}: ${key}`).toBeTruthy();
        expect(translation, `${code}: ${key}`).not.toBe(english);
        for (const placeholder of placeholders) {
          expect(translation, `${code}: ${key} is missing {${placeholder}}`).toContain(
            `{${placeholder}}`,
          );
        }
      }
    }
  });

  test("visitor video generation and transcript use the selected UI language", () => {
    expect(LANDING_PAGE).toContain("lang: copyLang");
    expect(VISITOR_MATERIALS).toContain("synthesizeAudioBytes");
    expect(VISITOR_MATERIALS).toContain("data.lang,");
    expect(TV_SCRIPT).toContain("findBlogLang(normalized) ?? findBlogLang(primary)");
    expect(TV_PLAYER).toContain('source.kind === "preview" ? (');
    expect(TV_PLAYER).toContain("{source.transcript}");
  });
});
