# Compras confirmadas e painel do usuário em "Minha conta"

## O que eu verifiquei (não é problema do modo de teste)

Suas duas compras de hoje realmente foram pagas no ambiente de teste:

- 22/09 16:41 — Matéria (acesso anual) — US$ 9,65 — paga
- 22/09 16:45 — 1.000 FlashCoins — US$ 4,99 — paga

O provedor avisou o app nas duas vezes e o app respondeu "ok", mas **nada foi gravado**: seu saldo continua 0, não há compra registrada e a matéria não foi liberada. Por isso "Minha conta" aparece vazia.

Causas confirmadas:

1. **A matéria comprada não pode ser identificada pelo preço.** Dez matérias diferentes usam o mesmo preço de US$ 9,65, então o app não consegue saber qual delas você comprou e desiste em silêncio.
2. **Falhas de gravação são engolidas.** O recebimento do pagamento não confere se a gravação deu certo; qualquer erro passa como sucesso e o pagamento fica "perdido", sem nova tentativa.
3. **Falta um painel de compras de verdade.** "Minha conta" hoje só lista nome do pacote e data; não mostra valor pago, data da compra, status, recibo, nem link para estudar a matéria liberada.

## O que vou fazer

### 1. Confirmação de compra confiável
- No momento da compra, enviar junto o item exato escolhido (além do usuário), para que a liberação nunca dependa do preço compartilhado.
- Ao receber o pagamento, conferir cada gravação e, em caso de erro, registrar e devolver falha — o provedor então repete o aviso automaticamente até dar certo.
- Fallback: quando o item não vier junto, identificar pelo preço apenas se ele for único.

### 2. Recuperar as duas compras já pagas
- Botão "Sincronizar compras" (no seu painel de administração) que lê os pagamentos aprovados no provedor e aplica o que faltou: FlashCoins creditados e matéria liberada, sem cobrar de novo e sem duplicar.
- Rodar isso agora para suas duas compras de hoje.

### 3. "Minha conta" como painel de controle
Reorganizar a tela com:
- **Assinatura**: plano, situação, início e próxima cobrança (ou data-limite de acesso), valor.
- **Minhas matérias**: nome, data da compra, valor pago, vencimento, dias restantes, situação (ativa / a vencer / expirada / estornada) e botão "Estudar" e "Renovar".
- **FlashCoins**: saldo, histórico de créditos e gastos com data, motivo e valor.
- **Histórico de pagamentos**: data, item, valor, moeda, forma de pagamento e recibo do provedor quando disponível.
- **Estado vazio útil**: quando não houver nada, links para a Loja e Planos; e, se um pagamento acabou de ser feito, o aviso "Confirmando o pagamento…".
- Tudo nos sete idiomas e com datas/valores no formato do idioma escolhido.

## Como testar no preview (modo teste, sem dinheiro real)

1. Entre em "Minha conta": suas duas compras de hoje devem aparecer (após a sincronização), com valor, data e vencimento.
2. Faça uma nova compra de 1.000 FlashCoins. Cartão de teste: 4242 4242 4242 4242, validade 12/30, CVV 100, qualquer nome e CEP.
3. Aguarde alguns segundos: o saldo sobe sozinho e a compra entra no histórico de pagamentos.
4. Compre uma matéria: ela aparece em "Minhas matérias" com vencimento em 1 ano e o botão "Estudar" abre o conteúdo.
5. Opcional: estorne a compra no painel de pagamentos e veja a matéria passar a "estornada" e o saldo voltar.

## Detalhes técnicos

- `src/hooks/usePaddleCheckout.ts` + chamadas em `store.tsx`/`pricing.tsx`: incluir `customData.productId` (e `env`).
- `src/routes/api/public/payments/webhook.ts`: resolver `store_products` por `customData.productId`; `paddle_price_id` só como fallback quando houver exatamente 1 correspondência; checar `error` de todo `upsert`/`rpc` e lançar para o provedor repetir; logs com id da transação.
- Novo `src/lib/purchase-sync.server.ts` + função `reconcilePurchases` (owner) em `src/lib/billing.functions.ts`: lista `/transactions?status=completed` nos dois ambientes e reaplica efeitos idempotentes (índices únicos por transação já existem).
- `src/lib/account.functions.ts`: acrescentar `subject_grants` (com nome da matéria e `copy_subject_id`), `purchases` (histórico de pagamentos), `refunded_at`, dias restantes e link de recibo; manter `requireSupabaseAuth`.
- `src/routes/_authenticated/account.tsx`: dividir em cartões (assinatura, matérias, FlashCoins, pagamentos) com textos novos em `src/lib/i18n-commerce.ts`/`i18n-profile.ts` nos 7 idiomas.
