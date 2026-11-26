# Upgrade de monetização, loja, LGPD e exportações

Entrega em 6 etapas, uma por vez, com validação sua antes da seguinte.

## Decisões já fechadas
- Assinatura: **US$ 6,99/mês** e **US$ 65,00/ano**, ambos em dólar.
- Quem não assina mantém o teste atual de 20 flashcards (sem bloqueio total).
- FlashCoins servem para pagar as ações de IA. Lotes redondos (ex.: 1.000 moedas), com o pacote mais barato a partir de US$ 4,99. Cada ação de IA consome uma fração de moedas conforme o peso da chamada, e esse custo é parametrizável.
- Pagamento sempre pelo Paddle em janela sobreposta; o app nunca vê dados de cartão.

## O que já existe hoje (não será recriado)
- Assinatura pelo Paddle, com recebimento automático de eventos e liberação por assinatura ativa.
- Compras avulsas já registradas (módulos e pacote Direito).
- Bloqueio de cópia, clique direito, arraste e seleção em todo o app, com liberação só para guit1966@gmail.com.
- Exportação de CSV e XLSX na tela de Flashcards e biblioteca de PDF já instalada.
- Medidor de créditos de IA por mês.

---

## Etapa 1 — Banco de dados e assinatura em dólar
Antes de qualquer tela, o banco.

**Novas tabelas e colunas**
- `profiles`: perfil do usuário com `flashcoins_balance` (saldo de moedas), `terms_accepted_at` e `cookies_accepted_at`.
- `flashcoin_ledger`: cada crédito ou débito de moedas (origem, quantidade, saldo depois, referência da compra) — o saldo nunca é alterado sem registro.
- `store_products`: produtos da loja (nome, descrição, imagem, preço, id de preço no Paddle, matéria/assunto liberado, ativo, ordem).
- `user_purchases`: compras de pacotes com `purchased_at` e `expires_at` = compra + 365 dias, mais o produto e a transação de origem.
- `flashcards.is_public_verified` (boolean) e `flashcard_usage` (quem usou qual card) para a Etapa 6.
- Todas com permissões explícitas e regras de acesso: cada pessoa só lê e grava o que é dela; a loja é leitura pública dos produtos ativos; gravação de compras e moedas só pelo processo de pagamento.
- Função de verificação de acesso a pacote (`has_pack_access`) usada no app e nas regras do banco, que respeita os 365 dias.

**Produtos e preços no Paddle**
- Novos preços em dólar: mensal US$ 6,99 e anual US$ 65,00 (os preços antigos em real saem da tela de planos; quem já assina não é afetado).
- Pacotes de FlashCoins em lotes redondos, o menor a partir de US$ 4,99.
- Tabela de custo por ação de IA guardada no banco (`ai_action_costs`), para ajustar os preços sem mexer no código.

**Pagamentos**
- O recebimento de eventos passa a: creditar FlashCoins nas compras de moeda, e criar a compra de pacote com validade de 365 dias.

**Proteção da sua margem (custo de IA)**
- `ai_action_costs`: para cada ação de IA (mapa mental, formatar anotação, conversa, voz, tradução, lote), o quanto ela custa em FlashCoins e o custo estimado em dólar. Você altera esses números no Painel do administrador, sem depender de mim.
- Cada uso de IA passa a registrar, junto do consumo, o custo estimado da chamada. Assim o painel mostra o custo médio por ação e por período.
- Alerta interno: quando o custo médio de uma ação subir acima da margem definida, o Painel do administrador destaca o aviso ("custo por mapa mental subiu X%"), para você reajustar o preço em moedas na hora.
- Fora do app, a recomendação prática é manter um monitor de páginas de preços dos provedores (tipo PageCrawl) avisando por e-mail; o app não depende disso, só facilita o reajuste quando o aviso chegar.

Depois desta etapa eu te mostro o esquema final em linguagem simples.

