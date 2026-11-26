# Proteger matérias compradas contra exclusão

Hoje qualquer aluno pode apagar qualquer matéria que esteja na conta dele — inclusive a cópia de uma matéria comprada na Loja. Como a exclusão apaga primeiro os flashcards e assuntos, o aluno pode destruir um conteúdo pago mesmo sem querer.

## Regra nova

- O aluno só pode excluir matérias **criadas por ele**.
- Matérias **compradas** (cópias do conteúdo oficial) não podem ser excluídas pelo aluno: o botão de excluir desaparece e, em seu lugar, aparece um aviso curto de que a matéria faz parte de um pacote adquirido.
- Você (AppManager) continua podendo excluir qualquer matéria.
- Matérias compradas continuam sendo removidas automaticamente em caso de reembolso ou de exclusão da conta — isso não muda.

## Onde aparece

- Tela inicial (lista de matérias): o ícone de excluir não aparece nas matérias compradas.
- Tela da matéria: os botões "Excluir matéria" e "Converter em assunto" ficam indisponíveis nas matérias compradas (converter também apaga a matéria no fim).
- Texto do aviso traduzido nos 7 idiomas.

## Detalhes técnicos

- Uma matéria comprada é identificada por `subjects.source_id IS NOT NULL` (cópia vinculada ao conteúdo oficial).
- Proteção no banco (migração): substituir a política única `own subjects` (FOR ALL) por políticas separadas para leitura/inserção/atualização mantendo `auth.uid() = user_id`, e uma política de DELETE que exige `user_id = auth.uid() AND (source_id IS NULL OR auth.jwt()->>'email' = 'guit1966@gmail.com')`.
- Proteção no app:
  - `src/routes/_authenticated/home.tsx`: incluir `source_id` na consulta de matérias e esconder o botão de excluir quando houver `source_id`; a mutação valida antes de apagar flashcards/assuntos.
  - `src/routes/_authenticated/subjects.$subjectId.tsx`: mesma verificação para `del` e `convertToTopic`, com o mesmo bloqueio visual usado hoje para conteúdo oficial (`isOfficial`).
- Novas chaves de tradução (matéria comprada não pode ser excluída) em `src/lib/i18n-extra.ts`.
- Verificação: typecheck, build e teste no preview com a matéria comprada "Inglês - Gramática" (deve ficar sem botão de excluir) e com uma matéria criada manualmente (deve continuar excluível).
