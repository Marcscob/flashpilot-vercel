# Todas as matérias na Loja + conteúdo sempre atualizado

## O que encontrei

1. Suas 12 matérias existem na conta de administrador, mas só uma foi marcada como "Disponibilizar matéria" no Painel. A Loja mostra apenas as marcadas — por isso você vê somente "Direito Processual Civil".
2. Hoje a compra de uma matéria registra o acesso, mas ainda não existe caminho de leitura: as regras do banco permitem que cada pessoa veja apenas o próprio conteúdo. Quem comprasse a matéria não conseguiria abrir nada. Ou seja, a parte de "entregar a matéria ao aluno" precisa ser construída — e é exatamente aí que entra a atualização automática.

Suas matérias e cards: Direito Processual Civil 6195, Inglês - Gramática 376, Direito Constitucional 228, Jurisprudência 132, Espanhol 88, Direito Penal 53, Biologia PT BR / Biology EN / Biología ES 41 cada, LINDB 15, Direito Civil 6, Direito Processual Penal 0.

## Parte 1 — Publicar todas as matérias

- Botão "Disponibilizar todas" no Painel, com campo de preço padrão, ligando de uma vez todas as matérias que têm cards. O preço de cada matéria continua editável individualmente.
- Indicador claro na lista do Painel de quais estão na Loja.
- Matérias sem nenhum card (hoje "Direito Processual Penal") ficam fora automaticamente.
- Publicar as 11 matérias com conteúdo no preço que você escolher.

## Parte 2 — Atualização automática (sem cópias)

O aluno vai ler o seu conteúdo ao vivo, direto da sua matéria: nada é copiado para a conta dele. Assim, quando você edita uma anotação, troca um mapa mental, corrige ou cria flashcards, o aluno vê a mudança na hora seguinte em que abrir a matéria — sem nenhuma etapa de "republicar".

O que isso inclui:
- Matéria, assuntos e subtópicos, flashcards (com imagens), anotações ligadas e mapas mentais.
- Sempre somente leitura para o aluno: não editar, não copiar, não clonar.
- O progresso de estudo do aluno (acertos, intervalos, datas de revisão) fica guardado separado, por pessoa, para que o estudo dele não altere o seu conteúdo nem se misture com o de outros alunos.
- O acesso vale 365 dias a partir da compra; quando expira, a matéria deixa de abrir e volta a aparecer na Loja.
- A Loja continua mostrando "Conteúdo atualizado em …", que passa a refletir também anotações e mapas mentais, não só cards.

## Ponto que precisa da sua decisão

A Loja mostra um rótulo de preço do app, mas a cobrança usa o preço cadastrado no Paddle. Hoje o único preço ativo de matéria é "Single Subject — Annual Access", US$ 7,69. Se a Loja exibir US$ 17,90, o cliente paga US$ 7,69.

- A) Publicar todas a US$ 7,69 (igual ao Paddle hoje).
- B) Você diz o valor desejado e eu crio esse preço no Paddle antes de publicar, para rótulo e cobrança coincidirem.

## Detalhes técnicos

- Migração aditiva: políticas de leitura em `subjects`, `topics`, `flashcards`, `notes`, `note_categories`, `note_media` permitindo SELECT quando `public.has_subject_access(auth.uid(), <subject>)` for verdadeiro, mantendo as políticas próprias intactas (nunca INSERT/UPDATE/DELETE para conteúdo de terceiros). `has_subject_access` passa a `SECURITY DEFINER` com `search_path` fixo para evitar recursão de política; notas/mapas chegam pela `note_categories` espelhada (`subject_id`/`topic_id`).
- Nova tabela `official_card_progress` (user_id, flashcard_id, ease_factor, interval_days, repetitions, due_date, last_reviewed_at) com GRANTs e RLS por `auth.uid()`; a tela de estudo usa essa tabela quando o card não é do usuário e mantém o comportamento atual para cards próprios.
- `store.functions.ts`: `contentUpdatedAt` passa a considerar `max(created_at/updated_at)` de flashcards, notes e note_media da matéria.
- `admin.functions.ts`: `adminPublishAllSubjectPacks` faz upsert em `store_products` (`pack_<subjectId>`, `kind='pack'`, `validity_days=365`) para todas as matérias com cards; `admin.tsx` ganha preço padrão, botão em lote e status por matéria.
- Nenhuma duplicação de conteúdo: leitura sempre das linhas originais do administrador.