## Etapa 2 — LGPD, selos de confiança e cookies
- Páginas novas: **Política de Privacidade (LGPD)** e **Termos de Uso**, públicas.
- Links no rodapé de todo o app e na tela de entrada/cadastro.
- No cadastro, caixa obrigatória "Li e aceito os Termos de Uso e a Política de Privacidade"; a data do aceite fica guardada.
- Selos no rodapé e nas telas de pagamento: "Criptografia de ponta a ponta", "Ambiente 100% seguro" e "Pagamentos processados com segurança internacional via Paddle", com ícones de cadeado e escudo.
- Aviso de cookies no primeiro acesso, com aceite guardado.

## Etapa 3 — Loja Flashpilot
- Nova tela **Loja** no menu, com vitrine em grade: capa, nome, descrição, preço e selo de cadeado com "Compra segura".
- Botão de compra abre o pagamento sobreposto do Paddle; ao concluir, o pacote aparece liberado com a data de validade.
- Acesso expira automaticamente em 365 dias, tanto na tela quanto nas regras do banco.
- Conteúdo comprado continua somente leitura, como já é hoje.

## Etapa 4 — Painéis
- **Meu painel**: assinatura com selo "Ativa e segura", saldo de FlashCoins com botão de recarga, histórico de uso de IA e lista de pacotes comprados com validade e aviso de vencimento próximo.
- **Painel do administrador** (só guit1966@gmail.com): receita estimada, assinantes ativos, compras do período e cadastro/edição/ativação dos produtos da loja.

## Etapa 5 — Exportações e proteção de conteúdo
- **PDF para todos**, com aspecto profissional:
  - cabeçalho com a logomarca oficial do Flash Pilot;
  - título destacado "Relatório de Flash Cards";
  - linha de filtros aplicados (matéria, assunto e tópico) quando houver filtro na tela;
  - marca d'água diagonal "Flash Pilot" ao fundo de todas as páginas;
  - numeração de páginas, tabela pergunta/resposta com quebra correta e imagens dos cards quando existirem.
- **CSV só para o administrador**: o botão fica invisível para os demais, e o arquivo tem exatamente duas colunas — Face A (pergunta com as alternativas) e Face B (só a resposta).
- Bloqueio de cópia revisado e confirmado em todas as telas, com liberação exclusiva do administrador.

## Etapa 6 — Auditoria de conteúdo da comunidade
- Um card compartilhado só é enviado para a IA validar depois de ser usado por **3 pessoas diferentes**.
- Aprovado pela IA, recebe o selo de verificado e entra na biblioteca pública; reprovado, fica fora e o autor é avisado.
- Nada é apagado; o card segue sendo do autor.

---

## Detalhes técnicos
- Banco: migrações somente aditivas (nenhuma tabela ou coluna existente é removida); permissões e políticas por usuário em cada tabela nova; `expires_at` calculado na criação da compra e validado por função no banco.
- Pagamentos: reaproveitar `usePaddleCheckout`, `paddle.server.ts` e a rota de eventos já existentes; acrescentar tratamento de compra de moedas e de pacote. Preços novos criados pelas ferramentas de catálogo do Paddle (ambiente de teste sincroniza no publish).
- Acesso: verificação no servidor (carregador de rota e políticas do banco) além do bloqueio visual; nada depende só do frontend.
- PDF: `jspdf` + `jspdf-autotable` (já instalados), logo embutida, marca d'água desenhada por página com rotação e opacidade, cabeçalho repetido via `didDrawPage`.
- CSV: nova função de exportação em duas colunas, separada da planilha atual; botão condicionado ao e-mail do administrador.
- UGC: contagem em `flashcard_usage` e validação por função de servidor com o modelo padrão do projeto, registrando o consumo de IA como as demais chamadas.
- Idioma, TTS, revisão espaçada, anotações e mapas mentais não são alterados.

## Fora do escopo
- Tradução das páginas legais para outros idiomas.
- Reembolso ou cancelamento dentro do app (feito pelo portal do Paddle).
- Loja de conteúdo criado por outros usuários (só o catálogo oficial).
