# Corrigir confirmação de pagamento e crédito de FlashCoins

## O que está acontecendo

A compra é aprovada normalmente pelo provedor (a de 10.000 FlashCoins às 20:05 foi cobrada e a fatura foi emitida), mas o app descarta o aviso de pagamento aprovado e não credita nada. O registro do servidor mostra, para essa compra:

`[webhook] transação sem externalId de preço`

Ou seja: o aviso de pagamento chega, o app não consegue reconhecer qual item foi comprado e encerra sem creditar. Como nada muda no banco, a tela fica presa em "Confirmando o pagamento…" por 90 segundos e o saldo continua o mesmo. As compras anteriores que aparecem na conta só entraram porque foram aplicadas manualmente.

Causa confirmada: no aviso de pagamento, o provedor envia o item sem o identificador interno do nosso catálogo (o app depende desse campo). Ele existe quando consultamos o pagamento pela API, mas não vem no aviso.

## O que vai ser feito

1. **Reconhecer o item de outra forma, em três níveis**
   - usar o identificador do nosso catálogo, quando vier;
   - caso não venha, consultar o pagamento pela API do provedor e ler o item de lá;
   - e, por último, usar o produto já enviado pelo app no momento da compra (esse dado sempre existe: usuário + produto).

2. **Nunca descartar um pagamento aprovado em silêncio**
   Se mesmo assim o item não for reconhecido, o app registra o pagamento como pendente e responde com erro ao provedor, para que ele reenvie o aviso — em vez de encerrar como se estivesse tudo certo.

3. **Confirmação imediata na tela, sem espera de 90 segundos**
   Ao voltar do pagamento, o app passa a conferir a compra diretamente com o provedor (pelo pagamento recém-concluído) e libera na hora. O aviso "Confirmando o pagamento…" ganha limite curto e mensagem clara caso o provedor demore.

4. **Aplicar a compra que ficou pendente**
   Creditar os 10.000 FlashCoins da compra já paga às 20:05 e conferir que não existe outra compra paga sem crédito.

5. **Conferir a matéria com nome na fatura**
   A cobrança com nome próprio (criada ontem para a fatura ficar legível) não traz o identificador do catálogo; ela passa a ser reconhecida pelos dados enviados na compra, garantidos pelo mesmo caminho acima.

## Detalhes técnicos

- `src/routes/api/public/payments/webhook.ts`: `handleTransactionCompleted` resolve o preço por, em ordem, `item.price.importMeta.externalId` → `GET /transactions/{id}` (via `gatewayFetch`, que retorna `import_meta`) → `customData.priceId`/`customData.productId` mapeado contra `store_products`. Sem resolução: log de erro + resposta 4xx/5xx para acionar o retry do provedor.
- `src/lib/store-fulfillment.server.ts`: aceitar entrada por `productId` quando o `priceId` não existir, mantendo a idempotência atual (`paddle_transaction_id`).
- `src/lib/purchase-sync.server.ts`: mesma cadeia de resolução, reaproveitada pela sincronização e pelo novo caminho de confirmação.
- Novo `confirmCheckout` (server fn autenticada) em `src/lib/billing.functions.ts`: recebe o `transactionId` do evento `checkout.completed`, valida no provedor que está `completed` e que `custom_data.userId` é o próprio usuário, e aplica os efeitos de forma idempotente.
- `src/lib/paddle.ts` / `src/hooks/useCheckoutConfirmation.ts`: expor o `transactionId` do evento de conclusão e chamar `confirmCheckout` antes de cair no modo de espera; espera reduzida com mensagem de demora.
- Crédito retroativo de `txn_01m35nt8e043zzq1y22xqpv6yt` (10.000 FlashCoins) pelo caminho idempotente.

## Teste no preview

1. Comprar 1.000 FlashCoins com o cartão de teste 4242 4242 4242 4242, 12/30, CVV 100.
2. Conferir que o saldo sobe na hora, sem espera longa.
3. Comprar uma matéria e conferir liberação, validade de 365 dias e o nome da matéria na fatura.
4. Conferir no painel que a compra aparece em Minha conta com valor, data e vencimento.
