# Quarta camada: Matéria › Assunto › Subtópico › Subitem

Sim, é possível — e sem migração de banco. A tabela de tópicos já guarda um "pai" para cada item, então a profundidade é livre; o que está travado hoje é a interface, que só desenha e só deixa escolher dois níveis abaixo da matéria.

## O que muda para você

- **Quatro camadas navegáveis**: Matéria › Assunto › Subtópico › Subitem, com o mesmo comportamento de abrir, renomear e excluir em qualquer nível.
- **Criar**: dentro de um subtópico passa a existir "novo subitem", igual ao que hoje existe para criar subtópico dentro de assunto.
- **Mover livremente**: o diálogo de mover já aceita qualquer destino; ele passa a listar os itens com o caminho completo indentado (Matéria › Assunto › Subtópico) e a impedir mover um item para dentro dele mesmo ou de um descendente. Assim um assunto pode virar subitem, um subitem virar subtópico ou assunto raiz, etc. — os cards e a subárvore vão junto.
- **Mover cards**: a seleção múltipla de cards passa a poder mandar para qualquer nível, inclusive subitens.
- **Criação em lote**: além de Matéria/Assunto/Subtópico, um quarto seletor opcional de Subitem, com "criar novo" em cada nível como já funciona hoje.
- **Filtros e listagem de flashcards**: o filtro por assunto/subtópico vira um seletor único em árvore indentada com todos os níveis; opção de incluir os cards dos níveis abaixo.
- **Estudo/revisão**: a etiqueta no topo do card mostra o caminho completo (ex.: `Assunto › Subtópico › Subitem`) e a ordem alfabética passa a ordenar pelo caminho inteiro.
- **Anotações**: a árvore espelhada já é recursiva, então os subitens aparecem automaticamente na indentação certa.
- **Exportações (PDF/CSV/Excel) e relatórios**: as colunas de classificação passam a trazer o caminho completo em vez de apenas assunto/subtópico.

Limite prático: deixo a interface preparada para profundidade livre, mas com um teto de segurança (6 níveis) para evitar árvores infinitas por engano.

## Detalhes técnicos

- Sem migração: `topics.parent_id` já é auto-referente. Nada muda em `flashcards.topic_id`.
- Novo utilitário compartilhado `src/lib/topic-tree.ts`: constrói a árvore a partir de `topics`, expõe `flattenTopicTree` (com `depth` e `path`), `descendantsOf`, `pathOf` e `isDescendant` — reaproveitando o padrão já existente em `src/lib/note-category-tree.ts`.
- `src/components/MoveTopicDialog.tsx`: trocar a lista plana de pais por opções indentadas de todos os níveis (exceto o próprio e descendentes) e manter a atualização de `subject_id` de toda a subárvore.
- `src/routes/_authenticated/topics.$topicId.tsx`: já lista filhos por `parent_id`; generalizar o breadcrumb para subir a cadeia inteira de pais (hoje sobe um nível) e rotular o botão de criar conforme a profundidade.
- `src/routes/_authenticated/subjects.$subjectId.tsx`: contagens passam a considerar descendentes recursivos, não só filhos diretos.
- `src/routes/_authenticated/bulk.tsx`: cadeia de seletores dependente por nível (assunto → subtópico → subitem) com find-or-create em cada um, substituindo a lógica fixa de dois níveis.
- `src/routes/_authenticated/flashcards.tsx`: filtro em árvore indentada, opção "incluir níveis abaixo" (query com `in(topic_id, descendentes)`), `breadcrumbFor` usando `pathOf`, e mover em lote para qualquer nó.
- `src/routes/_authenticated/study.tsx`: `STUDY_CARD_SELECT` deixa de depender de um único `parent` embutido; o caminho é montado no cliente com o mapa de tópicos já carregado, e a ordenação alfabética usa o caminho completo.
- `src/routes/_authenticated/notes.tsx` e `notebooks.tsx`: seletores de escopo passam a usar `flattenTopicTree` (indentado, todos os níveis).
- Guarda contra ciclos em toda movimentação e teto de 6 níveis nos renderizadores.
