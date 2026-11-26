# Revisão por matéria: assunto no topo do card, embaralhar e ordem alfabética

## 1. Mostrar o assunto no topo do card
Hoje o topo do card mostra o tipo ("Múltipla escolha" / "Completar"). Essa etiqueta sai e no lugar aparece o assunto do card, no formato `Assunto` ou `Assunto › Subtópico` quando o card estiver em um subtópico.

O rodapé/linha acima do card já mostra "Matéria · Tópico"; ela passa a mostrar só a matéria, para não repetir a informação.

## 2. Botão "Embaralhar"
Na barra superior da tela de estudo, um botão embaralha a fila de flashcards em ordem aleatória, imediatamente, a qualquer momento da revisão. Cada clique gera uma nova ordem aleatória.

## 3. Botão "Ordem dos assuntos (A–Z)"
Um segundo botão devolve a fila para a ordem alfabética: assunto A–Z, depois subtópico A–Z, e dentro de cada um a ordem já definida dos cards (order_index). Ex.: Competência → Cooperação internacional → ...

Os dois botões são alternáveis a qualquer momento, sem sair da revisão. O modo escolhido fica lembrado por sessão de estudo (mesma chave de progresso já usada hoje), e o card visível no momento continua sendo o mesmo após a troca de ordem — só a sequência seguinte muda. O contador de progresso (X / Y) e a barra acompanham a nova posição.

## Detalhes técnicos
- `src/components/FlipCard.tsx`: remover `FORMAT_LABEL`/`formatLabel` da renderização; nova prop `topicLabel?: string` exibida no mesmo lugar (mantendo o estilo atual do badge).
- `src/routes/_authenticated/study.tsx`:
  - a query já traz `topics(name, parent_id?)`; incluir `parent_id` e o nome do assunto pai no `STUDY_CARD_SELECT` (`topics!inner(name, parent_id, review_enabled, subject_id, subjects(name, color), parent:topics!topics_parent_id_fkey(name))`) para montar `Assunto › Subtópico`.
  - novo estado `orderMode: "alpha" | "shuffle"` + `shuffleSeed`, persistidos junto com o progresso no localStorage.
  - fila derivada via `useMemo`: em `alpha`, ordenar por nome do assunto, nome do subtópico, `order_index`, `id` (usando `localeCompare` pt-BR); em `shuffle`, embaralhamento determinístico pela seed.
  - a navegação já usa `activeCardId`, então o card atual permanece na tela após reordenar.
- Sem mudanças no banco de dados nem na lógica de repetição espaçada (SM-2).
