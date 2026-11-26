# Nome claro do produto na fatura do Paddle

Hoje a fatura mostra só o nome genérico do catálogo ("Single Subject — Annual Access / Up to 1,000 cards"), sem dizer qual matéria foi comprada e sempre em inglês. O comprador não reconhece o que pagou.

## O que muda

Ao comprar uma matéria na Loja, a cobrança passa a ser criada com um nome próprio, no idioma do comprador, por exemplo:

- pt-BR: `Flash Pilot — Inglês - Gramática (acesso por 1 ano)`
- en: `Flash Pilot — English Grammar (1-year access)`
- es / fr / it / de / pt-PT: mesma estrutura traduzida

Esse texto aparece no checkout, na fatura em PDF e no e-mail do Paddle. A descrição secundária continua indicando a faixa ("Up to 1,000 cards" → traduzido).

FlashCoins e plano Pro continuam usando os nomes do catálogo (já são claros: "1,000 FlashCoins", "Pro Monthly").

## Como funciona (técnico)

1. Nova função de servidor `createSubjectCheckout` em `src/lib/store.functions.ts` (autenticada):
   - valida que o `productId` existe em `store_products` e é do tipo matéria;
   - resolve o preço em vigor (`subject-pricing`) e o `product_id` do Paddle a partir do preço de catálogo;
   - cria uma transação via `gatewayFetch` (`POST /transactions`) com item de preço avulso: `name` = nome traduzido com a matéria, `description` = faixa traduzida, `unit_price` = valor da faixa, `quantity 1`;
   - `custom_data` da transação carrega `{ userId, productId, priceId }` (o `priceId` do catálogo é mantido porque o fulfillment e os relatórios dependem dele);
   - devolve o `transactionId`.
2. `usePaddleCheckout` aceita `transactionId` como alternativa a `priceId` e chama `Paddle.Checkout.open({ transactionId, customData })`.
3. `store.tsx`: na compra de matéria, chama a nova função e abre o checkout com a transação; em caso de falha, cai no fluxo atual por `priceId` (não bloqueia a venda).
4. Textos: novo grupo em `src/lib/i18n-commerce.ts` com o modelo de nome/descrição nos 7 idiomas, usando o idioma ativo (`useLang`) resolvido no servidor a partir do parâmetro enviado pelo cliente.
5. Webhook/fulfillment (`store-fulfillment.server.ts`, `purchase-sync.server.ts`): passam a ler `priceId`/`productId` também de `custom_data` da transação, já que o item avulso não traz `external_id`. Liberação, validade de 365 dias, FlashCoins e reembolsos seguem iguais.

## Teste no preview

1. Loja → comprar uma matéria com o cartão de teste 4242 4242 4242 4242, 12/30, CVV 100.
2. Conferir no checkout o nome com a matéria e no idioma da interface.
3. Após a confirmação: matéria liberada em My Account com data de vencimento, e o histórico de pagamentos com o nome amigável.
4. Repetir com a interface em inglês para confirmar a tradução.
5. Conferir a fatura/e-mail do Paddle com o nome da matéria.
