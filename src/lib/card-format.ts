// Regras de apresentação dos flashcards, válidas para TODOS os métodos de criação
// (texto colado, documento/PDF, imagens/OCR). O mesmo texto vai no prompt do PilotAI e
// a limpeza abaixo garante o formato mesmo quando o modelo desobedece.

export const CARD_SOURCE_ORDER_RULES = `SEQUÊNCIA OBRIGATÓRIA DOS FLASHCARDS:
- Entregue os cards no array final na MESMA ORDEM em que os respectivos fatos são apresentados na fonte, do início ao fim. Esta regra vale para texto, documentos e páginas, planilhas interpretadas, transcrições de áudio ou vídeo e fotos ou imagens.
- Primeiro percorra a fonte em sequência e distribua a quantidade solicitada ao longo dela; depois gere todos os cards de cada trecho antes de avançar ao trecho seguinte. Mantenha juntos os cards do mesmo trecho, seguindo a ordem interna de caput, parágrafos, incisos, alíneas, exemplos e exceções.
- Se a fonte apresenta Art. 1º, Art. 2º, Art. 3º, Art. 4º, Art. 5º e Art. 6º, todos os cards do Art. 1º vêm antes dos do Art. 2º, e assim sucessivamente; nunca coloque o Art. 6º antes do Art. 2º, nem volte ao Art. 5º depois do Art. 6º. Siga a ordem efetivamente apresentada, não uma ordenação numérica inventada quando a fonte tiver outra sequência.
- Em áudio e vídeo, preserve a ordem temporal da transcrição. Em documentos e imagens, preserve a sequência das páginas ou imagens enviadas e a ordem de leitura de cada uma, respeitando colunas e blocos.
- NÃO embaralhe nem reagrupe os cards por tema, relevância, dificuldade ou formato. Se combinar pergunta e resposta, múltipla escolha e lacuna, varie o formato SEM alterar a sequência da fonte.
- Antes de entregar, confira o array inteiro: nenhum card de um trecho posterior pode aparecer antes dos cards de um trecho anterior. Não acrescente campos ao formato de retorno para indicar a ordem.`;

export const CARD_STYLE_RULES = `${CARD_SOURCE_ORDER_RULES}

ESTILO OBRIGATÓRIO DO TEXTO DOS CARDS:
- Múltipla escolha: as alternativas ficam em COLUNA, uma por linha, cada linha começando com a letra minúscula seguida de parêntese de fechamento e um espaço, nesta ordem exata:
a) primeira alternativa
b) segunda alternativa
c) terceira alternativa
d) quarta alternativa
Nunca escreva as alternativas em texto corrido na mesma linha. Nunca coloque o gabarito na frente do card.
- Proibido usar ícones, emojis ou asteriscos em qualquer campo.
- Proibido usar aspas simples ou duplas para destacar palavras.
- Proibido usar parênteses, exceto o fechamento das letras das alternativas.
- Sem Markdown, sem negrito, sem listas com marcadores.`;

export const CARD_GENERATION_FORMAT_RULES = `FORMATOS (obrigatório): divida os flashcards em três formatos, na mesma proporção (1/3 cada), alternando em sequência:
 - "qa": pergunta objetiva e simples na frente; resposta curta no verso.
 - "cloze": frase de completar na frente, com a palavra/expressão-chave substituída por "_____"; o verso traz o termo que completa a lacuna.
 - "mcq": pergunta na frente e, depois dela, as 4 alternativas em COLUNA, uma por linha, no formato "a) ...", "b) ...", "c) ...", "d) ..." (só uma correta). As 4 alternativas ficam DENTRO do campo "question", cada uma em sua própria linha, separadas por \\n. O gabarito vai SOMENTE no "answer", começando pela letra correta e sua alternativa, com explicação curta.
Linguagem simples, voltada à memorização.
${CARD_STYLE_RULES}
REFERÊNCIA (obrigatória em TODO card): "reference" indica a fonte exata, por exemplo Enunciado 315 do FPPC, Art. 15 do Código Civil, Súmula 7 do STJ, ou o capítulo/seção do material, e "source_text" traz o texto INTEGRAL do enunciado/artigo/trecho sem resumir: literal quando a fonte for norma oficial ou texto já na norma culta; quando for fala, transcrição ou texto com desvios, redigido na norma culta formal, fiel ao sentido.`;

