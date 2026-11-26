# Erro "something went wrong" na compra

## O que eu confirmei

Os produtos e preços estão certos nos dois ambientes (teste e real), e o app aponta para eles corretamente:

| Item na Loja | Preço no app | Preço no provedor (teste e real) |
| --- | --- | --- |
| 1.000 / 3.000 / 10.000 FlashCoins | US$ 4,99 / 12,99 / 39,99 | igual |
| Matéria até 1.000 cards | US$ 9,65 | igual |
| Matéria 1.001–2.000 cards | US$ 14,70 | igual |
| Matéria acima de 2.000 cards | US$ 17,90 | igual |
| Pro mensal / anual | US$ 4,99 / 39,85 | igual |

Testei uma compra de 1.000 FlashCoins no preview: o checkout abriu normalmente, em modo de teste, com o valor correto. Ou seja, não há erro de ligação entre app e produtos.

O erro do seu print vem do endereço de cobrança **real** (`checkout-service.paddle.com`, resposta 400). A causa é a verificação da conta de vendedor: nenhuma etapa foi concluída ainda (publicar o app, formulário de verificação, revisão do site, identificação). Enquanto isso, o provedor recusa toda compra real — nenhuma mudança de código corrige isso.

## O que fazer

### 1. Liberar a cobrança real (você faz, no painel de pagamentos)

Ordem das etapas: publicar a versão atual → preencher o formulário de verificação → aguardar a revisão do site e a verificação de identidade. Depois disso a compra real passa a funcionar. Enquanto não terminar, só o preview (modo de teste) cobra.

Para a revisão do site, as páginas de Termos, Privacidade e política de reembolso já existem no app; se a revisão apontar algo faltando, eu ajusto o texto.

### 2. Melhorar o app enquanto a conta não está aprovada

- Trocar o erro cru por uma mensagem clara na Loja e nos Planos: "pagamentos em aprovação, tente novamente em breve" em vez de "something went wrong", nos 7 idiomas.
- Mostrar um aviso discreto no topo da Loja e dos Planos quando o app estiver em modo real e a cobrança ainda não estiver liberada, para o aluno não tentar comprar e falhar.
- Manter os botões de compra funcionando normalmente no preview (modo de teste).

## Detalhes técnicos

- `store_products.paddle_price_id` usa os identificadores `flashcoins_1000/3000/10000`, `subject_tier_965/1470/1790`, `pro_monthly`, `pro_yearly`; todos existem como preços ativos em sandbox e live com os mesmos valores, e `resolvePaddlePrice` os resolve pelo `external_id` via gateway — nada a corrigir aqui.
- `.env.development` usa token `test_…`, `.env.production` usa `live_…`; o ambiente é derivado do prefixo, como esperado.
- A falha é `400 Bad Request` em `transaction-checkout` no ambiente live, equivalente a `transaction_checkout_not_enabled` (onboarding incompleto).
- Mudanças previstas: `src/hooks/usePaddleCheckout.ts` (capturar falha ao abrir o checkout e devolver erro tratado), `src/routes/_authenticated/store.tsx` e `pricing.tsx` (aviso + toast), textos novos em `src/lib/i18n-commerce.ts` nos 7 idiomas.
