# Liberar uso em modo paisagem (landscape) no Android

## Causa confirmada
O app instalado trava em retrato porque o manifesto (`public/manifest.webmanifest`) declara `"orientation": "portrait"`. Quando o app é instalado como PWA, o Android obedece a essa trava e ignora o giro do telefone. No navegador comum o giro funciona; só a versão instalada fica presa.

## O que fazer

1. **Destravar a orientação**
   - Trocar `"orientation": "portrait"` por `"orientation": "any"` no manifesto.
   - Efeito: o app instalado passa a girar junto com o telefone. Em aparelhos já instalados pode ser necessário reinstalar/atualizar o atalho para o novo manifesto valer.

2. **Ajustar telas que hoje assumem altura de retrato**
   - Tela de estudo / flashcard: a altura fixa do card e o bloco "Minha resposta" precisam virar altura flexível baseada na altura disponível, para não cortar conteúdo em telas baixas (celular deitado tem ~380px de altura útil).
   - Modal de mapa mental: altura de `80vh` com mínimo de `50vh` fica apertada deitado; usar limites que respeitem telas baixas e manter o enquadramento automático ao girar (o observador de redimensionamento já existe e reenquadra).
   - Cabeçalho/menu: conferir que o menu sanduíche e a barra superior não empurrem o conteúdo em telas baixas.

3. **Verificação**
   - Testar as telas principais (início, lista de flashcards, estudo, anotações, mapa mental) em uma janela de 776x407 (paisagem) e confirmar que nada fica cortado ou exige rolagem estranha.

## Detalhes técnicos
- Arquivo: `public/manifest.webmanifest` → `orientation: "any"`.
- `src/components/FlipCard.tsx`: substituir alturas fixas por `min-h`/`max-h` com `dvh` para acompanhar a altura real da janela.
- `src/components/MindMapViewerDialog.tsx`: viewport com `height: min(80dvh, ...)` e mínimo menor; `fitToView` já roda no `ResizeObserver` ao girar.
- Nenhuma mudança de banco de dados ou de lógica de negócio.
