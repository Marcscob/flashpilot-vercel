/**
 * Fase 12 — configuração da conversa: nível e tema.
 *
 * Estrutura preparada para A1–C2 sem mudar o banco: cada nível já declara
 * as faixas do quadro europeu. Modos pedagógicos são da Fase 13.
 */

export type ChatLevel = {
  id: "beginner" | "intermediate" | "advanced";
  label: string;
  cefr: string[];
  /** Instrução em inglês (idiomas estrangeiros) e em português. */
  guidanceEn: string;
  guidancePt: string;
};

export const DEFAULT_LEVEL: ChatLevel["id"] = "beginner";

export const CHAT_LEVELS: ChatLevel[] = [
  {
    id: "beginner",
    label: "Iniciante",
    cefr: ["A1", "A2"],
    guidanceEn:
      "The learner is a beginner (CEFR A1-A2): use very simple words, short sentences and the present tense.",
    guidancePt:
      "A pessoa é iniciante (A1-A2): use palavras simples, frases curtas e o presente do indicativo.",
  },
  {
    id: "intermediate",
    label: "Intermediário",
    cefr: ["B1", "B2"],
    guidanceEn:
      "The learner is intermediate (CEFR B1-B2): use everyday vocabulary, a few connectors and past and future tenses.",
    guidancePt:
      "A pessoa é intermediária (B1-B2): use vocabulário cotidiano, conectivos simples e tempos passado e futuro.",
  },
  {
    id: "advanced",
    label: "Avançado",
    cefr: ["C1", "C2"],
    guidanceEn:
      "The learner is advanced (CEFR C1-C2): speak naturally, with idiomatic expressions, collocations and varied register.",
    guidancePt:
      "A pessoa é avançada (C1-C2): fale com naturalidade, usando expressões idiomáticas e registro variado.",
  },
];

export type ChatTopic = {
  id: string;
  label: string;
  /** Instrução em inglês (idiomas estrangeiros) e em português. */
  guidanceEn: string;
  guidancePt: string;
  /** Temas que dependem de um flashcard só aparecem quando há card (Fase 18). */
  requiresCard?: boolean;
};

export const DEFAULT_TOPIC = "free";

export const CHAT_TOPICS: ChatTopic[] = [
  {
    id: "free",
    label: "Livre",
    guidanceEn: "Let the conversation follow whatever the learner brings up.",
    guidancePt: "Deixe a conversa seguir o que a pessoa trouxer.",
  },
  {
    id: "daily",
    label: "Cotidiano",
    guidanceEn: "Talk about everyday life: routine, family, food, weather, free time.",
    guidancePt: "Converse sobre o cotidiano: rotina, família, comida, tempo, lazer.",
  },
  {
    id: "travel",
    label: "Viagem",
    guidanceEn: "Talk about travelling: airport, hotel, directions, tickets, sightseeing.",
    guidancePt: "Converse sobre viagem: aeroporto, hotel, direções, passagens, passeios.",
  },
  {
    id: "interview",
    label: "Entrevista de emprego",
    guidanceEn: "Talk about job interviews: experience, strengths, expectations, questions to ask.",
    guidancePt: "Converse sobre entrevista de emprego: experiência, pontos fortes, expectativas.",
  },
  {
    id: "restaurant",
    label: "Restaurante",
    guidanceEn: "Talk about eating out: ordering, asking about dishes, paying, complaining politely.",
    guidancePt: "Converse sobre restaurante: pedir, perguntar sobre pratos, pagar, reclamar com educação.",
  },
  {
    id: "work",
    label: "Trabalho",
    guidanceEn: "Talk about work: meetings, e-mails, colleagues, deadlines, presentations.",
    guidancePt: "Converse sobre trabalho: reuniões, e-mails, colegas, prazos, apresentações.",
  },
  {
    id: "card",
    label: "Assunto do flashcard",
    guidanceEn: "Build the conversation around the flashcard the learner is studying.",
    guidancePt: "Construa a conversa em torno do flashcard que a pessoa está estudando.",
    requiresCard: true,
  },
];

/** Temas oferecidos na tela; os que dependem de card ficam fora por enquanto. */
export const SELECTABLE_CHAT_TOPICS = CHAT_TOPICS.filter((t) => !t.requiresCard);

/**
 * Fase 13 — modos pedagógicos. Todos respeitam o nível escolhido; a correção
 * detalhada (formato da resposta) é da Fase 14.
 */
export type ChatMode = {
  id: "conversation" | "teacher" | "training" | "repeat";
  label: string;
  description: string;
  guidanceEn: string;
  guidancePt: string;
};

