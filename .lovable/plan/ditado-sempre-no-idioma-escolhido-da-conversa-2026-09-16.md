# Ditado sempre no idioma escolhido da conversa

## O que está acontecendo

O ditado por voz está fixado em português: o reconhecimento de fala sempre recebe a instrução "o áudio está em português". Falando inglês, ele força tudo para o português e sai embaralhado (como "eu vou ser deliantenful" na imagem).

## O que você quer

Na conversa com idioma escolhido (ex.: inglês): não importa se você fala em português ou em inglês, o texto que aparece na caixa de mensagem deve estar sempre em inglês.

## O que muda

- Na tela de Conversação, o ditado passa a: reconhecer sua fala em qualquer idioma e entregar o texto já no idioma da conversa.
  - Se você falou no idioma da conversa, o texto é a sua própria fala, sem alterações.
  - Se você falou em português, o texto vira a versão no idioma da conversa (tradução natural, sem comentários).
- A regra vale para qualquer idioma do app: inglês, espanhol, francês, italiano e alemão.
- Conversa em português: nada muda, continua exatamente como hoje.
- Microfone em todo o resto do app (flashcards, anotações, títulos): continua igual, em português.
- A caixa de mensagem mostra o texto final, então você pode revisar ou editar antes de enviar.

## Detalhes técnicos

- `src/lib/stt.functions.ts`
  - Novo campo opcional `lang` no validador (código do idioma da conversa).
  - Sem `lang` ou com `pt-BR`: comportamento atual intacto (Whisper com `language=pt`).
  - Com idioma estrangeiro: o `language` fixo é removido (detecção automática do Whisper) e, depois da transcrição, o texto passa por uma normalização de idioma.
- Normalização de idioma (novo helper `src/lib/stt.server.ts`)
  - Uma chamada ao gateway com o modelo já usado na conversa (`openai/gpt-6-astra`, mantendo o ponto único de escolha em `language-chat.server.ts` como referência), com instrução: devolver o texto no idioma alvo, apenas o texto, sem explicações; se já estiver no idioma alvo, devolver idêntico.
  - Falha na normalização não quebra o ditado: retorna a transcrição original e o texto ainda aparece na caixa.
- `src/components/MicButton.tsx`: nova prop opcional `lang?: string`, repassada ao servidor. Sem a prop, comportamento idêntico ao atual.
- `src/routes/_authenticated/language-chat.tsx`: passa `lang={effectiveLang}` ao `MicButton`.
- `src/lib/language-chat.server.ts`: reforço na instrução do idioma estrangeiro — a resposta é sempre no idioma alvo, mesmo quando a mensagem do aluno vem em português; nunca traduzir para o português sem pedido. Ramo pt-BR inalterado.
- Créditos: a normalização é uma chamada curta de texto, registrada no uso de IA como as demais.
- Sem mudanças de banco de dados.

## Verificação

- Conversa em inglês, falando em inglês: texto sai em inglês, fiel à fala.
- Conversa em inglês, falando em português: texto sai em inglês.
- Conversa em português: ditado continua em português.
- Microfone num flashcard em português: inalterado.
- Se a normalização falhar, o texto transcrito ainda aparece na caixa.
