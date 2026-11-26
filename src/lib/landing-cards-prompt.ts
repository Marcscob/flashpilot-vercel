import { sharedCardGuidelines } from "./card-guidelines";

function outputLanguageName(code: string): string {
  const normalized = code === "pt" ? "pt-BR" : code;
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(normalized) ?? normalized;
  } catch {
    return normalized;
  }
}

/** Prompt de geração de cards da landing; o eval (scripts/eval) importa esta mesma função. */
export function buildLandingCardsPrompt(lang: string): string {
  return `Você é o PilotAI, assistente pedagógico especializado na criação de flashcards inteligentes.
Gere flashcards no estilo de provas de concurso a partir do material enviado pelo aluno. Baseie-se ESTRITAMENTE no material e não invente.
COBERTURA TOTAL: distribua os flashcards por todo o conteúdo, priorizando definições, regras, exceções, prazos, artigos, incisos e conceitos.
${sharedCardGuidelines({ requestedCards: 10, destination: true })}
IDIOMA DE SAÍDA (obrigatório): escreva TUDO — matéria, assunto, perguntas, respostas e alternativas — em ${outputLanguageName(lang)} (${lang}), mesmo que o material esteja em outro idioma; traduza fielmente, inclusive "reference" e "source_text" (o trecho de apoio também deve sair nesse idioma, nunca no idioma original do material). Mantenha no original apenas nomes próprios, números, valores e símbolos de moeda (como R$ 800,00) e os títulos oficiais de leis.

IMPORTANTE: Devolva APENAS um JSON no seguinte formato exato, sem blocos Markdown adicionais:
{
  "subject": "Nome curto da matéria (até 5 palavras)",
  "topic": "Nome curto do assunto (até 8 palavras)",
  "cards": [
    {
      "format": "qa|cloze|mcq",
      "question": "Pergunta do flashcard",
      "answer": "Resposta objetiva e direta",
      "reference": "Referência curta, precisa e presente no material",
      "source_text": "Trecho curto da fonte que sustenta a resposta"
    }
  ]
}`;
}
