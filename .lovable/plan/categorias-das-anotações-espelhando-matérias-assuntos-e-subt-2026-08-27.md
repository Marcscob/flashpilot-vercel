# Categorias das Anotações espelhando Matérias, Assuntos e Subtópicos

A árvore da tela de Anotações passa a ser a mesma hierarquia de Matérias → Assuntos → Subtópicos, criada e atualizada automaticamente. Nenhum vínculo atual de anotação, imagem, vídeo ou flashcard é perdido.

## Como fica

- Toda matéria vira uma categoria raiz; cada assunto e subtópico vira subcategoria, na mesma indentação da tela de Flashcards.
- Criar, renomear, mover ou excluir matéria/assunto/subtópico reflete na hora na tela de Anotações (e vice-versa quando a categoria for espelhada).
- Categorias espelhadas não podem ser renomeadas/excluídas direto nas Anotações — isso é feito na matéria/assunto correspondente (evita as duas árvores divergirem).
- Continua possível criar categorias próprias, independentes, que aparecem numa seção separada "Minhas categorias".

## Adequação das categorias atuais (sem perder vínculos)

Hoje existem 45 categorias, 54 anotações, 9 mídias e 1.531 flashcards com imagem apontando para categorias.

A adequação não apaga nem recria categorias — cada categoria mantém o mesmo identificador, então todos os vínculos (anotação → categoria, imagem/vídeo → categoria, flashcard → categoria de imagem) continuam intactos.

1. Categorias cujo nome coincide com uma matéria, assunto ou subtópico (26 hoje) são "casadas" com ele: passam a ser a categoria espelho daquele item e recebem a posição correta na árvore.
2. Matérias/assuntos/subtópicos sem categoria correspondente ganham uma categoria espelho nova e vazia.
3. As 19 categorias restantes (ex.: "Da Audência de Conciliação", "Informativos STF", "Súmulas Vinculantes") ficam em "Minhas categorias", intactas e com seu conteúdo. Nenhuma é casada automaticamente com nome diferente (para não criar vínculo errado).
4. Para cada uma delas, a tela oferece a ação "Vincular a assunto…": uma busca com sugestões ordenadas por semelhança de nome. Ao escolher, a categoria **mantém o mesmo identificador e todo o conteúdo** (anotações, imagens, vídeos e os flashcards que apontam para ela), passa a exibir o nome oficial do assunto/subtópico e ocupa a posição correta na árvore — ou seja, o vínculo é aproveitado apenas "renomeando" a categoria. Também é possível desvincular depois, e a categoria volta para "Minhas categorias".

## Detalhes técnicos

- Migração adiciona `subject_id` e `topic_id` (nulos, únicos) em `note_categories`, mais `is_mirror` gerado a partir deles.
- Backfill em uma migração: casamento por `lower(unaccent(name))` + `user_id` contra `subjects`/`topics`; depois `INSERT ... SELECT` das faltantes; por fim `UPDATE` de `parent_id` das categorias espelho para o espelho do pai (subtópico → assunto → matéria).
- Triggers `AFTER INSERT/UPDATE/DELETE` em `subjects` e `topics` mantêm o espelho sincronizado (nome, `parent_id`, exclusão). Exclusão de matéria/assunto só remove a categoria espelho se ela não tiver anotações/mídias/flashcards vinculados; caso contrário ela é desvinculada e cai em "Minhas categorias".
- `src/routes/_authenticated/notes.tsx`: a query de categorias passa a trazer `subject_id`/`topic_id`; a árvore é montada em dois blocos (espelho no topo, "Minhas categorias" abaixo); ações de renomear/excluir ficam ocultas para categorias espelho; novo diálogo "Vincular a assunto…" com sugestões via `similarity()` (pg_trgm, já habilitado) e opção de desvincular.
- `MindMapPicker` e `NoteLinkPicker` passam a listar as categorias com o caminho completo (Matéria › Assunto › Subtópico).
- Nenhuma alteração em `notes.category_id`, `note_media.category_id` ou `flashcards.image_category_id`.
