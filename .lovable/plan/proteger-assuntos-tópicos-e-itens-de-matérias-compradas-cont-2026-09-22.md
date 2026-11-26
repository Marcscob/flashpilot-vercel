# Proteger assuntos, tópicos e itens de matérias compradas contra exclusão

## Objetivo

Estender a regra já aplicada às matérias compradas: o aluno só pode excluir conteúdo que ele mesmo criou. Tudo o que veio de uma matéria adquirida na loja (identificado pelo campo `source_id`) fica protegido contra exclusão para usuários comuns; apenas o AppManager (guit1966@gmail.com) pode excluir.

## O que muda

### 1. Página da matéria (`src/routes/_authenticated/subjects.$subjectId.tsx`)
- Assuntos (topics) da matéria comprada: esconder o botão de excluir quando a matéria tem `source_id` e o usuário não é AppManager — hoje os botões de assunto aparecem sempre que `!isOfficial`, sem checar `isPurchased`.
- Guarda também dentro da mutação `removeTopic` (recusar mesmo se o botão for burlado), exibindo o texto amigável `purchasedTexts.cannotDelete`.

### 2. Página do assunto (`src/routes/_authenticated/topics.$topicId.tsx`)
- Detectar conteúdo comprado: tópico com `source_id` próprio **ou** pertencente a uma matéria com `source_id` (checar o `subject_id` pai). Computar `isPurchased`.
- Esconder/bloquear para não-AppManager quando `isPurchased`:
  - Excluir o próprio assunto (`removeTopic`)
  - Excluir subtópicos (`removeSubtopic`)
  - Excluir flashcards individuais (`remove`) — cards com `source_id` ou dentro de assunto comprado
- Manter ações permitidas: estudar, revisar, favoritar, marcar revisado (progresso do aluno não é afetado).

### 3. Demais telas com exclusão de itens
- `flashcards.tsx` e `notes.tsx`: bloquear exclusão de flashcards e anotações com `source_id` para não-AppManager (mesmo padrão de selo/cadeado usado na matéria).
- Categorias de anotações espelhadas (`note_categories` com `source_id`): bloquear exclusão.

### 4. Proteção no banco (não só na tela)
- Adicionar trigger `BEFORE DELETE` em `topics`, `flashcards`, `notes`, `note_media` e `note_categories` que impede a exclusão de linhas com `source_id` quando o autor da exclusão não é o AppManager, garantindo a regra mesmo fora da interface.
- Exceção necessária: o fluxo de reembolso/remoção da cópia (já roda com privilégio de servidor) deve continuar funcionando — o trigger permite quando a operação vem do service role.

### 5. Textos
- Reutilizar `purchasedTexts.cannotDelete` (já existe nos 7 idiomas); se necessário, acrescentar uma variante "item de matéria comprada" nos 7 idiomas em `src/lib/i18n-purchased.ts`.

## Verificação

- `npx tsgo --noEmit` limpo.
- Preview logado como usuário comum com matéria comprada: botões de excluir ausentes/cadeado em matéria, assuntos, subtópicos, flashcards e anotações comprados; matérias/assuntos criados pelo próprio usuário continuam excluíveis.
- Preview como AppManager: exclusão continua disponível.
- Teste SQL: tentativa de `DELETE` direto em linha com `source_id` como usuário comum falha; como service role, funciona.
