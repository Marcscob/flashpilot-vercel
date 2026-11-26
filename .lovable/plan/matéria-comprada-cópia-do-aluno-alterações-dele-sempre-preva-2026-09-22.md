# Matéria comprada: cópia do aluno, alterações dele sempre prevalecem

## Como vai funcionar

1. **Na compra**, o aluno recebe a matéria inteira exatamente como você a fez: matérias, assuntos, flashcards, anotações, mapas mentais e imagens passam a existir na conta dele, editáveis.
2. **Cada item lembra sua origem.** Enquanto o aluno não mexe num item, ele continua "espelhando" o seu: se você corrige uma anotação, um mapa mental ou um card, a correção chega ao aluno.
3. **No instante em que o aluno altera um item**, aquele item é marcado como dele. Suas atualizações futuras nunca mais tocam nesse item — nem por cima, nem em parte.
4. **Itens novos que você criar** (cards, anotações, mapas) continuam chegando ao aluno, porque não conflitam com nada que ele fez.
5. **Itens que você excluir** só são removidos do aluno se ele não os tiver alterado.
6. **Tudo que o aluno criou por conta própria** dentro da matéria nunca é mexido.

## Renovação anual (1 ano depois)

Na tela de renovação, antes de pagar, o aluno escolhe entre duas opções escritas com clareza:

- **Manter minhas alterações** (opção pré-selecionada): ele continua com as versões dele; recebe apenas o conteúdo novo que não conflita.
- **Receber a matéria atualizada do autor**: suas versões atuais substituem as alterações dele naquela matéria, com aviso explícito de que as alterações dele serão perdidas e sem volta.

O aviso aparece também em "Minha conta", junto da data de expiração, e a escolha é registrada na compra da renovação.

## Pontos de atenção

- **Limite do plano gratuito**: uma matéria comprada pode ter milhares de cards. Os cards vindos de matéria comprada não contam no limite de 100 do plano gratuito.
- **Volume**: a cópia de "Direito Processual Civil" (6.195 cards) é feita em lote no servidor, com aviso de progresso e sem duplicar se o aluno já tiver recebido.
- **Expiração**: ao vencer 1 ano sem renovar, a matéria fica bloqueada (não apagada); renovando, ela volta com a escolha acima.

## Detalhes técnicos

**Banco (migrações aditivas)**
- Colunas de rastreio em `subjects`, `topics`, `flashcards`, `note_categories`, `notes`, `note_media`: `source_id uuid`, `source_synced_at timestamptz`, `user_modified boolean default false`.
- `subject_grants`: `user_id`, `source_subject_id`, `copy_subject_id`, `last_synced_at`, `expires_at`, `renew_mode text ('keep'|'overwrite')`.
- Trigger `BEFORE UPDATE` em `flashcards`, `notes`, `note_media`, `note_categories`: quando o dono edita campos de conteúdo e `source_id IS NOT NULL`, marca `user_modified = true`.
- Índices em `(user_id, source_id)` para o sync.
- `GRANT`s e RLS own-only nas colunas/tabela novas; as políticas de leitura ao vivo criadas antes ficam mantidas para compatibilidade.

**Servidor (`src/lib/official-content.functions.ts`)**
- `cloneSubjectForUser(sourceSubjectId)` — clone em lote via admin client, em ordem (subject → topics → note_categories → notes → note_media → flashcards), remapeando FKs por mapa `source_id → new_id`; idempotente por `subject_grants`.
- `syncSubjectFromSource(grantId, mode)` — `keep`: upsert só onde `user_modified = false`, insere itens novos, remove itens apagados na origem e não modificados. `overwrite`: reescreve todos os itens com `source_id`, mantendo o progresso de estudo.
- Chamado pelo webhook de pagamento após criar `user_purchases`, e sob demanda ao abrir a matéria (fallback).

**Frontend**
- Renovação: diálogo com as duas opções e texto de aviso; grava `renew_mode` antes de abrir o checkout Paddle.
- Selo "Do autor" / "Alterado por você" em cards, anotações e mapas mentais da matéria comprada.
- Remover o modo somente-leitura do conteúdo comprado (agora é cópia do aluno) e manter o bloqueio de cópia de texto já existente.
