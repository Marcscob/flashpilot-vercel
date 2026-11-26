# Envio automático ao parar o ditado (tela de Conversação)

## O que muda para você

Na tela de Conversação em idiomas:

- **Ditado por voz:** tocar no microfone, falar e tocar em parar **já envia a mensagem** — sem precisar tocar no botão de envio depois.
- **Texto digitado:** continua como hoje — você escreve e toca no botão de envio (ou Enter).
- O texto ditado continua sendo transcrito no idioma da conversa, como já funciona.

## Como será feito

1. **`src/components/MicButton.tsx`** — ganha uma prop opcional `onDictated?: (text: string) => void`. Quando presente e a transcrição trouxer texto, o componente chama `onDictated(text)` em vez de só preencher o campo via `onChange`. Sem a prop, nada muda (comportamento atual preservado em todo o resto do app: flashcards, anotações, títulos).

2. **`src/routes/_authenticated/language-chat.tsx`** — o `MicButton` da conversa passa `onDictated`, que envia a mensagem diretamente:
   - Reutiliza a mesma função `submit`, adaptada para aceitar um texto explícito (o texto ditado), em vez de depender do campo de digitação — pois o campo pode estar vazio ou com texto parcial.
   - Se já houver texto digitado no campo, ele é preservado e o ditado é enviado junto (campo + ditado), mesma regra de hoje de acrescentar ao campo.
   - O áudio de liberação (`primeSpeech`) continua sendo chamado no toque de envio, então a leitura automática da resposta segue funcionando.
   - Se a transcrição falhar ou não entender nada, nada é enviado (comportamento atual de erro mantido).

## O que NÃO muda

- Microfone em qualquer outra tela (flashcards, anotações, títulos, assuntos) continua só preenchendo o campo — o envio automático vale **somente** para a tela de Conversação.
- Transcrição, normalização de idioma, voz da resposta, autoplay — tudo igual.
- Nenhuma mudança no banco de dados.

## Validação

- Build + typecheck.
- Teste no app real (Playwright): simular ditado na conversa → mensagem enviada automaticamente ao parar, resposta da IA chega e é narrada; digitar texto → envio continua manual pelo botão; verificar que o microfone de outra tela (ex.: criação de flashcard) continua sem envio automático.
- Apagar os dados de teste ao final.
