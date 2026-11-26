# Pro com FlashCoins incluídas + telas de assinante

## 1. FlashCoins incluídas no Pro
- Pro mensal: +150 FlashCoins na contratação e em cada renovação mensal.
- Pro anual: +300 FlashCoins na contratação e em cada renovação anual.
- Crédito feito pelo servidor ao confirmar o pagamento, uma única vez por cobrança (sem duplicar se o Paddle reenviar o aviso).
- Aparece no extrato de FlashCoins como "Assinatura Pro".
- Crédito retroativo de 150 FlashCoins na assinatura de teste já existente.

## 2. Tela de Planos
- Cards mostram "+150 FlashCoins/mês" (mensal) e "+300 FlashCoins/ano" (anual), nos 7 idiomas.
- Se já for assinante: o convite "Assine o Pro..." vira agradecimento pela contratação.
- Remover a frase sobre cancelar antes de trocar de plano.
- Manter o selo "Assinatura Pro ativa" e os botões desativados.

## 3. Minha Conta
- Mostrar de imediato o plano contratado, status e data de renovação, inclusive nas compras de teste do preview.
- Nome do plano legível ("Pro mensal" / "Pro anual") em vez do código interno.

## Detalhes técnicos
- `webhook.ts`: em `transaction.completed` com `subscriptionId` e preço `pro_monthly`/`pro_yearly`, creditar via RPC/insert em `flashcoin_ledger` com `action_id = paddle transaction id` (único) e atualizar saldo.
- Grant inicial também cobre a primeira transação; idempotência pela chave da transação.
- `account.functions.ts`: incluir `sandbox` nos filtros de `environment` quando o app roda em ambiente de teste.
- `pricing.tsx`: novas chaves i18n `thanksSubscriber`, `coinsMonthly`, `coinsYearly`; remover `switchBlocked` da exibição.
- Atualizar memória com a regra 150/300 FlashCoins.