/** Regras de atomicidade, lacuna conceitual e quantidade-meta, comuns a todos os métodos. */
export function cardQuantityAndAtomicRules(requestedCards: number): string {
  return `QUANTIDADE (meta obrigatória): gere EXATAMENTE ${requestedCards} flashcards, nem mais nem menos. Ajuste a granularidade a essa meta: quanto maior o número, mais granulares e detalhados os cards, descendo a cada parágrafo, inciso, alínea, exceção, prazo e requisito. Só entregue menos se o material literalmente não tiver fatos distintos suficientes; nunca repita cards para completar.
CARDS ATÔMICOS (obrigatório): cada flashcard cobre UM ÚNICO fato, regra, exceção, prazo ou inciso. É PROIBIDO criar cards cumulativos ou enumerativos que peçam para listar, citar ou recitar vários incisos, itens, requisitos ou hipóteses juntos. Se o texto trouxer vários incisos ou itens, cada um vira um card próprio e individual.
LACUNA CONCEITUAL (cloze): o "_____" deve cobrir a expressão técnica ou o núcleo conceitual COMPLETO (ex.: lacuna em "registro público", nunca só em "público"). Proibido lacunar palavras genéricas, artigos, preposições, conectivos ou termos triviais. FIDELIDADE DA LACUNA: a frase da frente deve ser o trecho LITERAL da fonte (ou, em fala/transcrição, sua versão na norma culta) com apenas o termo-resposta trocado por "_____"; nunca acrescente, remova ou reescreva palavras ao redor. Antes de responder, substitua mentalmente "_____" pela resposta: o resultado deve ser idêntico ao texto da fonte e não pode repetir a mesma ideia (ex. errado: "dirige a _____ da prestação" = "direção", pois a lei diz "dirige a prestação"; certo: "admite, assalaria e _____ a prestação pessoal de serviço" = "dirige").
INSTRUÇÕES DO USUÁRIO: quando houver orientação, contexto ou instrução adicional do usuário, ela é obrigatória e deve ser seguida em qualquer escopo, desde que não contrarie o material nem estas regras de formato.`;
}

const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{20E3}\u{E000}-\u{F8FF}]/gu;

const OPTION_LINE_RE = /^[a-d]\)\s/;

/** Separates a multiple-choice prompt from its canonical column of options. */
export function splitCardQuestionOptions(
  question: string,
): { prompt: string; options: string[] } | null {
  const lines = question.replace(/\r/g, "").split("\n");
  const firstOption = lines.findIndex((line) => OPTION_LINE_RE.test(line.trim()));
  if (firstOption < 0) return null;

  const options: string[] = [];
  for (const rawLine of lines.slice(firstOption)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (OPTION_LINE_RE.test(line)) options.push(line);
    else if (options.length) options[options.length - 1] += ` ${line}`;
  }
  if (options.length < 2) return null;

  return {
    prompt: lines.slice(0, firstOption).join("\n").trim(),
    options,
  };
}

/** Quebra alternativas escritas em texto corrido em uma linha por alternativa. */
function splitOptionsIntoColumn(text: string): string {
  let out = text.replace(
    /(^|[\s.;,:!?])\(?([A-Da-d])\)\s*/g,
    (m, pre: string, letter: string, offset: number) => {
      // a primeira letra "a)" pode estar logo após a pergunta
      const nl = offset === 0 ? "" : "\n";
      return `${pre.trim() ? pre.trimEnd() + "\n" : nl}${letter.toLowerCase()}) `;
    },
  );
  out = out.replace(/\n{3,}/g, "\n\n");
  return out;
}

