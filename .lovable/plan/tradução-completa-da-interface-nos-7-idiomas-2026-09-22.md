# Tradução completa da interface nos 7 idiomas

Objetivo: qualquer texto visível — menus, botões, opções de listas, avisos, relatórios, páginas legais e aviso de cookies — passa a respeitar o idioma escolhido, em português do Brasil, português de Portugal, espanhol, inglês, francês, italiano e alemão.

## Situação encontrada

Os 7 idiomas já existem na escolha de idioma, mas a tradução está incompleta em duas frentes:

1. **Francês, italiano e alemão** têm apenas 130 de 308 textos traduzidos; o resto aparece em inglês. Faltam áreas inteiras: Relatórios, gráficos, cronômetro de foco, Configurações, telas de matéria/assunto, anotações e estudo.
2. **Muitas telas nem consultam o idioma escolhido** — o texto está fixo em português. As maiores: criação em lote, anotações, cartão de estudo, Loja, Planos, Conversação, Minha conta, mapas mentais, Painel, além de ~72 mensagens de aviso ("salvo", "não foi possível…") espalhadas por 27 arquivos.
3. **Páginas legais e aviso de cookies** (Termos de Uso, Política de Privacidade, banner de cookies, botão "Voltar") estão 100% em português, sem nenhuma ligação com o idioma.
4. **Relatório em PDF** tem título, rodapé, "Gerado em", "Página X de Y" e marca d'água fixos em português.
5. **Português de Portugal** usa hoje 26 ajustes próprios; o restante cai no português do Brasil (aceitável, mas vamos cobrir os termos mais visíveis: guardar, eliminar, definições, etc.).

## O que será feito

### Fase 1 — Completar francês, italiano e alemão
Traduzir os 178 textos que faltam em cada um dos três idiomas (Relatórios, gráficos, cronômetro, Configurações, matérias, assuntos, anotações, estudo, listas de flashcards, voz, erros). Depois disso, nenhum texto já existente aparece em inglês para quem escolheu FR/IT/DE.

### Fase 2 — Menu, cabeçalho e avisos
Ligar ao idioma: itens de menu que ainda estão fixos (Mapas mentais, Conversação, Loja, Minha conta, Painel), atalhos do menu do usuário (Flash Session, Zerar revisões e sua confirmação), rodapé (Fale conosco, Termos, Privacidade) e todas as mensagens de aviso de sucesso/erro do app.

### Fase 3 — Telas com texto fixo
Passar para o idioma escolhido: criação em lote, anotações, cartão de estudo e revisão, Loja, Planos (nomes dos planos, itens inclusos e botões), Conversação (inclusive "Repita depois de mim" e as opções de idioma da conversa), Minha conta, mapas mentais, apostila, cadernos, editor de texto e diálogos auxiliares (anexar, mover, escolher mapa/anotação).

### Fase 4 — Páginas legais, cookies e Painel
Termos de Uso, Política de Privacidade, aviso de cookies, selos de segurança e botão "Voltar" traduzidos nos 7 idiomas. O Painel do administrador também é traduzido, para não ficar misturado.

### Fase 5 — Relatórios e exportações
Título, data de geração, numeração de páginas, rodapé e marca d'água do PDF passam a sair no idioma escolhido, com acentuação garantida. Cabeçalhos da planilha/CSV idem. Títulos das páginas (aba do navegador) também.

### Fase 6 — Verificação
Abrir o app em cada um dos 7 idiomas e percorrer entrada, cadastro, início, matéria, assunto, estudo, anotações, mapas mentais, lote, relatórios (com PDF exportado), Loja, Planos, Minha conta, Conversação, Configurações, Termos, Privacidade e cookies, conferindo que nada aparece no idioma errado.

## Observações

- Nomes de idioma nas listas (Português, English, Español…) continuam escritos no próprio idioma, como é o padrão.
- Nomes de marca (Flash Pilot, FlashCoins, Pro) e conteúdo criado por você (matérias, cards, anotações) não são traduzidos.
- Valores em dólar continuam com o formato já definido.
- Nenhuma mudança em preços, pagamentos, banco de dados ou regras de acesso.

## Detalhes técnicos

- `src/lib/i18n-locales.ts`: completar `frOverlay`, `itOverlay`, `deOverlay` (178 chaves cada) e ampliar `ptPTOverlay`; manter `deepMergeDict` e as bases atuais intactas.
- `src/lib/i18n.tsx`: acrescentar os novos grupos de chaves nas três bases (`pt`, `es`, `en`) conforme as telas migradas; `Lang`, `LANG_OPTIONS`, `matchBrowserLang` e `HTML_LANG` permanecem.
- Migrar literais para `useT()` em: `AppShell.tsx`, `CookieBanner.tsx`, `LegalLayout.tsx`, `routes/termos.tsx`, `routes/privacidade.tsx`, `store.tsx`, `pricing.tsx`, `account.tsx`, `admin.tsx`, `language-chat.tsx`, `bulk.tsx`, `notes.tsx`, `study.tsx`, `notebooks.tsx`, `flashcards.tsx`, `mindmaps.tsx`, `apostila.tsx`, `subjects.$subjectId.tsx`, `topics.$topicId.tsx`, `home.tsx`, `settings.tsx`, `auth.tsx` e componentes (`FlipCard`, `RichTextEditor`, `VoiceInput`, `MicButton`, `SpeakButton`, `MindMapPicker`, `MindMapViewerDialog`, `GenerateMindMapDialog`, `BulkAttachDialog`, `NoteLinkPicker`, `MoveTopicDialog`, `PrazoScanDialog`, `RepeatAfterMe`, `CreateCardFromChatDialog`).
- `export-report-pdf.ts` recebe os rótulos já traduzidos por parâmetro (chamada em `reports.tsx`/`flashcards.tsx`), preservando a fonte Unicode embutida; CSV mantém BOM.
- `head()` de cada rota passa a usar títulos/descrições do dicionário quando dependem de idioma.
- Sem migração de banco, sem alteração de rotas e sem mudança de dependências.
