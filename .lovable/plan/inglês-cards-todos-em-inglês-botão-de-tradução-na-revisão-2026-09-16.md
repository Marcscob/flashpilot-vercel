# Inglês: cards todos em inglês + botão de tradução na revisão

Dois passos separados.

## Passo 1 — Correção nos bastidores (banco de dados)

Eu mesmo corrijo agora, sem botão e sem tela: varro os 178 cards da matéria "Inglês - Gramática" (assuntos "Noções Gerais" e "Substantivos e Artigos"), pego todos que têm pelo menos uma palavra em português e passo o texto para inglês, gravando direto nos cards.

Regras da tradução:
- O exercício continua fazendo sentido: card de lacuna mantém a lacuna coerente com a resposta; card de múltipla escolha mantém as quatro alternativas e a mesma letra correta.
- Rótulos internos também em inglês: "Resposta completa:" → "Full answer:", "Alternativa B)" → "Option B)".
- Cards já 100% em inglês ficam intactos.
- Só o texto muda. Imagens, vídeos, favoritos, ordem, agenda de revisão e vínculos com anotações continuam exatamente como estão.
- Antes de gravar, guardo o texto original de cada card, então nada se perde.

No fim eu te digo quantos cards foram traduzidos e mostro alguns exemplos para você conferir.

## Passo 2 — Botão "traduzir" dentro do flashcard

Na revisão, quando o card é de uma matéria com idioma estrangeiro, aparece um botãozinho discreto no canto do card: **Traduzir**.

- Ao tocar, o texto que está à vista (a pergunta, ou a resposta quando o card está virado) é traduzido para o português na hora, mostrado logo abaixo do texto original.
- Tocando de novo, a tradução desaparece. É só uma ajuda momentânea: nada é gravado e o card não muda.
- A tradução é lembrada enquanto você estiver naquele card, para não repetir a espera nem gastar crédito duas vezes.
- Vale só para o texto — imagens, vídeos e áudio não mudam.
- Em matérias sem idioma (Direito, etc.) o botão nem aparece, e nada muda no que existe hoje.

## Detalhes técnicos

Passo 1 (nos bastidores, sem código de produto novo):
- Script pontual no meu ambiente: lê os cards por `topics.subject_id` da matéria de inglês, pré-filtra os que têm marcas de português (acentos, palavras funcionais, rótulos "Resposta completa"/"Alternativa"), traduz em lotes pelo gateway com `openai/gpt-6-astra` (`reasoning_effort: "low"`) usando prompt específico por `card_format` (`plain`, `cloze`, `mcq`) e saída JSON estrita.
- Gravação via `run_sql`: `question_original`/`answer_original` recebem o texto atual **apenas quando estão vazios**; `question`/`answer` recebem a tradução; `rewritten_at = now()`, `conversion_reason = 'translate:en'`. Nada de mudança de schema; `card_format`, `language`, `order_index` e campos SM-2 intocados.
- Limpeza de marcações reaproveitando `stripMarkup` (`language-chat.server.ts`), para não voltar asterisco nenhum.

Passo 2:
- `src/lib/translate-text.server.ts` (novo): `translateToPortuguese(text, sourceLang)` — mesma rota de gateway e modelo, prompt "traduza para português do Brasil, só o texto, preservando lacunas e letras das alternativas".
- `src/lib/translate-text.functions.ts` (novo): `translateCardText` com `requireSupabaseAuth`, entrada `{ text, lang }` validada por zod, limite de tamanho, registro em `ai_usage` (`kind: 'translate'`).
- `src/components/FlipCard.tsx`: botão `Languages` visível só quando há `lang` estrangeiro (mesma condição já usada pelo botão "Praticar"); `useMutation` chamando a função; cache local por face (`{ front?: string; back?: string }`) e limpeza quando o card muda; tradução renderizada abaixo do texto, em estilo secundário; erro mostra toast e não altera o card.
- `src/lib/i18n.tsx`: rótulos do botão e da mensagem de erro.

## Fora deste escopo

- Matéria "Espanhol" (posso fazer depois com o mesmo procedimento).
- Cards de outras matérias, que continuam iguais.
