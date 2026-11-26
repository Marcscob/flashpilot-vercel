# Corrigir a barra de progresso da tela de estudo

## O problema

Na tela de estudo existem dois indicadores que usam contas diferentes:

- O texto "11 / 175" usa a **posição do card atual na fila**.
- A barra colorida usa um contador separado (`done`) que é **salvo no navegador** e restaurado ao reabrir a tela.

Como os cards já avaliados saem da fila do dia a cada recarregamento, o total encolhe enquanto o contador salvo continua alto. Resultado: você está no card 11 de 175, mas a barra aparece na metade.

## O que vai mudar

- A barra passa a refletir exatamente o mesmo que o texto: percentual = posição do card atual dividida pelo total da fila.
- O contador salvo (`done`) deixa de comandar a barra; ele continua sendo usado só para retomar de onde parou.
- A condição de "sessão concluída" passa a depender da fila realmente vazia (ou do último card avaliado), não do contador salvo — hoje um `done` inflado pode fechar a sessão antes da hora.

## Detalhe técnico

Arquivo: `src/routes/_authenticated/study.tsx`

- `progressPct` passa a ser calculado de `visibleIdx` e `total`, em vez de `done / total`.
- A checagem `done === total` na tela de conclusão é substituída por checagem baseada na fila (`total === 0`), evitando falso "concluído".
- `done` continua sendo persistido junto com o `cardId` para restaurar a posição, sem influenciar a UI de progresso.
