# Tradução completa do app em todos os idiomas (pacote único)

## Objetivo
Eliminar todos os textos que aparecem em inglês quando o usuário escolhe um dos 45 idiomas extras (japonês, russo, árabe, chinês etc.). Hoje 4 arquivos de tradução só conhecem os 7 idiomas nativos e caem em inglês nos demais. Este pacote liga esses arquivos ao carregador universal de idiomas e cobre todas as telas apontadas nos testes.

## O que será feito

### 1. Ligar os 4 módulos isolados ao carregador universal
- `src/lib/i18n-audit.ts` (Flash Session), `src/lib/i18n-screens.ts` (Flashcards, Anotações, Telegram), `src/lib/i18n-bulk.ts` (Batelada) e `src/lib/i18n-panel.ts` (Minha Conta) passam a consultar o idioma extra carregado (`public/i18n/<codigo>.json`) antes de cair no inglês.
- As chaves desses 4 arquivos entram no catálogo de extração do `scripts/translate-app-ui.ts`, para que os 45 arquivos JSON recebam as traduções.

### 2. Telas cobertas (todas as que você mostrou nos prints)
- **Flash Session**: título, botões, modais, opções de seleção e mensagens de tela vazia.
- **Flashcards**: filtros "Reviewed: all", "Flash Session: All", "Only this item", "Subtopic / sub-item" e demais rótulos.
- **Anotações**: botões "Bulk format", "Workbook", "Files", filtro "All".
- **Batelada**: "Subject", "Topic (required)", "Subtopic (optional)", "Select...", bloco de anexos, "Note (optional)", "Choose image" e demais elementos.
- **Conversação**: rótulos, campos e opções de seleção + bandeiras SVG reais no lugar dos emojis (que viram letrinhas no Windows).
- **Minha Conta**: "Payment history", "FlashCoins history" e demais cartões.
- **Configurações**: título "Alertas pelo Telegram", botões e rótulos do Telegram; os nomes dos temas de cor (Dark, Blue, Orange, Pink) **permanecem sem traduzir**, como combinado.
- **Login**: texto de introdução do topo (hoje fixo em inglês nos idiomas extras) e "Esqueci a senha".

### 3. Selo de dias no gráfico de evolução
- Os botões "7d / 30d / 90d" passam a usar a abreviação natural de cada idioma: `7d` (pt/en/es), `7j` (fr), `7T` (de), `7日` (ja), `7д` (ru) etc. O botão "Todos" já traduz.

### 4. Regras de idioma do blog
- Aluno do app que escolheu idioma manualmente: o blog aberto pelo menu do app abre no mesmo idioma.
- Visitante que clica num post: o blog abre no idioma e país do navegador (variante regional quando existir).
- Idioma/país não reconhecido: app e blog abrem em inglês.
- A detecção do navegador sempre vale para a primeira visita; a escolha manual do usuário sempre prevalece depois.

### 5. Geração das traduções nos 45 idiomas
- Rodar o tradutor automático para preencher nos 45 arquivos JSON: as chaves novas dos 4 módulos + as 29 frases já pendentes (recuperação de senha, fim de teste, dica de revisão).
- **Atenção**: na última tentativa o tradutor respondeu "créditos insuficientes" (HTTP 402) para 12 idiomas. Se o saldo de IA ainda estiver zerado, esta etapa fica bloqueada e o restante do pacote é entregue mesmo assim.

## O que NÃO muda
- Nada no banco de dados, pagamentos, preços ou regras de FlashCoins.
- Os 7 idiomas nativos continuam exatamente como estão.
- Temas de cor e conteúdo oficial seguem intocados.

## Verificação
- Compilação sem erros (`tsgo`).
- Teste visual no navegador em japonês e russo: Flash Session, Flashcards, Anotações, Batelada, Conversação, Minha Conta, Configurações, Login e gráfico de evolução.
- Blog aberto pelo menu do app respeitando o idioma do aluno; blog de visitante respeitando o navegador.
