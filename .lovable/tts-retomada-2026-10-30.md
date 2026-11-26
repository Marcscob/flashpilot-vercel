# Pausa — acervo permanente de áudio

Registrada em 30/10/2026, após pedido de Marcelo às 19:10 UTC.

## Estado preservado
- Narração das conversas usa armazenamento privado no Cloud e cache persistente no dispositivo, com identidade por conta, texto, idioma e versão da voz.
- `src/lib/chat-audio.server.ts`: caminhos privados por hash, assinatura e salvamento do áudio de conversa.
- `src/lib/tts-cloud.functions.ts`: persistência da origem chat e `savedChatSpeech`, incluindo consulta `cacheOnly` sem compra de síntese.
- `src/lib/speech-memory.ts`: conjunto de trabalho limitado (12 MB / 8 entradas), liberando URLs descartadas e preservando áudio em reprodução.
- `src/lib/tts.ts`, `src/components/SpeakButton.tsx` e tela language-chat: identificação da mensagem e reutilização; antecipação das últimas 3 respostas apenas se já houver áudio salvo.
- Mudanças anteriores permanecem na prévia; nada publicado nesta pausa.

## Conferência na pausa
- 22 testes aprovados, 0 falhas, 53 verificações, em 8 arquivos: speech-memory, speech-dispatch, speech-prefetch, speech-text, repeat-audio-window, tts-storage-path, card-video-audio e gemini-tts.
- Testes locais, sem síntese real ou chamadas pagas.
- Não foi encontrado processo de teste Playwright/Python em execução na conferência.
- Registros de build/runtime em `/tmp/observability` indisponíveis nesta sessão; registro do servidor mostrou avisos de API descontinuada, não uma confirmação nova de compilação completa. A mensagem anterior registrou compilação OK.
- Nenhum código funcional foi alterado durante esta pausa.
- Esses testes não comprovam ausência de toda regressão: a narração da conversa ainda precisa de confirmação ponta a ponta.

## Retomar somente após novo pedido e disponibilidade de créditos
1. Abrir uma conversa gravada com login e identificar resposta que já tenha áudio salvo; preferir essa resposta para não gerar custo novo.
2. Confirmar que Narrar resposta toca o áudio e que o segundo clique não dispara síntese nem nova cobrança.
3. Recarregar, reabrir a mesma conversa e confirmar reprodução persistente.
4. Confirmar que abrir a conversa consulta somente áudios existentes para até 3 respostas, sem geração automática.
5. Se faltar áudio, pedir autorização antes de gerar para teste; trabalhar em blocos de dois créditos conforme preferência de Marcelo, sem prometer medição exata por mensagem.

## Pode esperar
O trabalho não depende de um processo de desenvolvimento rodando. Os arquivos e este registro permitem retomada futura. A pausa não desativa o app nem impede que usuários acionem recursos com cobrança normal; nenhuma rotina adicional de teste deve ser iniciada automaticamente.