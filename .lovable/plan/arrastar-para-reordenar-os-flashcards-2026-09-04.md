# Arrastar para reordenar os flashcards

## O que muda para você

Em cada lista de flashcards do app aparece uma alcinha de arrasto (o ícone de "pegar") no canto esquerdo do card. Você segura essa alcinha com o mouse (ou com o dedo, no celular) e arrasta o card para cima ou para baixo. Ao soltar, a nova ordem já fica gravada e vale em todo o app: na listagem, na tela do assunto, na revisão e nas exportações.

Telas com arrasto:
- Tela do assunto/subtópico (lista "Flashcards deste assunto")
- Tela Flashcards, dentro de cada grupo de matéria › assunto

## Regras

- O arrasto funciona dentro do mesmo assunto. Para levar um card para outro assunto ou matéria continua valendo o comando "Mover" já existente.
- Na tela Flashcards, o arrasto só é liberado quando a lista está mostrando um assunto por vez (não misturada por busca livre entre vários assuntos); caso contrário a alcinha fica desativada com um aviso curto, porque reordenar uma lista embaralhada não teria significado.
- A numeração (#1, #2, ...) é reescrita automaticamente depois de cada arrasto, sempre em sequência, e o campo de ordem do card continua editável na mão como hoje.
- Enquanto o card não tem número de ordem, ele recebe um ao entrar no arrasto pela primeira vez.
- A ordem é do seu conteúdo: nada muda na lógica de repetição espaçada nem nas datas de revisão.

## Detalhes técnicos

- Adicionar `@dnd-kit/core` e `@dnd-kit/sortable` (suporte a mouse, teclado e toque; sem dependência nativa).
- Novo componente `src/components/SortableList.tsx` encapsulando `DndContext` + `SortableContext` (estratégia vertical, `PointerSensor` com `activationConstraint: { distance: 6 }` para não conflitar com cliques e com o scroll do celular) e uma alcinha `GripVertical` como único `listener` de arrasto.
- Nova função utilitária em `src/lib/order-index.ts`: `renumber(ids: string[]): { id: string; order_index: number }[]` gerando 1..n.
- Persistência: mutation que faz `upsert` em `flashcards` com `{ id, order_index }` em lote (`onConflict: "id"`), com atualização otimista da lista e `invalidateQueries` no final; em caso de erro, reverte e mostra `sonner`.
- `src/routes/_authenticated/topics.$topicId.tsx`: envolver a lista `list.map(...)` no `SortableList`, desativando o arrasto quando há texto na busca.
- `src/routes/_authenticated/flashcards.tsx`: aplicar o `SortableList` por grupo de tópico dentro de `grouped`; a ordenação hierárquica existente já usa `order_index` como último critério dentro do tópico, então a nova ordem é respeitada sem mudar `sortedFiltered`. Arrasto desativado se o grupo estiver paginado ao meio (card do grupo cortado entre páginas).
- Nenhuma mudança de banco: a coluna `order_index` já existe em `flashcards`.
