# Renomear botão "Foto & Câmera" para "Foto & Imagem" (Bulk v2)

Na tela de criação de flashcards (`/bulk-v2`), o cartão de captura visual passa a se chamar **"Foto & Imagem"**.

## O que muda
- Português (BR/PT): "Foto & Câmera" → "Foto & Imagem".
- Demais idiomas nativos com o mesmo sentido: Photos & Images, Fotos e imágenes, Photos et images, Foto e immagini, Fotos und Bilder.
- Idiomas extras (overlays dentro do mesmo catálogo): atualizar o rótulo equivalente "fotos e imagens" em cada língua, sem rodar o tradutor automático.
- Subtítulo do cartão e funcionamento (upload, colar, câmera) permanecem iguais.

## Detalhes técnicos
- Alterar apenas a chave `groupVisual` em `src/lib/i18n-bulk-v2.ts` (todas as línguas).
- Conferir se a landing usa texto próprio; não alterar a landing salvo pedido.
- Verificar build e a tela no navegador.
