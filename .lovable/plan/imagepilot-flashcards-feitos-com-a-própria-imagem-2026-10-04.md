# ImagePilot — flashcards feitos com a própria imagem

## O que o usuário vai ver
1. Na tela "Criação de flashcards", ao enviar uma imagem, ele escolhe entre duas opções:
   - **Texto da imagem**: funciona como hoje e gera cards de pergunta e resposta em texto.
   - **ImagePilot**: a própria imagem vira o card.
2. No modo ImagePilot, o PilotAI analisa a figura (célula, órgãos, mapa, peça de motor...):
   - Se a imagem já tem números ou setas, ele lê esses números e escreve a legenda correspondente.
   - Se não tem, ele encontra as estruturas principais e coloca um marcador numerado sobre cada uma.
3. **Tela de conferência (obrigatória antes de salvar)**
   - A imagem aparece com os marcadores numerados e, ao lado, a lista "1 – Núcleo, 2 – Mitocôndria...".
   - O usuário pode corrigir nomes, apagar marcadores, arrastar um marcador para outro lugar ou adicionar um novo com um toque.
   - Aviso fixo: "O PilotAI pode errar. Confira os nomes e as posições antes de salvar."
4. **Formato do estudo** (escolhido na conferência):
   - **Card único**: frente com a imagem inteira numerada; verso com a legenda completa.
   - **Um card por estrutura**: frente com a imagem e um marcador destacado ("Qual é o nº 3?"); verso com o nome. Assim a revisão espaçada trata separadamente cada estrutura.
5. **No estudo**
   - Frente: a imagem aparece inteira, sem cortes e sem deformação, ajustada ao card no celular e no computador. Toque para ampliar com zoom.
   - Verso: miniatura da imagem no topo e a legenda logo abaixo. A leitura em voz alta lê a legenda.
6. Os 7 idiomas recebem todos os textos novos. A legenda é escrita no idioma escolhido pelo usuário.

## Exemplo real (foto dos órgãos do corpo humano)
O usuário envia a foto de um diagrama do corpo humano. O PilotAI identifica os órgãos e posiciona as bolinhas numeradas sobre cada um.

**Frente do card (Face A)** — a foto original, sem cortes, somente com as bolinhas numeradas sobre os órgãos:
```text
┌──────────────────────────────┐
│        [foto do corpo]       │
│           (1) ← estômago     │
│        (2) ← fígado          │
│     (3) ← intestino          │
│           (4) ← coração      │
│                              │
│   Toque para virar o card    │
└──────────────────────────────┘
```

**Verso do card (Face B)** — miniatura da imagem no topo e a legenda com o nome de cada órgão:
```text
┌──────────────────────────────┐
│      [miniatura da foto]     │
│                              │
│  1 – Estômago                │
│  2 – Fígado                  │
│  3 – Intestino               │
│  4 – Coração                 │
└──────────────────────────────┘
```

No formato **um card por estrutura**, a frente mostra a mesma foto com apenas a bolinha do número em foco destacada e a pergunta "Qual é o órgão nº 1?"; o verso mostra "Estômago".

## Exemplo 2 (foto de uma célula)
O usuário envia a foto de uma célula. O PilotAI reconhece cada estrutura e coloca uma bolinha numerada sobre cada componente.

**Frente do card (Face A)** — a foto da célula, somente com as bolinhas numeradas:
```text
┌──────────────────────────────┐
│        [foto da célula]      │
│      (1) ← núcleo            │
│   (2) ← mitocôndria          │
│      (3) ← ribossomo         │
│   (4) ← membrana celular     │
│      (5) ← citoplasma        │
└──────────────────────────────┘
```

**Verso do card (Face B)** — miniatura da imagem e os componentes nomeados:
```text
┌──────────────────────────────┐
│      [miniatura da foto]     │
│                              │
│  1 – Núcleo                  │
│  2 – Mitocôndria             │
│  3 – Ribossomo               │
│  4 – Membrana celular        │
│  5 – Citoplasma              │
└──────────────────────────────┘
```

Se o PilotAI errar um nome ou uma posição, o usuário corrige na tela de conferência antes de salvar — o aviso "O PilotAI pode errar. Confira os nomes e as posições antes de salvar." fica sempre visível nessa etapa.

## Precisão máxima
- Modelo: **Gemini Pro** (`google/gemini-3.1-pro-preview`) com raciocínio no nível mais alto e resposta em formato estruturado: número, nome, posição x/y de 0 a 1000 e grau de certeza.
- Imagem enviada na resolução original, sem compressão forte.
- Primeira etapa: o PilotAI identifica o tipo de diagrama e o tema. Segunda etapa: ele localiza e nomeia as estruturas. Isso reduz nomes inventados.
- Itens com pouca certeza aparecem destacados em amarelo na conferência.
- Limite de até 30 estruturas por imagem, para manter a qualidade.

## Cobrança
- Segue a regra atual: **1 FlashCoin por card salvo**, com a cota do Pro usada primeiro. Nada é cobrado se o usuário descartar o resultado na conferência.
- No formato **card único**, conta 1 card. No formato **um card por estrutura**, conta 1 card por estrutura.

## Detalhes técnicos
- Banco: nova coluna `image_pins jsonb` em `flashcards`, no formato `[{n, label, x, y, confidence}]`, e um valor novo `card_format = 'imagepilot'`. A imagem original fica em `image_url`, guardada no armazenamento do app. No formato "um card por estrutura", cada card usa a mesma imagem e guarda o número em foco (`image_focus int`).
- Servidor: nova função `imagepilot.functions.ts`, que chama o gateway em `/v1/chat/completions` com Gemini Pro, `reasoning_effort: "high"` e saída em JSON validada com zod. A chamada é envolvida por `runWithAiQuota` e pelo fluxo de reserva e registro de flashcards gerados que já existe. Erros 402, 429 e 403 recebem as mensagens atuais do PilotAI.
- Antes de programar: consultar a lista de modelos para confirmar que o Gemini Pro está disponível e não tem bloqueio de retenção de dados no workspace.
- Interface:
  - Novo componente `ImagePilotCard`, que exibe a imagem com `object-contain` e marcadores posicionados em porcentagem, de modo que a posição continua correta em qualquer tamanho de tela.
  - `FlipCard.tsx` passa a usar `ImagePilotCard` quando `card_format === 'imagepilot'`.
  - Novo editor de conferência `ImagePilotReviewDialog`, para arrastar, adicionar, apagar e renomear marcadores.
  - Seletor de modo em `bulk.tsx`.
- Salvamento pela função atômica que já existe, estendida para aceitar `image_pins` e `image_focus`.
- Verificação: testar com uma foto de célula sem números e com uma página de livro já numerada; conferir a posição dos marcadores no celular (406 px) e no computador e o débito correto de FlashCoins.

## Fora deste plano
- ImagePilot na página do anúncio (pode entrar em uma etapa seguinte).
