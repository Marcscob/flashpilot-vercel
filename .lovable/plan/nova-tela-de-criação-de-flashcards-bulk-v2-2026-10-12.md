# Nova tela de criação de flashcards (Bulk v2)

Construir a nova tela de criação em batelada numa rota separada `/bulk-v2`, sem tocar na tela atual `/bulk`. A rota antiga continua intacta até você aprovar o resultado; só depois mesclamos na principal.

## Ordem da experiência (conforme sua decisão)

```text
1. ORIGEM DA CAPTURA   → 8 ícones: fotos, imagens, PDF/DOCX/TXT/ODS,
                          texto livre, áudio, CSV, YouTube, ideias (sem função por enquanto)
2. FILTRO DO CONTEÚDO  → Toda captura / Meus tópicos / PilotAI essencial
                          + Quantidade desejada + Instruções opcionais
3. ONDE GUARDAR        → Matéria / Assunto / Tópico (escolher ou criar novo)
4. REVISÃO             → Linhas de Pergunta/Resposta editáveis, com ditado por voz e exclusão
5. CRIAR               → Botão "Criar X flashcards" com contagem de FlashCoins
```

## Regras fixas

- **Cobrança justa mantida:** zero custo de IA até o clique em "Gerar"; FlashCoins debitadas só no salvamento final (`save_flashcards_atomically`). Cards descartados na revisão não são cobrados.
- **Anexos:** criar/escolher resumo de anotações, mapa mental/imagem e até 2 links de vídeo, propagados a todos os cards da rodada.
- **Hover:** todos os cards clicáveis (métodos de captura, opções de funil) aumentam suavemente ao passar o mouse (escala + sombra, transição física).
- **Responsivo:** grid de ícones adapta de 8 colunas (desktop) para 4/2 (celular); textos não se sobrepõem.
- **Tradução:** todos os textos novos entram no catálogo nos 7 idiomas nativos + overlays dos idiomas extras (sem rodar o tradutor automático em lote).
- **Branding:** menções ao motor de IA sempre como "PilotAI".
- **Ícone "ideias?":** presente no grid, mas desabilitado/sem função nesta fase.

## Etapas (item a item, sob seu comando)

1. **Esqueleto visual** — rota `/bulk-v2` com os 5 blocos empilhados, grid dos 8 métodos de captura, efeitos de hover e layout responsivo (sem lógica de geração ainda).
2. **Captura + Funil + Destino** — cada ícone abre sua captura (foto, PDF, texto, áudio, CSV, YouTube); funil de escopo e seletores de Matéria/Assunto/Tópico conectados aos dados reais.
3. **Geração e salvamento** — integração com o pipeline existente (PilotAI), lista de revisão editável com ditado por voz, botão final com contagem de FlashCoins e gravação atômica.
4. **Verificação** — teste no navegador (computador e celular), troca de idioma com a tela aberta, e conferência de que a tela `/bulk` antiga segue funcionando.

## Estimativa

3 a 4 créditos no total, executados etapa por etapa, cada uma só após seu "siga". Nenhuma etapa roda o tradutor automático em lote.

## Fora do escopo desta fase

- Função do ícone "ideias?" (geração a partir de tema livre).
- Substituição da rota `/bulk` oficial (só após sua aprovação final).
