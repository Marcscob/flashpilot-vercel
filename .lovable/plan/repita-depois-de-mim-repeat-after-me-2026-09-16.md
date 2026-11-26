# Repita depois de mim (Repeat after me)

Novo modo de prática na mesma tela de Conversação em idiomas: a IA fala uma frase, você repete pelo microfone, o app mostra o que você disse comparado com a frase e passa para a próxima.

## Como o usuário usa

1. Na tela de Conversação, no seletor **Modo**, além de Conversação, Professor e Treino, aparece **Repita depois de mim**, com a explicação curta "A IA diz uma frase e espera você repetir".
2. Ao escolher esse modo e começar, a IA envia a primeira frase (curta, no idioma e no nível escolhidos, dentro do tema). A frase é lida em voz alta automaticamente, como já acontece hoje com as respostas.
3. Cada frase aparece num quadro próprio com:
   - botão **Ouvir de novo**;
   - botão de **microfone** para repetir (ao parar de falar, a tentativa é enviada sozinha, como já funciona hoje);
   - botão **Próxima frase**.
4. Depois de repetir, o app mostra lado a lado a frase original e o que foi entendido, **destacando palavra por palavra** o que ficou diferente (acertos em verde, diferenças em vermelho), com uma nota curta da IA e uma porcentagem de acerto.
5. Se sair diferente, a mesma frase continua no quadro: dá para ouvir e tentar quantas vezes quiser. A próxima frase só vem quando você pede.
6. As frases geradas ficam **guardadas** e podem ser repraticadas depois: dentro do quadro há **Repetir esta frase** e, na parte de baixo do modo, a lista **Frases já praticadas** (frase, idioma, nível, melhor acerto e data), com botões de ouvir, repetir e excluir. Frases já guardadas são reaproveitadas antes de gerar novas, o que economiza créditos de IA.

Matérias e conversas sem idioma estrangeiro continuam exatamente como hoje: o novo modo só aparece quando o idioma da conversa é diferente de português.

## Detalhes técnicos

**Configuração** — `src/lib/language-chat-config.ts`: novo item em `CHAT_MODES` com `id: "repeat"`, rótulo, descrição e `guidanceEn/guidancePt` ("gere apenas uma frase curta para o aluno repetir, sem perguntas, sem explicação, só a frase"). `findMode` e `modeLabel` seguem funcionando (fallback já existente). `src/lib/language-chat.functions.ts`: `mode` passa a aceitar `"repeat"` no `z.enum`.

**Prompt** — `src/lib/language-chat.server.ts`: no modo `repeat` o prompt pede uma única frase, sem pergunta final (a regra "termine com uma pergunta" é omitida nesse modo) e mantém `PLAIN_TEXT_RULE_*` e o bloco de correção desligado. Sem novo modelo: continua `LANGUAGE_CHAT_MODEL`.

**Comparação sem IA** — novo `src/lib/repeat-compare.ts`: normaliza (minúsculas, sem pontuação, sem acento opcional por idioma), tokeniza e alinha as palavras (LCS) devolvendo `{ tokens: [{ text, status: "ok" | "wrong" | "missing" | "extra" }], score }`. É puro TypeScript, testável e não gasta crédito.

**Persistência** — nova tabela `language_repeat_phrases` (id, user_id, lang, level, topic, text, times_practiced, best_score, last_practiced_at, created_at), com `GRANT SELECT/INSERT/UPDATE/DELETE` para `authenticated`, `GRANT ALL` para `service_role`, RLS habilitada e políticas `own` (`auth.uid() = user_id` em USING e WITH CHECK), além do trigger `update_updated_at_column` já usado no projeto. Antes de gerar frase nova, o app busca uma frase guardada ainda não praticada para aquele idioma/nível/tema; só chama a IA quando não há. Nenhuma tabela existente é alterada e nenhum dado é apagado.

**Store** — `src/lib/language-repeat-store.ts`: `listPhrases`, `savePhrase` (reaproveita quando o texto já existe para o mesmo idioma/nível), `recordAttempt(id, score)` (atualiza `times_practiced`, `best_score`, `last_practiced_at`), `deletePhrase`.

**Tela** — `src/routes/_authenticated/language-chat.tsx`: quando `mode === "repeat"`, o fluxo de mensagens é substituído pelo painel de repetição (`src/components/RepeatAfterMe.tsx`), reutilizando o que já existe: `speak`/`primeSpeech`/`stopSpeaking` de `@/lib/tts`, `SpeakButton`, `MicButton` com `lang={effectiveLang}` e `onDictated`, e a mesma server function `languageChatReply` para gerar a frase. A leitura automática segue o botão "Voz ligada/desligada" atual.

**Fora do escopo:** avaliação de pronúncia por análise de áudio (a comparação é sobre o texto que o ditado entendeu) e frases geradas a partir de flashcards.