/** Remove emojis, asteriscos, aspas de ênfase e parênteses. */
function cleanChars(text: string): string {
  const lines = text.split("\n").map((line) => {
    const isOption = OPTION_LINE_RE.test(line.trim());
    let l = line
      .replace(EMOJI_RE, "")
      .replace(/\*+/g, "")
      .replace(/[“”„‟"]/g, "")
      .replace(/[‘’‚‛]/g, "'")
      .replace(/(?<=\p{L})'(?=\p{L})/gu, "\u0000") // preserva apóstrofo interno (l'art)
      .replace(/'/g, "")
      .replace(/\u0000/g, "'");
    if (isOption) {
      const head = l.slice(0, 3);
      const rest = l
        .slice(3)
        .replace(/\(([^()]*)\)/g, " $1 ")
        .replace(/[()]/g, "");
      l = head + rest;
    } else {
      l = l.replace(/\(([^()]*)\)/g, " $1 ").replace(/[()]/g, "");
    }
    return l
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\s+([.;,:!?])/g, "$1")
      .trimEnd();
  });
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Aplica todas as regras à frente do card. Também tira o gabarito vazado. */
export function formatCardQuestion(question: string): {
  question: string;
  leakedAnswer: string | null;
} {
  let q = question.replace(/\r/g, "");
  let leaked: string | null = null;
  const gab = q.match(/\n?\s*(?:gabarito|resposta correta|resposta)\s*:\s*([\s\S]*)$/i);
  if (gab) {
    leaked = cleanChars(splitOptionsIntoColumn(gab[1].trim()));
    q = q.slice(0, gab.index ?? q.length);
  }
  q = splitOptionsIntoColumn(q);
  return { question: cleanChars(q), leakedAnswer: leaked || null };
}

/** Aplica todas as regras ao verso do card. */
export function formatCardAnswer(answer: string): string {
  return cleanChars(splitOptionsIntoColumn(answer.replace(/\r/g, "")));
}

/** Quebra textos normativos corridos em uma linha por artigo, parágrafo, inciso ou alínea. */
export function structureSourceText(text: string): string {
  let s = text.replace(/\r/g, "").replace(/[ \t]+/g, " ");
  // Art. no meio do texto inicia nova linha
  s = s.replace(/([.;:])\s+(?=Art(?:igo|\.)\s*\d)/g, "$1\n");
  // parágrafos
  s = s.replace(/\s+(?=(?:§\s*\d|Parágrafo único))/g, "\n");
  // incisos escritos por extenso
  s = s.replace(/\s+(?=Inciso\s+[IVXLCDM]+\b)/g, "\n");
  // incisos em romano: "I - ", "II – "
  s = s.replace(/([:;.])\s+([IVXLCDM]{1,6})\s*[-–—]\s+/g, "$1\nInciso $2: ");
  s = s.replace(/^([IVXLCDM]{1,6})\s*[-–—]\s+/gm, "Inciso $1: ");
  // alíneas após ponto e vírgula ou dois pontos: "a) "
  s = s.replace(/([:;])\s+(?=[a-z]\)\s)/g, "$1\n");
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

const REFERENCE_LABELS: Record<string, [string, string]> = {
  pt: ["Referência", "Material enviado"],
  en: ["Reference", "Submitted material"],
  es: ["Referencia", "Material enviado"],
  fr: ["Référence", "Matériel envoyé"],
  de: ["Referenz", "Eingereichtes Material"],
  it: ["Riferimento", "Materiale inviato"],
};

/** Monta o verso final juntando resposta, referência e texto integral da fonte. */
export function buildAnswerWithReference(
  answer: string,
  reference: string,
  sourceText: string,
  lang?: string,
): string {
  let out = formatCardAnswer(answer);
  const ref = cleanChars(reference.replace(/\s+/g, " ").trim());
  const src = cleanChars(structureSourceText(sourceText.trim()));
  if (ref || src) {
    const [label, fallback] =
      REFERENCE_LABELS[(lang ?? "pt").toLowerCase().split(/[-_]/)[0]!] ?? REFERENCE_LABELS["en"]!;
    out += `\n\n${label}: ${ref || fallback}`;
    if (src) out += `\n\n${src}`;
  }
  return out.trim();
}

export const SOURCE_TEXT_RULES = `FORMATAÇÃO DA REFERÊNCIA E DO TEXTO FONTE:
- "reference" em uma linha curta e formal, seguindo convenções de citação: por exemplo Art. 9º do Código Civil, Art. 5º, Inciso XI, da Constituição Federal, Art. 1º, § 1º, da Lei 8.112/1990, Súmula 7 do STJ, ou Capítulo 3, Seção 2 do material.
- "source_text" limpo, hierárquico e legível, NUNCA em texto corrido embolado. Em lei, norma ou texto estruturado, use \\n para colocar cada elemento em sua própria linha: primeiro a identificação do artigo, depois o caput, depois cada parágrafo, inciso e alínea, assim:
Art. 9º do Código Civil
Serão registrados em registro público:
Inciso I: os nascimentos, casamentos e óbitos;
Inciso II: a emancipação por outorga dos pais ou por sentença do juiz;
Inciso III: a interdição por incapacidade absoluta ou relativa.
- Parágrafos como § 1º, § 2º ou Parágrafo único, cada um em linha própria. Ordinais até o nono com º. Em material de estudo não normativo, separe ideias em linhas curtas e organizadas.`;

/** Aplica frente e verso de uma vez, devolvendo o par já limpo. */
export function formatCardPair(
  question: string,
  answer: string,
): { question: string; answer: string } {
  const { question: q, leakedAnswer } = formatCardQuestion(question);
  let a = formatCardAnswer(answer);
  if (leakedAnswer && !a.toLowerCase().includes(leakedAnswer.toLowerCase().slice(0, 20))) {
    a = a ? `${leakedAnswer}\n\n${a}` : leakedAnswer;
  }
  return { question: q, answer: a };
}
