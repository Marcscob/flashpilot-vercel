# Reescrita dos flashcards — prompt final validado

Rodei o prompt com as suas 6 regras novas em **30 cards reais** de Direito Constitucional, em lotes de 10 (nada gravado no banco). Antes/depois completo: `simulacao-prompt-v4.json`.

## Resultado da simulação

| Métrica | Antes (v3) | Agora (com as suas regras) |
|---|---|---|
| JSON inválido | 0 | **0** |
| Distribuição | 14 completar / 1 MCQ | **19 completar / 11 MCQ** |
| Palavra sem valor (sim/não) oculta | 3 | **0** |
| Dois conceitos no mesmo trecho | 1 | **0** |
| `hidden_text` literal na resposta | 11 de 14 | **17 de 19** |
| Custo projetado (2.314 cards) | ~12,5 créditos | **~4,1 créditos** |

As Regras 2, 3 e 5 zeraram os respectivos defeitos, e a Regra 6 fez a IA mandar para múltipla escolha exatamente os cards de sim/não — que era o comportamento desejado.

Exemplos gerados:
```text
completar: "Perda superveniente de objeto e extinção da ação sem julgamento de mérito."
           -> oculta "Perda superveniente de objeto"
MCQ:       "O efeito vinculante das decisões do STF em controle abstrato atinge o
            Poder Legislativo em sua função típica?" + 4 alternativas
```

## Único ponto residual: ~10% de `hidden_text` ainda não literal

Mesmo com a Regra 1, 2 de 19 vieram fora do texto exato (ex.: devolveu `"Recurso Extraordinário"` para uma resposta que não continha essa expressão literal). É comportamento estatístico do modelo, não falha de especificação — por isso a validação tem que estar no script, não só no prompt:

1. `hidden_text` é substring literal da resposta → grava cloze (`literal_match`).
2. Não é literal, mas casa ignorando acento, caixa, pontuação e cifrão (`$ex$ $tunc$` ↔ `ex tunc`) → grava cloze usando o trecho **original do banco** (`normalized_match`).
3. Não casa de jeito nenhum → **converte direto para múltipla escolha, sem nova chamada à IA** (`forced_mcq`).

Para que o passo 3 não precise de segunda chamada, o prompt passa a exigir que **todo resultado `completion` já venha acompanhado de um bloco MCQ de reserva** (enunciado, 4 alternativas, gabarito, explicação), gerado na mesma resposta. Se a lacuna não puder ser aplicada, o script usa esse bloco que já está em mãos. Custo praticamente igual (poucos tokens de saída a mais), zero variabilidade e zero risco de duas respostas diferentes para o mesmo card.

Nunca há gravação de um cloze com lacuna inexistente.

## Rastro da decisão (`conversion_reason`)

Cada card gravado recebe o motivo da decisão, para auditoria posterior sem rodar a IA de novo:

| Valor | Significado |
|---|---|
| `literal_match` | cloze com trecho exato |
| `normalized_match` | cloze após normalização de acento/pontuação |
| `forced_mcq` | ia escolheu cloze, mas a lacuna não pôde ser aplicada → usou o MCQ de reserva |
| `multiple_choice_by_rules` | a própria árvore de decisão indicou MCQ |
| `image_skipped` | card com imagem/mapa mental, não convertido |
| `empty_answer` | card sem resposta utilizável, não convertido |

Com isso dá para responder na hora quantos cards foram forçados, quantos precisaram de normalização e quantos foram ignorados.


## Backup antes de qualquer alteração

Nada é gravado antes do backup completo. São duas camadas:

1. **Backup externo (arquivo).** Exporto três CSVs para download em `/mnt/documents/backup-flashcards/`, com data no nome:
   - `flashcards.csv` — todos os cards com matéria, assunto/tópico, pergunta, resposta, resposta pessoal, imagem, nota vinculada, ordem, favorito e todo o estado de revisão (ease, intervalo, repetições, próxima data).
   - `subjects.csv` e `topics.csv` — a hierarquia completa, para reconstruir matéria/assunto/subtópico.
   Como o arquivo carrega os `id` originais, dá para restaurar **um card, um tópico, um assunto ou uma matéria inteira** isoladamente, sem mexer no resto.
2. **Backup dentro do banco.** Cada card reescrito guarda o texto anterior em `question_original` / `answer_original` e a data em `rewritten_at`. O comando `--revert` desfaz tudo (ou só uma matéria/assunto/tópico) direto dessas colunas, sem precisar do arquivo.

## Sequência de execução

1. Gero e te entrego os três CSVs de backup.
2. Migração que adiciona a coluna `conversion_reason` em `flashcards`.
3. Ajusto o script: prompt final, MCQ de reserva embutido, validação em 3 níveis sem segunda chamada, lotes de 10.
4. **Piloto: 50 cards de Direito Constitucional**, gravados de verdade, com o resumo de `conversion_reason`.
5. Você estuda com eles por um ou dois dias (ou eu reverto os 50 num comando).
6. Aprovado, rodo os 2.314 restantes (~4 créditos, cerca de 230 requisições).

## Parte técnica

- Colunas `question_original`, `answer_original`, `card_format`, `rewritten_at` já existem em `flashcards`; falta apenas `conversion_reason text`.
- Gravação: `card_format = 'cloze'` mantém a resposta original e guarda o trecho oculto; `card_format = 'mcq'` guarda enunciado + alternativas em `question` e gabarito + explicação em `answer`. O `notes` é anexado ao final da resposta, no mesmo padrão de "Pegadinha/Referência" já usado.

- `FlipCard.tsx` ganha renderização própria: cloze mostra a frase com a lacuna na frente e o trecho revelado no verso; MCQ mostra as alternativas A–D com destaque do gabarito ao virar.
- Cards com imagem/mapa mental e cards sem resposta são pulados.
- Script roda no sandbox contra o gateway (Gemini Flash), em lotes de 10, com modo `--revert` para desfazer tudo a partir das colunas de backup.
