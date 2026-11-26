# Número dos artigos ao lado do título (ex.: "Ação (arts. 15 a 29)")

## Objetivo
Permitir que cada assunto, subtópico e subitem tenha um campo opcional de **artigos** (texto livre, ex.: "arts. 15 a 29" ou "art. 5º, XLIV"). Esse texto aparece entre parênteses ao lado do título em todo o app, sem poluir o nome em si.

## O que muda

### 1. Banco de dados
- Nova coluna `article_range text` (opcional) na tabela `topics` via migração. (Já aplicada.)
- Tipos de `topics` em `src/integrations/supabase/types.ts` já regenerados com o novo campo.

### 2. Criar e editar
- No diálogo de **novo assunto** (`subjects.$subjectId.tsx`) e de **novo subtópico/subitem** (`topics.$topicId.tsx`): campo extra "Artigos (opcional)" com placeholder "ex.: arts. 15 a 29".
- Substituir o `window.prompt` de renomear tópico por um pequeno diálogo de edição com dois campos: Nome e Artigos — assim dá para incluir/corrigir o intervalo depois. Vale para todos os níveis (assunto, subtópico e subitem).

### 3. Exibição
Helper `topicDisplayName(tp)` em `src/lib/topic-tree.ts` que devolve `Nome (artigos)` quando preenchido. Aplicado em:
- Card do assunto/subtópico/subitem (a linha do título da imagem enviada);
- Cabeçalho e breadcrumb da página do tópico (`topics.$topicId.tsx`);
- Topo do card na tela de estudo (`study.tsx`);
- Filtros e agrupamentos da lista de flashcards (`flashcards.tsx`) e do diálogo de mover;
- Seletores da batelada (`bulk.tsx`) e anotações (`notebooks.tsx`);
- Exportação de relatórios (breadcrumb).

### 4. Regras
- Campo sempre opcional; vazio = nada muda.
- Sem validação de formato (texto livre), máx. ~80 caracteres.
- Nada muda na ordem, contagem ou arrastar-e-soltar.

## Detalhes técnicos
- i18n: novas chaves `articleRange` / `articleRangePh` (pt/en/es).
- O nome salvo continua limpo; o sufixo "(arts...)" é montado só na exibição.
