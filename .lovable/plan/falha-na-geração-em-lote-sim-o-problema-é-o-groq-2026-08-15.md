# Falha na geração em lote: sim, o problema é o Groq

## Causa confirmada
O erro mostrado (`413 ... Request too large for model llama-3.1-8b-instant ... tokens per minute (TPM): Limit 6000, Requested 6513`) vem do próprio Groq, não do app: a conta está no plano gratuito com limite de 6.000 tokens por minuto, e o app envia um pedido maior que isso.

Por que acontece: o texto é dividido em blocos de 4 flashcards por pedaço e 3 pedaços são enviados ao mesmo tempo. Com flashcards longos (súmulas, artigos, "Pegadinha", "Referência"), essa combinação estoura o limite por minuto em uma única rajada.

Além disso, o código só faz fallback para a IA da Lovable quando o Groq responde erro de chave (401/403) ou créditos (402). O erro 413/429 de limite não aciona o fallback — por isso a geração simplesmente falha.

## O que fazer

1. **Tratar limite de taxa como motivo de fallback**
   - Erros 413 (pedido grande demais) e 429 (limite por minuto) passam a cair automaticamente para a IA da Lovable, em vez de abortar. O usuário recebe os flashcards do mesmo jeito.

2. **Reduzir o tamanho dos envios ao Groq**
   - Menos flashcards por pedaço (de 4 para 2) e envio sequencial em vez de 3 em paralelo, com pequena pausa entre pedidos.
   - Se um pedaço isolado ainda for grande demais, ele é dividido novamente antes de reenviar; se ainda assim não couber, vai para a IA da Lovable.

3. **Mensagem de erro clara**
   - Se nem o Groq nem o fallback funcionarem, mostrar uma mensagem em português explicando que o limite gratuito da IA foi atingido e sugerindo reenviar em partes menores, em vez do texto técnico em inglês.

## Detalhes técnicos
- `src/lib/parse-cards.functions.ts`: adicionar `ProviderRateLimitError` para 413/429, incluí-la na condição de fallback para o Lovable AI Gateway; `blocksPerChunk` 4 → 2; `batchSize` 3 → 1 com `await` sequencial e delay curto; sub-split do chunk em caso de 413.
- Nenhuma mudança de banco de dados, de UI ou no fluxo da tela de batelada.
