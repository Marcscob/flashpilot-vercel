# Transformar categorias soltas em matéria / assunto (sem perder nada)

## O que está acontecendo hoje

Existem 19 categorias em "Minhas categorias" que nunca casaram por nome com uma matéria/assunto. Elas não estão perdidas — continuam com todo o conteúdo. Exemplos verificados agora:

- "Dos Atos Processuais - Geral 2" — 1 anotação e 79 flashcards com imagem
- "Do Juiz e dos Auxiliares da Justiça" — 100 flashcards, 2 mídias
- "Cooperação Nacional arts 67 a 69" — 59 flashcards
- "Da Aplicação das Normas Processuais" — 50, "Primazia do Mérito" — 52, "Princípio da Boa-fé" — 50, e outras menores

O único comando existente (🔗 Vincular) só aponta para uma matéria/assunto **que já existe**. Como esses nomes não existem no cadastro oficial, não há botão nenhum — daí a sensação de categoria perdida. Há também uma categoria duplicada vazia ("Dos Atos Processuais - Geral 2", sem conteúdo) que pode ser removida.

## O que vou fazer

1. **Criar direto pelo diálogo de vínculo.** No diálogo 🔗 passa a existir, no topo, um bloco "Criar novo":
   - **Criar matéria "<nome>"** — cria a matéria oficial e a categoria vira o espelho dela.
   - **Criar assunto/subtópico "<nome>" dentro de…** — escolhe a matéria ou o assunto pai e cria o item oficial; a categoria vira o espelho.
   - O nome vem pré-preenchido com o nome da categoria e pode ser editado antes de criar.
2. **Conteúdo preservado.** A categoria mantém o mesmo identificador: anotações, imagens, vídeos e os flashcards que apontam para ela continuam exatamente onde estão. Ela só passa a exibir o nome oficial, sai de "Minhas categorias" e aparece na árvore espelho, na posição certa.
3. **Excluir categoria vazia.** Para categorias sem nenhum conteúdo (como a duplicada), o botão de excluir continua disponível normalmente.

Observação: isso cria a matéria/assunto **vazio de flashcards próprios** — os 79 cards da categoria estão ligados a ela como categoria de imagem, não como assunto de estudo. Se você também quiser mover esses cards para o assunto recém-criado, isso é um segundo passo (mover cards) que posso incluir se quiser — diga e eu adiciono ao plano.

## Detalhes técnicos

- `LinkCategoryDialog` (`src/routes/_authenticated/notes.tsx`) ganha o bloco "Criar novo": input de nome (default `cat.name`), seletor opcional de pai reaproveitando as opções já carregadas de `subjects`/`topics`, e botão confirmar.
- Mutation:
  1. `insert` em `subjects` (sem pai) ou em `topics` (`subject_id` + `parent_id` conforme o pai escolhido).
  2. O trigger `sync_note_category_*` cria uma categoria espelho nova e vazia — localizá-la por `subject_id`/`topic_id` e apagá-la.
  3. `update` na categoria original: `subject_id`/`topic_id` = novo id, `name` = nome oficial, `parent_id` = espelho do pai (mesma lógica do vínculo atual).
  4. Invalidar `note_categories`, `link-category-options`, `subjects`, `topics`.
- Sem migração de banco; nada muda em `notes.category_id`, `note_media.category_id` ou `flashcards.image_category_id`.
