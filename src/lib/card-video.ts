export type TvScene = {
  emoji: string;
  kicker: string;
  title: string;
  bullets: string[];
  speech: string;
  questionRecap?: string;
};
export type TvStyle = "avatar" | "motion" | "both";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const MAX_QUESTION_RECAP_LENGTH = 240;

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function conciseQuestion(value: string): string {
  const question = value.replace(/\s+/g, " ").trim();
  if (question.length <= MAX_QUESTION_RECAP_LENGTH) return question;

  const prefix = question.slice(0, MAX_QUESTION_RECAP_LENGTH - 1);
  const lastSpace = prefix.lastIndexOf(" ");
  const cutoff = lastSpace > MAX_QUESTION_RECAP_LENGTH / 2 ? lastSpace : prefix.length;
  return `${prefix.slice(0, cutoff).trimEnd()}…`;
}

/** Sanitizes a model-produced script into at most 5 playable scenes. */
export function normalizeScenes(raw: unknown): TvScene[] {
  const list = record(raw).scenes;
  if (!Array.isArray(list)) return [];
  return list
    .slice(0, 5)
    .map((rawScene: unknown) => {
      const scene = record(rawScene);
      return {
        emoji: str(scene.emoji, 8) || "🎓",
        kicker: str(scene.kicker, 60),
        title: str(scene.title, 80),
        bullets: Array.isArray(scene.bullets)
          ? scene.bullets
              .map((bullet: unknown) => str(bullet, 120))
              .filter(Boolean)
              .slice(0, 3)
          : [],
        speech: str(scene.speech, 600),
        questionRecap: str(scene.questionRecap, MAX_QUESTION_RECAP_LENGTH),
      };
    })
    .filter((s) => s.speech);
}

/** Makes the last scene recap the card question even when the model omits it. */
export function ensureFinalQuestionRecap(scenes: TvScene[], question: string): TvScene[] {
  if (!scenes.length) return scenes;

  const lastIndex = scenes.length - 1;
  const lastScene = scenes[lastIndex]!;
  const recap = conciseQuestion(lastScene.questionRecap || question);
  if (!recap) return scenes;

  const speech = lastScene.speech.trim();
  const lowerRecap = recap.toLocaleLowerCase();
  const lowerSpeech = speech.toLocaleLowerCase();
  let finalSpeech = speech;
  if (!lowerSpeech.startsWith(lowerRecap)) {
    const recapIndex = lowerSpeech.indexOf(lowerRecap);
    const body =
      recapIndex >= 0
        ? `${speech.slice(0, recapIndex)} ${speech.slice(recapIndex + recap.length)}`.trim()
        : speech;
    const separator = /[.!?…]$/.test(recap) ? " " : ". ";
    finalSpeech = [recap, body].filter(Boolean).join(separator).trim();
  }

  return scenes.map((scene, index) =>
    index === lastIndex ? { ...scene, questionRecap: recap, speech: finalSpeech } : scene,
  );
}

/** Video language: app language unless the subject has its own language. */
export function needsLanguageChoice(appLang: string, subjectLang?: string | null): boolean {
  if (!subjectLang) return false;
  return subjectLang.split("-")[0].toLowerCase() !== appLang.split("-")[0].toLowerCase();
}

export function isYouTube(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
