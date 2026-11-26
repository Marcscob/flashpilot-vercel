# Reescrita única dos flashcards (múltipla escolha / completar)

Operação **única**, sem tela de administração: eu rodo o processamento aqui pelo sandbox, direto no banco. Daqui para frente você já cria os cards no novo formato.

## Custo em créditos

Base real medida nos logs deste projeto: o Gemini Flash custou **0,0307 crédito para ~4.600 tokens** (log `019f728d`, 18/07) — ou seja ~0,0067 crédito por mil tokens.

Base atual: 2.314 cards, 582 mil caracteres (~150 mil tokens de conteúdo). Somando prompt repetido por lote e a saída (alternativas + justificativa, ~2x a entrada): ~620 mil tokens.

| Etapa | Tokens | Créditos de IA |
|---|---|---|
| Teste — 50 cards de Direito Constitucional | ~15 mil | **~0,10** |
| Base completa — 2.314 cards | ~620 mil | **~4,2** |

**Resposta curta: menos de 5 créditos de IA para reescrever tudo.** O teste custa cerca de 0,1 crédito.

Fora isso há o custo do build em si (migração + ajuste de renderização do card), que é a parte maior — estimo poucas mensagens de build, não dá para cravar número.

## Como será feito

1. Migração pequena: colunas `question_original`, `answer_original`, `card_format` (`plain`/`mcq`/`cloze`) e `rewritten_at` em `flashcards`.
2. O texto atual é copiado para as colunas `_original` antes de qualquer reescrita — dá para reverter tudo com um comando.
3. Eu rodo um script em lotes de ~10 cards contra o Gemini Flash com os seus prompts, gravando pergunta/resposta novas no mesmo card (id, histórico SM-2, favoritos e imagens intactos).
4. Cards com imagem/mapa mental ou texto curto demais são pulados (a IA devolve "manter original").
5. `FlipCard.tsx` passa a renderizar conforme `card_format`: múltipla escolha mostra A–D na frente e gabarito + justificativa no verso; completar mostra a frase com `____` na frente e completa no verso.

## Sequência

1. Você me passa os prompts validados (múltipla escolha e completar).
2. Rodo nos 50 cards de Direito Constitucional e te mostro o antes/depois.
3. Aprovado, rodo os 2.314 e te informo o consumo real medido nos logs.
