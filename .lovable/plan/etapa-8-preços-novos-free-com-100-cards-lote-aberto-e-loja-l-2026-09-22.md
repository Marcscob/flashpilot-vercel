# Etapa 8 — Preços novos, Free com 100 cards, lote aberto e Loja limpa

## 1. Preços do Pro (tela de Planos)

- Mensal passa a **US$ 4,99/mês** e anual a **US$ 39,85/ano**, com selo "Economize 33%".
- Os dois cartões antigos ("Módulo avulso R$ 17,90" e "Pacote Direito") saem da tela — os produtos foram arquivados no Paddle. No lugar entra um convite curto: "Matérias avulsas com acesso de 1 ano" e botão **Ver matérias na Loja**.
- O aviso de limite gratuito (janela de upgrade) passa a falar de 100 cards e de US$ 4,99/mês.

Os valores no Paddle já estão nesses números; a tela apenas passa a refletir a realidade.

## 2. Plano gratuito com 100 flashcards

- Limite do Free vai de 20 para 100 cards (criação manual, CSV, foto e lote seguem o mesmo limite).

## 3. Tela de criação em lote aberta para todos

Hoje a tela inteira fica bloqueada para quem não assina. Passa a:

- **Livre para todos** (respeitando os 100 cards do Free): lista manual de perguntas/respostas e importação de CSV — tudo roda no navegador, sem custo de IA.
- **Só para assinantes (e para você)**: "Colar texto e gerar com IA" e "Fotografar página e gerar com IA". Essas duas áreas ficam visíveis, com selo **Pro**, explicação de uma linha, botão "Assinar Pro" e um link discreto "Ver como funciona (vídeo)" — o link fica desativado até você me enviar o endereço do vídeo no YouTube.

## 4. Loja de matérias ligada ao produto Single Subject

- Toda matéria que você publicar na Loja passa a usar o produto **Single Subject — Annual Access** do Paddle (acesso de 365 dias), independentemente do valor que você digitar.
- No painel, cada matéria ganha um campo opcional **Preço no Paddle** para, no futuro, apontar um preço próprio sem mexer no código.
- A matéria já publicada (Direito Processual Civil) está apontando para um preço arquivado — será corrigida para o Single Subject, senão o pagamento falha.
- Vitrines (Loja e Planos) passam a esconder produtos sem preço válido; quem já comprou continua com o acesso normal, porque o acesso vive no registro de compra, não no catálogo.

## 5. Descrições dos FlashCoins no Paddle

Atualizo as descrições dos três preços para indicar a quantidade exata de moedas (1.000 / 3.000 / 10.000 FlashCoins), mantendo os valores.

## Observações operacionais (sem mudança no app)

Conta bancária, payouts, Pix, aprovação de site e questões fiscais são feitos por você no painel do Paddle — nada disso depende de código. O rodapé já traz Termos e Privacidade; posso acrescentar **Política de Reembolso** se você quiser (diga o texto ou eu redijo um rascunho).

## Detalhes técnicos

- `src/lib/plan-limit.tsx`: `FREE_LIMIT = 100`; `canUseBulk` deixa de gatear a tela e passa a existir `canUseAI` (assinante ou owner); textos do diálogo em dólar.
- `src/routes/_authenticated/bulk.tsx`: remove o bloqueio de tela inteira; as seções de IA (texto livre e fotos) ganham um wrapper `ProGate` com selo, CTA para `/pricing` e link de vídeo (constante `BULK_DEMO_VIDEO_URL`, vazia por ora); validação de envio continua usando `canCreate`.
- `src/routes/_authenticated/pricing.tsx`: novos valores/labels, remoção dos cartões `module_purchase` e `direito_purchase`, bloco com link para `/store`.
- `src/lib/admin.functions.ts`: `PADDLE_PACK_PRICES` substituído por padrão `module_purchase`; `adminSaveSubjectPack` aceita `paddlePriceId` opcional; retorna o price id atual em `adminSubjectPacks`.
- `src/routes/_authenticated/admin.tsx`: campo "Preço no Paddle (opcional)" na seção Matérias na Loja.
- `src/lib/store.functions.ts`: filtra produtos cujo `paddle_price_id` não está na lista de preços válidos (ou sem price id), sem alterar `user_purchases`.
- Migração aditiva única: `update store_products set paddle_price_id = 'module_purchase' where kind = 'pack' and paddle_price_id in ('pack_0990','pack_1790');` — nada é apagado.
- Paddle: `api_write` em `/prices/{id}` para ajustar apenas a descrição dos três pacotes de moedas.
- Validação final no app real (sessão própria): Planos com novos valores, lote acessível sem assinatura com IA bloqueada, Loja abrindo checkout da matéria.