export const DEFAULT_MODE: ChatMode["id"] = "conversation";

export const CHAT_MODES: ChatMode[] = [
  {
    id: "conversation",
    label: "Conversação",
    description: "O PilotAI conversa naturalmente no idioma escolhido.",
    guidanceEn:
      "Mode: free conversation. Just chat naturally and keep the exchange going; do not correct grammar unless the learner asks.",
    guidancePt:
      "Modo: conversação livre. Converse com naturalidade e mantenha o diálogo; não corrija a gramática a menos que seja pedido.",
  },
  {
    id: "teacher",
    label: "Professor",
    description: "Conversa e aponta os erros relevantes com uma explicação curta.",
    guidanceEn:
      "Mode: teacher. First answer the conversation naturally. Then, only when there is a relevant mistake, add a short separate note with the correction, a one-line explanation and a more natural way to say it. Stay friendly and never embarrassing; ignore tiny typos.",
    guidancePt:
      "Modo: professor. Responda primeiro à conversa com naturalidade. Depois, só quando houver erro relevante, acrescente à parte uma observação curta com a correção, uma explicação de uma linha e a forma mais natural de dizer. Seja amigável, nunca constrangedor; ignore erros mínimos de digitação.",
  },
  {
    id: "training",
    label: "Treino",
    description: "O PilotAI cria uma situação simulada e assume o papel do interlocutor.",
    guidanceEn:
      "Mode: role-play training. Invent a concrete situation connected to the topic, state in one short line who you are and who the learner is, then stay in character as the other person for the whole conversation. Do not narrate or break character; keep the learner talking.",
    guidancePt:
      "Modo: treino em situação simulada. Crie uma situação concreta ligada ao tema, diga numa linha curta quem você é e quem a pessoa é, e depois permaneça no papel do interlocutor durante toda a conversa. Não narre nem saia do papel; mantenha a pessoa falando.",
  },
  {
    id: "repeat",
    label: "Repita depois de mim",
    description: "O PilotAI diz uma frase e espera você repetir.",
    guidanceEn:
      "Mode: repeat after me. Output exactly ONE short sentence for the learner to repeat out loud (3 to 12 words), suitable for the level and the topic. Never add greetings, questions, explanations, translations, quotation marks or numbering: reply with the sentence and nothing else. Never repeat a sentence already used in this conversation.",
    guidancePt:
      "Modo: repita depois de mim. Escreva exatamente UMA frase curta para a pessoa repetir em voz alta (3 a 12 palavras), adequada ao nível e ao tema. Não escreva saudações, perguntas, explicações, traduções, aspas nem numeração: responda apenas com a frase. Nunca repita uma frase já usada nesta conversa.",
  },
];

/** O modo de repetição só faz sentido em idioma estrangeiro. */
export const REPEAT_MODE: ChatMode["id"] = "repeat";

/**
 * Fase 14 — correção pedagógica. O PilotAI responde primeiro à conversa e, só
 * quando há erro relevante, acrescenta o bloco abaixo na última linha.
 * A profundidade da correção depende do nível.
 */
export const CORRECTION_MARKER = "[[CORRECAO]]";

export const CORRECTION_DEPTH: Record<ChatLevel["id"], { en: string; pt: string }> = {
  beginner: {
    en: "Correct only essential mistakes that block understanding; ignore style.",
    pt: "Corrija apenas erros essenciais que atrapalham o entendimento; ignore estilo.",
  },
  intermediate: {
    en: "Correct relevant mistakes and suggest a more natural way to say the same thing.",
    pt: "Corrija erros relevantes e sugira uma forma mais natural de dizer o mesmo.",
  },
  advanced: {
    en: "Besides mistakes, comment on naturalness, register, collocations, nuance and idiomatic usage.",
    pt: "Além dos erros, comente naturalidade, registro, colocações, nuances e uso idiomático.",
  },
};

export function findMode(id?: string | null): ChatMode {
  return CHAT_MODES.find((m) => m.id === id) ?? CHAT_MODES[0]!;
}

export function modeLabel(id?: string | null): string {
  return findMode(id).label;
}

export function findLevel(id?: string | null): ChatLevel {
  return CHAT_LEVELS.find((l) => l.id === id) ?? CHAT_LEVELS[0]!;
}

export function findTopic(id?: string | null): ChatTopic {
  return CHAT_TOPICS.find((t) => t.id === id) ?? CHAT_TOPICS[0]!;
}

export function levelLabel(id?: string | null): string {
  const level = findLevel(id);
  return `${level.label} (${level.cefr.join("–")})`;
}

export function topicLabel(id?: string | null): string {
  return findTopic(id).label;
}
