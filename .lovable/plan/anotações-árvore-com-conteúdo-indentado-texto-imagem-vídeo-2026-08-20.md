# Anotações: árvore com conteúdo indentado (texto, imagem, vídeo)

Transformar a tela de Anotações numa árvore onde cada categoria/subcategoria abre, indentado, todos os seus itens: anotações de texto, imagens (mapas mentais) e vídeos do YouTube. O conteúdo abre à direita no desktop e em modal sobreposto no mobile.

## Árvore lateral

- Categorias e subcategorias continuam expansíveis.
- Ao expandir, aparecem indentados abaixo os itens da categoria, agrupados por tipo e com ícone próprio:
  - texto (anotações que já existem)
  - imagem (mapas mentais)
  - vídeo (links do YouTube)
- Cada anotação de texto também pode expandir para mostrar seus próprios anexos (imagens/vídeos ligados àquela anotação).
- Itens de mídia já cadastrados nos flashcards da matéria correspondente aparecem numa seção “Dos flashcards”, somente leitura.
- Botão “+ Adicionar” na categoria para criar anotação, enviar imagem ou colar link de vídeo.

## Painel de conteúdo

- Desktop: o painel da direita mostra o item selecionado — editor de texto para anotações, visualizador com zoom/arraste para imagens, player para vídeos. Ele substitui o conteúdo anterior (sem terceira coluna).
- Mobile: o mesmo painel abre em modal sobreposto à tela, em tela cheia, com botão de fechar.

## Player de vídeo

- Player embutido no app (YouTube incorporado), sem sair da tela.
- Autoplay desativado: o usuário dá o play.
- Controle de velocidade: 1x, 1,25x, 2x, 3x, 4x.
- Observação: o YouTube só entrega nativamente até 2x. Para 3x e 4x aplico aceleração adicional; se o navegador/YouTube limitar, o player mostra a velocidade real aplicada em vez de falhar em silêncio.
- Sem download, sem cópia de link visível, mantendo a proteção de conteúdo do app.

## Detalhes técnicos

- Nova tabela `note_media` (user_id, category_id, note_id opcional, kind `image` | `video`, title, storage_path ou url, order_index) com RLS por usuário e GRANTs para `authenticated`/`service_role`.
- Imagens no bucket privado existente de mapas mentais, com URL assinada na abertura.
- Vídeos: guardo o ID extraído do link do YouTube e monto o embed com `autoplay=0`, `rel=0`, `modestbranding=1`.
- Reuso de `MindMapViewerDialog` (zoom/arraste) como visualizador de imagem dentro do painel.
- Um único componente de conteúdo, renderizado no painel direito em `md:` e dentro de `Dialog` abaixo disso, usando `useIsMobile`.
- Player novo em `src/components/YouTubePlayer.tsx` usando a IFrame API para `setPlaybackRate`.
