# Mapa mental gerado a partir de anotações ou flashcards

O usuário escolhe uma fonte — uma anotação ou vários flashcards marcados — e o app gera um mapa mental como imagem pronta, salvo nas Anotações e listado numa tela própria de Mapas Mentais.

## Como o usuário usa

### A partir de uma anotação
- Na tela de Anotações, ao abrir uma anotação, aparece o botão "Gerar mapa mental".
- Abre um diálogo: título sugerido, nível de detalhe (Resumido / Padrão / Detalhado) e o aviso de que a geração usa créditos de IA.
- Ao confirmar: barra de progresso, prévia do mapa e botões "Salvar" ou "Descartar".

### A partir de flashcards
- Na tela de Flashcards, com cards marcados (a seleção múltipla já existe), a barra de ações ganha "Gerar mapa mental".
- Mesmo diálogo, com o número de cards escolhidos visível. Limite de 60 cards por mapa para o texto não ficar ilegível.
- O mapa pode ser guardado numa categoria de anotações escolhida no diálogo.

### Onde o mapa fica
- Na árvore de Anotações, junto da categoria (ou da anotação de origem), como os itens de imagem que já existem — abre no visualizador com zoom e arraste.
- Numa nova tela "Mapas mentais" no menu, em grade, com busca por título, origem e data, e ações de abrir, baixar a imagem, renomear e excluir.
- Conteúdo oficial continua somente leitura: mapas criados são sempre itens pessoais do usuário.

## Idioma

O mapa sai no idioma do conteúdo de origem: cards de matéria com idioma estrangeiro geram mapa nesse idioma; anotações e cards sem idioma geram em português. Quando os cards marcados misturam idiomas, vale o idioma da maioria.

## Detalhes técnicos

**Geração em duas etapas**
1. `src/lib/mindmap-generate.server.ts` — chama o gateway com `openai/gpt-6-astra` (Responses API, streaming consumido no servidor, `reasoning.effort: "low"`, saída estruturada estrita) e devolve a árvore: `{ title, lang, nodes: [{ label, children: [...] }] }`, profundidade máxima 3, rótulos curtos, `stripMarkup` aplicado a todo rótulo.
2. Renderização determinística no cliente (`src/lib/mindmap-render.ts`): a árvore é desenhada num layout radial/horizontal em SVG e convertida em PNG via `canvas`, com as cores do tema e marca d'água FlashPilot — assim o texto sai sempre legível, ao contrário de imagem gerada por modelo de imagem.

**Server function** `src/lib/mindmap-generate.functions.ts` — `generateMindMap` com `requireSupabaseAuth`, entrada validada por zod (`source: 'note' | 'cards'`, `noteId` ou `cardIds` máx. 60, `detail`, `lang`). Confere posse da anotação/cards pelo usuário via RLS, monta a fonte de texto (HTML da anotação limpo, ou pergunta+resposta dos cards), aplica `assertChatAllowed` antes da chamada e `recordAiUsage(kind: 'chat')` depois. Erros do gateway (429/402/403) já têm mensagens prontas no padrão do projeto.

**Armazenamento** — sem tabela nova. O PNG vai para o bucket privado existente `flashcard-mindmaps` (`uploadMindMapImage`), e o registro entra em `note_media` com `kind: 'mindmap'`, `title`, `storage_path`, `category_id` e `note_id` quando a fonte é anotação. A árvore JSON é guardada em `url` como texto, para permitir regerar a imagem depois sem nova chamada de IA. A árvore de Anotações passa a exibir `kind: 'mindmap'` no mesmo grupo de imagens.

**Arquivos**
- Novos: `src/lib/mindmap-generate.server.ts`, `src/lib/mindmap-generate.functions.ts`, `src/lib/mindmap-render.ts`, `src/components/GenerateMindMapDialog.tsx`, `src/routes/_authenticated/mindmaps.tsx`.
- Alterados: `src/routes/_authenticated/notes.tsx` (botão na anotação; `mindmap` na árvore), `src/routes/_authenticated/flashcards.tsx` (ação na barra de seleção), `src/components/AppShell.tsx` (item de menu), `src/lib/i18n.tsx` (textos).

**Fora do escopo**: edição dos ramos depois de gerado (o mapa é imagem) e geração a partir de vídeos ou PDFs.
