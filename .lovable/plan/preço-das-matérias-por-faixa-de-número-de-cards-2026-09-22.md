# Preço das matérias por faixa de número de cards

## Regra

| Cards na matéria | Preço |
| --- | --- |
| até 1.000 | US$ 9,65 |
| 1.001 a 2.000 | US$ 14,70 |
| acima de 2.000 | US$ 17,90 |

O preço deixa de ser digitado à mão: é sempre calculado pela contagem de cards da matéria.

## Como vai funcionar

1. **Três preços no Paddle** (dentro do produto "Single Subject — Annual Access", acesso de 1 ano): US$ 9,65, US$ 14,70 e US$ 17,90. Assim o valor cobrado no pagamento é igual ao que aparece na Loja em cada faixa.
2. **Publicar matéria** (individual ou "Disponibilizar todas"): o sistema conta os cards, escolhe a faixa e grava preço + preço correspondente do Paddle automaticamente.
3. **Atualização automática a cada mudança**: sempre que o Painel e a Loja são abertos, cada matéria já publicada tem a contagem recontada; se a contagem cruzou uma faixa, o preço é corrigido na hora — no rótulo da Loja e no valor cobrado. Criar ou apagar cards passa a ajustar o preço sem nenhuma ação sua.
4. **Painel**: o campo de preço digitado sai de cena para as matérias e dá lugar a "1.248 cards · Faixa US$ 14,70 (1.001–2.000)". Continua existindo o botão de disponibilizar/ocultar e o campo opcional de preço do Paddle, para o caso de você querer um valor especial numa matéria (se preenchido, ele prevalece sobre a faixa).
5. Matérias sem cards continuam fora da Loja.
6. Quem já comprou não é afetado: a mudança de faixa vale para novas compras e renovações.

## Detalhes técnicos

- `payments--create_price` no produto `module_avulso`: `subject_tier_965` (965), `subject_tier_1470` (1470), `subject_tier_1790` (1790), USD, one-time, quantity 1/1.
- `src/lib/admin.functions.ts`: nova função `tierFor(cardCount)` retornando `{ cents, paddlePriceId }`; usada em `adminSaveSubjectPack` e `adminPublishAllSubjectPacks` no lugar de `priceUsd`/`defaultPriceUsd` e de `DEFAULT_PACK_PADDLE_PRICE`. `priceUsd` sai do input validator (mantido opcional para compatibilidade e ignorado). Override por `paddlePriceId` continua sendo respeitado.
- `adminSubjectPacks` passa a devolver `tierCents` e `tierLabel` junto de `cardCount`, e faz o reconciliation: para cada pacote já existente cujo `price_cents`/`paddle_price_id` divirja da faixa atual (e sem override manual), faz update em `store_products`.
- `src/lib/store.functions.ts` (`storeCatalog`): mesma reconciliação antes de montar a vitrine, reusando a contagem paginada já existente, para que a Loja nunca mostre preço defasado.
- `src/routes/_authenticated/admin.tsx`: seção "Matérias na Loja" troca o input de preço pelo texto da faixa; `Salvar` envia apenas `{subjectId, available, paddlePriceId?}`.
- Formatação do rótulo mantém `US$ 14,70` (vírgula).
