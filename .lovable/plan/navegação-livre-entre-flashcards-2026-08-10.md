# Navegação livre entre flashcards

Adicionar setas de navegação (esquerda/direita) ao redor do flashcard na tela de estudo, permitindo avançar e voltar entre os cards da fila **sem** registrar avaliação (lembrei/errei/difícil) e sem alterar o agendamento SM-2.

## Comportamento

- Seta esquerda: vai para o card anterior da fila. Desabilitada no primeiro card.
- Seta direita: vai para o próximo card. Desabilitada no último card.
- Nenhuma revisão é gravada no banco; o card continua pendente e permanece na fila.
- O card é sempre exibido pela frente ao navegar (reset do flip já ocorre ao mudar de pergunta).
- O contador "N / total" e a barra de progresso acompanham a posição atual.
- Suporte a teclado: setas ← e → fazem a mesma navegação.
- Em telas pequenas, as setas ficam sobrepostas nas bordas laterais do card (semitransparentes) para não empurrar o layout; em telas maiores, ficam ao lado do card.

## Detalhes técnicos

- Arquivo: `src/routes/_authenticated/study.tsx`.
- Envolver o `<FlipCard>` em um container relativo com dois botões de ícone (`ChevronLeft` / `ChevronRight` do lucide-react), com `aria-label` de navegação.
- Handlers `goPrev` / `goNext` apenas atualizam `idx` e `activeCardId` para o card vizinho da `queue`, reaproveitando a mesma lógica de persistência de posição já existente (o efeito que salva `cardId` no localStorage).
- Não tocar em `done`, nem chamar mutações de review — apenas movimentação de índice.
- Listener de teclado via `useEffect` (ignorar quando o foco estiver em `input`/`textarea` para não interferir na edição e no campo "Minha resposta").
