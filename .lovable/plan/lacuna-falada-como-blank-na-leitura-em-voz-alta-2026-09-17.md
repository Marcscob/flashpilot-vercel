# Lacuna falada como "blank" na leitura em voz alta

Nos cards de completar, a lacuna `________` é lida pelo sintetizador como "underscore, underscore…" (ou de forma inconsistente). A leitura deve dizer sempre "blank".

## O que muda para o usuário

- Ao ouvir um card com lacuna (botão de ouvir, leitura automática, verso do card), a lacuna é falada como a palavra "blank" — uma única vez, sem soletrar símbolos.
- Vale para todos os idiomas e para as duas vozes (a do aparelho e a da nuvem), sem nenhuma mudança visual: o texto na tela continua mostrando os sublinhados como hoje.

## Detalhes técnicos

- **`src/lib/tts.ts`**: nova função interna `prepareForSpeech(text)` aplicada uma única vez na entrada de `speak()`, antes de qualquer divisão em blocos, seleção de voz ou cache — assim cobre voz do navegador e nuvem ao mesmo tempo:
  - sequências de 2+ sublinhados (`_{2,}`) viram a palavra ` blank `;
  - variantes equivalentes também são tratadas: reticências de lacuna com traço (`……` não se aplica; foco em `_`), e sequências como `___` seguidas de ponto final continuam naturais;
  - espaços duplicados resultantes são colapsados.
- A chave do cache de áudio passa a usar o texto já normalizado, evitando gerar áudio novo para o mesmo conteúdo.
- Nada muda no banco de dados, no texto exibido no card ou em `stripMarkup` da conversa.

## Verificação

- Teste unitário rápido da normalização: `"add ________."` → `"add blank ."`; texto sem lacuna permanece idêntico.
- No app real (matéria Inglês), ouvir o card "Remove the 'y' and add ________." e confirmar que a voz diz "blank" uma única vez; conferir também um card sem lacuna para garantir que nada mudou.
