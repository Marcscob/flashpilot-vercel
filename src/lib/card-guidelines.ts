import {
  CARD_GENERATION_FORMAT_RULES,
  SOURCE_TEXT_RULES,
  cardQuantityAndAtomicRules,
} from "./card-format";

/**
 * Orientações de criação de flashcards compartilhadas por TODAS as telas que geram cards
 * (landing e Bulk v2: texto, documento, foto, áudio, YouTube). Qualquer regra nova de
 * criação entra aqui, para valer igual nos dois lugares.
 */
export const CONTENT_RELEVANCE_RULES = `RELEVÂNCIA DO CONTEÚDO (obrigatório): crie flashcards SOMENTE a partir do conteúdo de estudo do material (conceitos, regras, definições, fórmulas, exemplos, passos e fatos). IGNORE saudações e apresentação de quem fala, propaganda e patrocínios, pedidos de curtida/inscrição/comentário, piadas, conversa fora do assunto, avisos sobre outros vídeos ou cursos e enrolação. Nunca crie card sobre quem está falando, sobre o canal ou sobre a própria gravação. Se o material não tiver conteúdo de estudo, devolva a lista de cards vazia.`;

export const STANDARD_LANGUAGE_RULES = `NORMA CULTA OBRIGATÓRIA (qualquer fonte): o material pode vir de legenda automática, transcrição de áudio ou vídeo, página web ou texto com desvios. NUNCA incorpore desvios linguísticos aos cards: elimine marcas de oralidade e cacoetes (né, tá, aí, olha, você sabe que, vocativos como professora), repetições, anacolutos (essa pessoa ele), palavras truncadas, erros de transcrição, gírias e erros de concordância, regência, acentuação ou pontuação. Reescreva pergunta, resposta, alternativas, lacunas e "source_text" na norma culta formal do idioma de saída, em períodos completos e bem pontuados, com siglas em maiúsculas, preservando exatamente o sentido, os fatos, números e dispositivos citados, sem acrescentar fatos. A cópia literal só vale para texto normativo oficial (lei, decreto, súmula) e para texto já escrito na norma culta; mesmo nesses casos corrija erros evidentes de digitação ou extração.`;

export const PROGRAMMING_EXAMPLE_RULES = `PROGRAMMING EXAMPLES — strict language fidelity:
Identify the programming language and version from the source and subject/topic/card context, not from the UI language. Use only that language's real, syntactically valid, idiomatic code. Never mix languages or present pseudocode as executable code. If the language is ambiguous, explicitly state that it is unspecified rather than guess a language or invent hybrid code.
Use the source's explicit version; otherwise use Python 3 for Python. Python blocks require a colon and four-space indentation; never use C/JavaScript-style block braces or place a compound if statement after an assignment on the same line. Do not flatten multiline code to fit a short example, word limit or video bullet. Keep newlines and leading spaces intact in JSON strings (escaped as needed).
Python 3 example:
x = 5 + 3
if x > 0:
    print(x)
End Python 3 example.
The hybrid example x = 5 + 3; if (x > 0) { print(x); } is NOT Python. Python dictionaries/sets may legitimately use braces; avoid blanket bans on punctuation. Other languages must follow their own grammar and output functions (e.g. console.log in JavaScript, printf with required declarations/includes in C, System.out.println in Java); never substitute one language's API for another.
Before returning, review each example against the target grammar, indentation, required definitions/imports and the concept taught. Reuse existing code only if valid for the target language; correct a malformed example rather than propagate it into notes or video scenes. Never claim it was executed or compiler-validated unless it actually was.`;

export const MICRO_PRACTICAL_EXAMPLE_RULE = `- EXEMPLO OBRIGATÓRIO: se a matéria/assunto/cards forem de programação OU de estudo de idiomas (português, inglês, espanhol etc.), é obrigatório terminar o "content" com uma linha própria "Exemplo:", quebra de linha e um exemplo prático que aplique exatamente o que o texto acabou de explicar (se o texto cita "criação de uma variável" ou "exibição de um valor", mostre esse código; se cita uma regra gramatical, tempo verbal ou vocabulário, mostre 1 a 3 frases reais usando-a, no idioma estudado, com tradução curta quando útil). Nunca omita o exemplo nesses casos. Nas demais matérias não acrescente.`;

export const PRACTICAL_EXAMPLE_RULES = `EXEMPLOS PRÁTICOS (programação e idiomas): quando a matéria for linguagem de programação ou estudo de idiomas (português, inglês, espanhol etc.), o verso de cada card termina, depois da resposta e da justificativa, com uma linha "Exemplo:" seguida de um exemplo prático curto e correto do que foi perguntado (trecho de código funcional ou frase real de uso no idioma estudado, aplicando exatamente a regra, tempo verbal ou vocabulário tratado, com tradução curta quando útil). Nunca omita esse exemplo nessas matérias. Nas demais matérias não acrescente essa linha.
${PROGRAMMING_EXAMPLE_RULES}`;

export const PEDAGOGICAL_DENSITY_RULES = `FILTRO DE DENSIDADE PEDAGÓGICA (obrigatório): antes de criar qualquer card ou bloco, verifique se o trecho contém conteúdo técnico, conceitual, factual ou normativo real. DESPREZE COMPLETAMENTE: prefácios, apresentações do livro/eBook, agradecimentos, sumários e ementas ("Vamos abordar os seguintes tópicos..."), metadados de leitura (ex.: "1 min restantes no capítulo", porcentagens, números de página, cabeçalhos repetidos), promessas de conteúdo futuro ("Ao longo deste eBook você aprenderá...", "Neste capítulo guiaremos você..."), frases de transição ou motivacionais ("Agora que vimos isso, vamos lá!", "Vamos começar?", "um bom começo é meio caminho andado"), metáforas genéricas e obviedades sem valor técnico ("é como construir uma casa"), e autopromoção do autor (indicação de outros livros, cursos, links, "clique aqui", "o guia que preparei para você"). Em trechos mistos, aproveite SOMENTE as afirmações técnicas (definições, regras, comandos, fatos) e descarte o restante; nunca descarte um bloco inteiro só porque começa com enrolação. Se o trecho não tiver nada ensinável, não gere cards dele em vez de forçar cards artificiais.`;

export const DESTINATION_NAMING_RULES = `NOMES DE MATÉRIA E ASSUNTO (obrigatório): "subject" é a disciplina geral do conteúdo (ex.: Física, Direito Civil, Inglês) e "topic" é o assunto específico tratado (ex.: Velocidade média, Present Perfect). Devem ser específicos, curtos, no idioma de saída e derivados do conteúdo. NUNCA use nomes genéricos como "Flashcards", "Material", "Resultado do teste", "Matéria Demo", "Assunto Demo" nem o nome do aplicativo.`;

export function sharedCardGuidelines(options: {
  requestedCards: number;
  destination: boolean;
}): string {
  return [
    cardQuantityAndAtomicRules(options.requestedCards),
    SOURCE_TEXT_RULES,
    CARD_GENERATION_FORMAT_RULES,
    CONTENT_RELEVANCE_RULES,
    STANDARD_LANGUAGE_RULES,
    PEDAGOGICAL_DENSITY_RULES,
    PRACTICAL_EXAMPLE_RULES,
    ...(options.destination ? [DESTINATION_NAMING_RULES] : []),
  ].join("\n");
}
