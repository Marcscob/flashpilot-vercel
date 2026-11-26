# Base funcional auditada — FlashPilot

## Finalidade e limites

Este documento substitui a descrição funcional anterior como referência para um futuro manual do usuário e para a elaboração de testes. Ele confronta as afirmações do relatório funcional recebido com o código e as migrations deste checkout. Não é uma garantia de que todas as migrations foram aplicadas em produção nem de que as configurações externas estejam iguais às do repositório.

**Base examinada:** commit `3f08411` e alterações locais existentes no momento da revisão. As alterações locais não foram criadas para esta especificação e não foram modificadas por ela. A validação foi estática: não houve acesso ao banco de produção, ao painel do Paddle, aos provedores de IA ou a uma conta de usuário real.

**Classificações**

- **Confirmado:** regra observável no fluxo de aplicação ou no banco.
- **Parcial:** há implementação, mas a afirmação é mais ampla do que a evidência.
- **Divergente:** o comportamento implementado contradiz ou limita a afirmação.
- **Não comprovado:** não foi encontrada evidência suficiente no código consultado.
- **Externo:** depende de provedor, segredo, catálogo ou configuração de implantação.

Não há script `test` no `package.json` nem arquivos de teste `*.test.*`/`*.spec.*` em `src`. Os casos ao final são critérios propostos; **não foram executados**.

## Revisão ponto a ponto da descrição recebida

| ID | Afirmação | Avaliação | O que o código sustenta |
|---|---|---|---|
| AUD-01 | O produto é um app de estudos, flashcards, notas, conversação e PilotAI. | **Confirmado** | Há rotas e módulos para estudo, notas/apostilas, chat de idiomas, geração de flashcards, mapas mentais, relatórios e loja. |
| AUD-02 | É PWA e funciona em sete idiomas completos. | **Parcial** | Há configuração/seleção de idiomas da interface, mas a lista de idiomas de conteúdo usada pelo PilotAI contém seis códigos: `pt-BR`, `en`, `es`, `fr`, `it`, `de`. A lista não inclui `pt-PT`. Uma interface traduzida não comprova cobertura completa de todos os fluxos nem suporte equivalente do modelo. A instalação/offline como PWA requer validação de implantação e dispositivo. |
| AUD-03 | O nome PilotAI é sempre usado e nunca aparecem siglas genéricas. | **Não comprovado** | O produto usa PilotAI em diversos textos e fluxos. Não há uma regra técnica que impeça outros nomes em todos os textos, respostas de IA ou integrações. |
| AUD-04 | Cópia, recorte, menu de contexto e arrasto são bloqueados no app. | **Parcial** | O `AppShell` aplica `select-none` e bloqueia eventos de cópia, recorte, menu de contexto e arrasto fora de campos editáveis. Colar em campos continua permitido. É uma barreira de interface, não proteção contra captura, ferramentas do navegador ou inspeção do cliente. |
| AUD-05 | Cadastro é por e-mail/senha ou login social, sem cartão, e exige aceite de termos. | **Parcial** | O código oferece e-mail/senha e Google OAuth; exige aceite dos termos no cadastro. Não foi encontrada exigência de cartão no fluxo de cadastro. “Login social” não deve ser entendido como qualquer provedor: o fluxo observado é Google. |
| AUD-06 | Trial gratuito de 15 dias começa no cadastro. | **Confirmado com condição** | O status é calculado a partir de `profiles.created_at`. Contas criadas a partir do lançamento de 01/10/2026 recebem 15 dias; contas anteriores são grandfathered e não são bloqueadas por essa regra. |
| AUD-07 | O kit de boas-vindas é creditado automaticamente e sem condições. | **Divergente** | O bootstrap tenta reivindicá-lo, mas a RPC exige e-mail confirmado, orçamento de IA ativo e limites antifraude. Concede 40 FlashCoins, 2 mapas, 3 formatações e 15 turnos uma única vez por conta. Também limita concessões por dispositivo e sub-rede. |
| AUD-08 | As 40 FlashCoins do kit e as moedas compradas expiram após 12 meses. | **Não comprovado no backend** | O texto legal e a loja declaram validade de 12 meses, mas o saldo é agregado em `profiles.flashcoins_balance` e o `flashcoin_ledger` não registra validade por crédito. Não foi localizada rotina que deduza moedas não usadas ao completar 12 meses. Não tratar a expiração como garantida até implementá-la e testá-la no servidor. |
| AUD-09 | Há modal de boas-vindas e e-mail no idioma nativo com a data exata de término. | **Parcial** | Há bootstrap, modal e templates de cadastro/localização do kit. A data pode ser calculada a partir do status do trial. Isso não comprova entrega do e-mail em todos os provedores, nem a localização de todos os templates. |
| AUD-10 | E-mail do dia 9 informa que faltam exatamente seis dias e é localizado. | **Divergente** | A automação diária busca contas pelo dia de calendário de São Paulo e usa um template único em português. O texto do template diz apenas “faltam alguns dias”, sem afirmar seis. |
| AUD-11 | E-mail do dia 14 é véspera do fim do trial de todos os destinatários. | **Divergente** | A automação seleciona usuários por idade da conta e exclui assinantes, mas não exclui quem reivindicou os cinco dias. O template diz “termina amanhã”; para quem estendeu o trial, isso pode ser falso. |
| AUD-12 | No 16º dia o app concede automaticamente mais cinco dias. | **Divergente/parcial** | A tela oferece uma ação explícita após o trial inicial, portanto não há concessão automática. Porém, a RPC apenas verifica se a extensão ainda não foi registrada; não exige que o trial tenha terminado nem que o usuário esteja sem assinatura. A função autenticada pode ser chamada antes da hora, marcando o trial como estendido para 20 dias. |
| AUD-13 | Contas anteriores a 01/10/2026 não sofrem bloqueio de trial. | **Confirmado** | A função de banco compara `profiles.created_at` com `2026-10-01 00:00:00+00`. |
| AUD-14 | Após o trial, os dados permanecem e o usuário pode continuar estudando. | **Confirmado com exceção** | A barreira de trial impede inserções de cards, notas, tópicos e matérias e as reservas cobertas por `reserve_ai_quota`. Leitura/revisão não é bloqueada por esses gatilhos. O ditado (`assertSttAllowed`) usa uma cota Free separada de 60 chamadas/mês e não consulta o status do trial; pode continuar disponível pós-trial. Atualizações de conteúdo existente não são barradas pelos gatilhos que só atuam em `INSERT`; testar os fluxos separadamente. |
| AUD-15 | O teto gratuito de 100 cards é aplicado no servidor. | **Confirmado nos caminhos de salvamento encontrados** | O RPC `save_flashcards_atomically` conta cards próprios (`source_id IS NULL`) e rejeita a gravação acima de 100 para não-Pro. O cliente também antecipa o bloqueio para a experiência de uso. Cards de conteúdo adquirido não entram nessa contagem. |
| AUD-16 | O TrialEndedDialog mostra o primeiro nome e a pessoa pode fechá-lo por clique externo/ESC. | **Parcial/divergente** | O diálogo permite dispensar por clique fora, ESC ou botão. O componente consultado não lê nem exibe o primeiro nome. O estado dispensado evita reabertura repetida na mesma sessão. |
| AUD-17 | Após o trial, basta comprar FlashCoins para continuar usando a IA. | **Divergente com exceção** | Para recursos protegidos por `reserve_ai_quota`, a validação do trial bloqueia a chamada mesmo que exista saldo; moedas não reabrem esse acesso. Durante trial ativo, moedas cobrem determinadas cotas esgotadas. O ditado tem cota Free separada de 60 chamadas/mês e não passa por essa validação de trial. |
| AUD-18 | Pro tem criação em lote e quantidade ilimitada de cards. | **Parcial/divergente** | A interface trata criação manual como ilimitada para assinantes. Para cards gerados com IA, há cota inclusa de 2.500 cards por ciclo de cobrança; excedentes podem seguir o fluxo de FlashCoins. Cada solicitação aceita no máximo 2.500 cards. Portanto, “ilimitado” não descreve a geração inclusa. |
| AUD-19 | Pro inclui cotas mensais de conversa, mapas, formatação, voz e ditado. | **Parcial** | O código define 400 turnos de conversa, 50 mapas, 60 formatações e 100.000 caracteres de voz em nuvem por ciclo/contagem correspondente; a conversa também tem limite de 200.000 caracteres por mês. Ditado tem limites de 60 chamadas/mês sem assinatura (inclusive sem trial, pelo caminho consultado) e 300 no Pro. A renovação depende do período da assinatura confirmado pelo Paddle. |
| AUD-20 | Há limite de proteção de cinco operações de IA por dia para usuários gratuitos. | **Confirmado com escopo** | A RPC limita a cinco jobs por dia UTC, compartilhados por geração de flashcards, mapas e formatação. Não é um limite diário geral para cada recurso nem inclui turnos de chat no mesmo contador. |
| AUD-21 | Matéria, assunto, tópico e subtópico têm os níveis e obrigatoriedades descritos. | **Parcial/terminologia divergente** | O modelo tem `subjects` e `topics`; tópicos usam `parent_id` para hierarquia e o card precisa de `topic_id`. Não são quatro entidades/tabelas independentes. O fluxo de mover cards pode criar um tópico “Geral” se o usuário escolher destino genérico e ainda não houver um. |
| AUD-22 | O estudo oferece frente/verso, múltipla escolha, lacunas e tradução instantânea. | **Parcial** | O modelo/gerador e o renderizador contemplam formatos `plain`, `mcq`, `cloze` e `imagepilot`. Não foi comprovado um recurso geral de tradução instantânea na revisão de todos os cards. |
| AUD-23 | O algoritmo é SM-2 com avaliações Errei, Difícil, Bom e Fácil. | **Parcial** | Há cálculo SM-2 com fator de facilidade, repetições e intervalo, mas o algoritmo foi ajustado (intervalos/caps próprios). A UI e dados de revisão devem ser testados; a tabela de notas internas aceita qualidade numérica de 0 a 5, não apenas quatro valores. |
| AUD-24 | O modo de repetição avalia fonética. | **Divergente** | O microfone produz uma transcrição; `repeat-compare` normaliza e compara palavras/tokens para calcular percentual e destacar diferenças. Não há análise acústica/fonética da gravação. |
| AUD-25 | Histórico do modo de repetição rola automaticamente após dez frases. | **Não comprovado** | O histórico aparece em uma área com rolagem vertical; não foi localizada regra que dispare rolagem automática ao chegar a dez itens. |
| AUD-26 | A voz reproduzida em cache não volta a consumir cota. | **Confirmado para cache hit** | O TTS em nuvem reserva cota por caracteres e liquida com `success: false` quando o áudio já está em cache; o cache evita nova geração/cobrança de uso. O cache de estudante é particionado por usuário na chave. |
| AUD-27 | O app garante uso em modo paisagem no celular. | **Não comprovado** | Não foi encontrada regra explícita de orientação/landscape. A responsividade geral não equivale a uma garantia de uso em paisagem em Android e iOS. |
| AUD-28 | Geração em lote aceita qualquer origem, incluindo planilhas, PDF, DOCX e fotos. | **Parcial** | A UI aceita texto, PDF, DOCX, TXT, MD, HTML/HTM e imagens; há também importação de CSV. Isso não comprova importação de planilhas XLS/XLSX nem “qualquer origem”. O texto bruto enviado tem teto de 150.000 caracteres; imagens e PDF têm limites distintos por plano. |
| AUD-29 | A cobrança de lote é por cards efetivamente salvos, com reserva temporária e sem cobrança duplicada. | **Confirmado para o fluxo de cards gerados** | O backend registra outputs, reserva o saldo e liquida na gravação atômica pelos outputs salvos. O RPC de salvamento usa recibo/idempotência por ação e rejeita reuso com conteúdo diferente. Não se aplica a card manual como uma cobrança de geração. |
| AUD-30 | Cada flashcard gerado custa uma FlashCoin. | **Confirmado no custo configurado** | A ação `bulk` está configurada em 1 moeda por card. A cobrança efetiva depende do plano, saldo, cota incluída, trial ativo e cards salvos. |
| AUD-31 | A apostila possui editor avançado e exportação PDF formatada. | **Parcial** | Há editor rico de notas, links de vídeo YouTube, vínculos entre notas/cards e rota de apostila. O PDF é produzido pelo fluxo de impressão do navegador (“Imprimir / PDF” → “Salvar como PDF”); paginação e aparência final dependem do navegador e precisam de teste. |
| AUD-32 | Formatação de notas longas é dividida em chunks sem limites relevantes. | **Parcial** | O servidor aceita partes de até 6.000 caracteres e no máximo 60 partes. O total da nota é limitado a 15.000 caracteres no Free e 60.000 no Pro. Uma sessão desconta uma unidade, não uma por parte. |
| AUD-33 | Mapa mental aceita cards ou nota, tem zoom/download e custa 7 moedas. | **Parcial** | Há fluxo de geração a partir de conteúdo e armazenamento/visualização de imagem, com limite de 2 mapas no kit e 50 no ciclo Pro; excedida a cota, o custo configurado é 7 moedas. Gestos de zoom/download devem ser validados no navegador. |
| AUD-34 | O chat aceita qualquer um dos sete idiomas, voz/texto e autoplay imediato. | **Parcial** | Há chat em texto, captura de voz por microfone/transcrição e opção de leitura automática de respostas. O autoplay é controlável pelo usuário, não uma garantia de fala em toda resposta. O catálogo de idiomas de conteúdo encontrado contém seis opções e não `pt-PT`. |
| AUD-35 | A varredura de prazos encontra prazos com precisão e cria coleção exclusiva. | **Parcial** | O servidor primeiro filtra cards por palavras-chave e depois pede classificação ao PilotAI; os aprovados podem ser copiados para um tópico de destino. Isso não comprova completude nem precisão jurídica. O endpoint de cópia cria cards independentes; compatibilidade com a regra de conteúdo oficial somente leitura precisa de decisão explícita. |
| AUD-36 | Compra de matéria oficial dá acesso permanente, somente leitura e não clonável. | **Divergente/parcial** | A validade do produto é configurável e usa 365 dias como padrão; a tela exibe dias de acesso. A renovação estende a concessão sem reduzir uma data posterior. O código possui proteções para conteúdo adquirido, mas a varredura de prazos pode copiar cards acessíveis para um tópico de destino. A palavra “permanente” não corresponde ao padrão de expiração. |
| AUD-37 | Paddle aceita cartão, Apple Pay e métodos locais, com ativação instantânea e isolamento sandbox/live. | **Parcial/externo** | O app usa checkout e webhooks Paddle e separa ambiente nas operações. A lista de meios de pagamento e sua disponibilidade dependem da configuração do Paddle/região. A interface informa que confirmação pode levar alguns instantes; “no mesmo segundo” não é garantido. Isolamento deve ser testado com credenciais de ambos os ambientes. |
| AUD-38 | Compras antecipadas somam o novo prazo ao saldo restante. | **Parcial** | A concessão de acesso usa `GREATEST` para não reduzir a data de expiração atual. A regra efetiva de nova data e de compra repetida deve ser testada com datas reais e produto configurado. |
| AUD-39 | O painel mostra saldo dinâmico, validade das moedas e status de assinatura. | **Parcial** | O saldo é consultado no servidor e o painel lista histórico/assinatura. A validade de moedas não está modelada por concessão no ledger e, portanto, não pode ser apresentada como expiração calculada pelo backend com a evidência atual. |
| AUD-40 | Excluir conta apaga todos os dados e arquivos. | **Divergente/parcial** | A rotina arquiva dados de compra (incluindo e-mail e antigo ID do usuário) para fins fiscais; limpa explicitamente `note-images` e `flashcard-mindmaps`, apaga notas/categorias e depois remove o usuário para depender de cascatas. Não limpa explicitamente `tts-cache`; erros das exclusões de notas/categorias também não são verificados antes da exclusão da conta. Não afirmar eliminação integral sem testar todas as FKs, tabelas e objetos. |
| AUD-41 | Cada custo real de IA e débito fica registrado integralmente. | **Parcial** | Há ledger de FlashCoins, recibos e registros de uso/cotas. Isso sustenta auditoria de débitos e consumo medido, mas não prova que o custo real faturado por cada provedor é reconciliado centavo a centavo. |
| AUD-42 | A mensagem de saldo insuficiente é personalizada e leva à loja. | **Parcial** | `NoCoinsDialog` busca o primeiro nome, idioma e dias restantes quando o trial está ativo; o botão abre a loja. Isso não comprova que todo erro de saldo chegue ao modal, nem que a mensagem faça sentido após o trial, quando moedas não reabrem os recursos protegidos. |

## Comportamento funcional que pode servir de baseline

### Cadastro, kit e trial

- Cadastro observado: e-mail/senha ou Google; o formulário exige nome e aceite dos termos. Não há checkout/cartão no formulário.
- O perfil define o início do trial. Contas com `created_at` anterior a 01/10/2026 ficam grandfathered; as demais têm 15 dias. A extensão, se reivindicada, torna o total 20 dias contados desde a criação.
- A tela só oferece a extensão após o término inicial, mas o endpoint/RPC não valida esse momento: chamada autenticada antecipada também a registra. Confirmar se a regra desejada é permitir ou rejeitar essa chamada.
- A extensão é uma ação explícita, única e apresentada depois do término inicial. Dados e revisão continuam disponíveis depois do trial; novas inserções de cards/notas/tópicos/matérias e novas reservas de IA são bloqueadas.
- Exceção observada: o ditado de voz usa uma cota gratuita mensal separada e não verifica `is_user_trial_blocked`; portanto, não deve ser descrito como bloqueado junto com todo recurso de IA pós-trial.
- O kit é concedido pela infraestrutura autenticada somente após confirmação de e-mail e aprovação de antifraude/orçamento. Valores: 40 FlashCoins, 15 turnos, 2 mapas e 3 formatações.
- O kit e os recursos pagos não devem ser considerados disponíveis antes de confirmar o estado do servidor; o cliente apenas solicita/mostra o estado.

### Cotas e cobrança de IA

| Recurso | Free/trial | Pro incluído | Observações |
|---|---:|---:|---|
| Jobs de geração de cards, mapas e formatação | Até 5 jobs combinados por dia UTC | Sem o mesmo teto Free | O teto diário não inclui chat no mesmo contador. |
| Chat | 15 turnos do kit | 400 turnos por ciclo e limite de 200.000 caracteres/mês | Após cota, há caminho de FlashCoins enquanto o trial permitir. |
| Formatação | 3 sessões do kit | 60 sessões/ciclo | Até 15.000 caracteres Free e 60.000 Pro; partes de até 6.000 caracteres. |
| Mapas mentais | 2 do kit | 50/ciclo | Custo avulso configurado: 7 FlashCoins por mapa. |
| Cards salvos com geração de IA | Limite global Free de 100 cards próprios e regras de trial/IA | 2.500 unidades inclusas por ciclo | Custo `bulk`: 1 FlashCoin por card; o salvamento contabiliza outputs gravados. |
| Ditado de voz | 60 transcrições/mês sem assinatura | 300 transcrições/mês | O código não exige trial ativo para a cota Free de STT. O cliente limita a gravação a aproximadamente 3 minutos e o servidor valida tamanho/formato. |
| TTS em nuvem fora do catálogo/cache | Não é recurso Free | 100.000 caracteres/mês | Repetir áudio em cache não consome nova cota de geração. |

Os limites acima vêm de migrations e constantes no repositório. Períodos, estados de assinatura e elegibilidade dependem de dados válidos do Paddle e da migration efetivamente aplicada. O fallback por moedas não anula o bloqueio de trial encerrado.

### Flashcards e revisão

- Cada card salvo exige um tópico pertencente ao usuário; o modelo tem matérias (`subjects`) e tópicos hierárquicos (`topics.parent_id`).
- O salvamento do app usa RPC autenticada no servidor, valida conteúdo, associação a matéria/tópico/notas/categorias, limite de tamanho e idempotência.
- O limite de 100 cards considera cards próprios, excluindo cards associados a conteúdo adquirido (`source_id` não nulo). A revisão de conteúdo já existente não é bloqueada ao encerrar o trial.
- Formatos identificados no modelo/renderização: tradicional, múltipla escolha, cloze e ImagePilot. “Tradução instantânea” não foi estabelecida como função geral de revisão.
- O módulo SM-2 guarda `ease_factor`, `interval_days`, `repetitions` e `due_date`; seus intervalos têm ajustes/caps próprios. A nota de revisão é representada numericamente.

### Arquivos, notas, voz e outros recursos

- A geração por arquivo recebe PDF, DOCX, TXT, MD, HTML/HTM, imagem e texto colado; há também importador específico de CSV. Não foi confirmada importação XLS/XLSX. O texto bruto enviado tem teto de 150.000 caracteres e cada chamada aceita até 2.500 cards. PDF: Free até 15 MB/10 páginas; Pro até 50 MB/60 páginas. Imagens: Free até 8, 5 MB cada/25 MB total; Pro até 20, 10 MB cada/100 MB total.
- A formatação de notas é faturada por sessão, embora possa ser executada em partes.
- O ditado envia áudio a serviço de transcrição no servidor. A precisão de voz, qualidade de OCR e saída generativa são dependências externas; não há garantia de que conteúdo ilegível ou incorreto seja recuperado corretamente.
- Há histórico de chat/frases, seleção de idioma e leitura de voz. O modo “Repita depois de mim” pontua correspondência textual da transcrição, não pronúncia acústica.
- A varredura de prazos é uma ajuda de estudo baseada em pré-filtro lexical e classificação por IA; não é ferramenta jurídica de validação de prazo.
- A exportação de apostila usa impressão do navegador. O fluxo de flashcards oferece PDF ao aluno; CSV/XLSX aparecem como exportação administrativa, enquanto a importação encontrada é CSV no módulo de criação em lote.

### Loja, conteúdo oficial e privacidade

- Produtos, preços, validade e preço Paddle são configuráveis no catálogo. Pacotes de matéria usam `validity_days` com padrão 365 dias, não acesso permanente por padrão.
- Checkout/webhook e sincronização de compras são assíncronos e idempotentes por transação. Ambientes live e sandbox devem ser testados separadamente.
- O ledger de FlashCoins não registra vencimento individual hoje; a expiração de 12 meses que aparece nos textos da loja/termos precisa de implementação ou de correção do texto comercial.
- A exclusão da conta mantém arquivo fiscal identificável (`email`, antigo ID e dados de compras), purga dois buckets explicitamente e depende de cascatas para o restante. Cache de TTS e todos os caminhos de Storage devem entrar no teste de exclusão.
- Conteúdo oficial é apresentado como leitura, com proteções de edição/exclusão em alguns caminhos. A cópia feita pela varredura de prazos é uma exceção observável que precisa ser autorizada ou bloqueada segundo a política do produto.

### Funcionalidades adicionais encontradas no código

Estes itens não estavam descritos ou estavam pouco detalhados no relatório original e devem entrar no futuro manual/teste:

- Cadernos de estudo com escopos de cards e modos de ordenação.
- Dashboard e relatórios de revisão, incluindo evolução/precisão, cards vencidos, favoritos e histórico de avaliações.
- Vínculo de cards e notas, categorias, anexos de imagem e links de vídeo.
- Integração de lembretes de revisão pelo Telegram, sujeita a vínculo da conta, preferências e execução do agendador.
- Configurações de conta, idioma e senha; exportação de relatórios e exclusão de conta.

## Lacunas e decisões pendentes antes de transformar isto em manual público

1. **Moedas:** implementar expiração por crédito em 12 meses (incluindo kit e moedas compradas) com débito FIFO e exibição por lote, ou remover/alterar a promessa legal/comercial.
2. **Trial estendido:** corrigir segmentação/template do dia 14 para não dizer “termina amanhã” para quem está no período de 20 dias; decidir se envia lembrete alternativo.
3. **Pós-trial:** alinhar a descrição de uso de moedas com o bloqueio soberano de IA após o trial; documentar claramente que moedas não reabrem recursos protegidos por trial. Decidir e testar a exceção de 60 ditados Free/mês.
4. **Pro ilimitado:** especificar separadamente criação manual, geração por IA, limite incluso de 2.500 cards/ciclo e custo após a cota.
5. **Idiomas:** decidir se `pt-PT` deve estar disponível para PilotAI/ditado/TTS/conteúdo, e executar auditoria de cobertura de interface em todos os sete idiomas.
6. **Conteúdo oficial:** decidir se a varredura de prazos pode copiar cards oficiais. Aplicar a mesma política na interface, APIs, RLS e termos.
7. **Exclusão/LGPD:** definir prazo e base de retenção do arquivo fiscal; auditar cascatas e todo Storage, incluindo `tts-cache`; tratar falha ao apagar notas/categorias antes de apagar o usuário.
8. **Repetição de idiomas:** renomear a promessa de “fonética” para comparação de transcrição ou criar avaliação acústica real. Confirmar se a lista de frases deve rolar automaticamente após dez itens.
9. **PWA/landscape:** documentar apenas dispositivos e recursos testados; adicionar cobertura de orientação e instalação/offline se forem requisitos.
10. **Custo de IA:** decidir se é requisito auditar custo monetário real por provedor; o ledger de uso e moedas não é, por si só, reconciliação de faturas externas.
11. **Pagamentos:** registrar no manual quais meios de pagamento estão ativos em cada país e quais prazos de confirmação/cancelamento são observados no Paddle.
12. **Dados de entrada:** confirmar e documentar os formatos aceitos na UI (especialmente planilhas) e limites por formato/plano; não inferir importação XLSX pelo fato de existir exportação XLSX.
13. **Extensão de trial:** a RPC permite reivindicação antes do fim do período inicial. Se o presente só deve ser elegível após o vencimento, validar essa condição no servidor, não apenas na interface.

## Roteiro de testes de aceitação

Todos os casos estão **pendentes de execução**. Usar sandbox/contas de teste, relógio controlado para limites temporais e fixtures isoladas; nunca testar cobranças reais sem autorização.

| ID | Pré-condição | Ação | Resultado esperado |
|---|---|---|---|
| AUTH-01 | Usuário sem conta | Tentar cadastrar sem aceitar termos; depois aceitar e cadastrar por e-mail/senha. | Primeiro envio é recusado; segundo cria conta sem abrir checkout/cartão e exige confirmação de e-mail conforme configuração. |
| AUTH-02 | Navegador sem sessão | Entrar por Google e retornar ao app. | OAuth conclui e a sessão autenticada é encaminhada ao app; registrar idioma e aceite conforme política aplicável. |
| KIT-01 | Conta nova com e-mail confirmado, dispositivo/rede elegíveis e orçamento ativo | Abrir o app e consultar saldo/entitlements. | Uma única concessão de 40 moedas, 2 mapas, 3 formatações e 15 turnos; modal/data de trial coerentes. |
| KIT-02 | Conta sem e-mail confirmado e conta que excedeu limite por dispositivo/sub-rede | Tentar bootstrap. | Nenhum segundo kit é creditado; resposta e UI não simulam concessão bem-sucedida. |
| KIT-03 | Mesma conta com chamadas concorrentes/repetidas | Reivindicar o kit repetidamente. | Uma concessão apenas; saldo e entitlements não duplicam. |
| TRI-01 | Conta criada após a data de lançamento; relógio controlado | Testar antes e depois de 15 dias. | Antes do término, recursos permitidos pelas cotas; após, criação e reservas de IA são negadas sem apagar dados. |
| TRI-02 | Conta elegível com trial ativo e depois vencido | Tentar chamar a extensão antes do vencimento; depois solicitar pelo diálogo e repetir. | Decidir se a chamada antecipada deve ser recusada (a implementação atual aparentemente aceita); a extensão válida só deve elevar o prazo até 20 dias e nunca duplicar. |
| TRI-03 | Conta criada antes de 01/10/2026 | Usar recursos de criação/IA sem assinatura. | A regra de bloqueio de trial não bloqueia essa conta; validar o restante das cotas Free separadamente. |
| TRI-04 | Assinante com `current_period_end` futuro, incluindo status cancelado | Criar conteúdo/usar IA; depois avançar além do fim do período. | Acesso permanece até o período terminar e é bloqueado após expiração, conforme estado live confirmado. |
| MAIL-01 | Perfis elegíveis no dia 9 e no dia 14; assinante e usuário com extensão | Executar hook com segredo autorizado. | Um envio por estágio, sem enviar a assinantes; texto/data correspondem ao trial real. **Falha esperada até corrigir idioma e segmentação do dia 14.** |
| MAIL-02 | Chamada sem segredo, com segredo incorreto e sem `CRON_SECRET` | Executar hook. | Respostas 401/500 apropriadas; nenhum perfil ou destinatário é processado. |
| CARD-01 | Usuário Free em trial ativo com 99 cards próprios | Criar o card 100 e depois tentar o 101, tanto manual quanto por lote. | Card 100 é salvo; o 101 é recusado pelo servidor e pelo fluxo visual, sem moeda debitada nem card parcial. |
| CARD-02 | Free com cards de origem oficial e cards próprios | Verificar o contador e criar novo card. | Cards oficiais (`source_id` preenchido) não consomem o teto de 100; próprios contam. |
| CARD-03 | Trial expirado com espaço abaixo de 100 cards | Tentar criar card, nota, tópico, matéria e usar IA; depois revisar card existente. | Inserções/reservas são recusadas; leitura e revisão continuam. Não inferir que todas as operações de edição estejam bloqueadas. |
| CARD-04 | Requisição de salvamento com tópico de outro usuário, nota alheia ou payload inválido | Chamar o salvamento autenticado. | Servidor rejeita a operação e não insere cards nem cobra moedas. |
| CARD-05 | Salvar mesma ação duas vezes com o mesmo payload e depois com payload diferente | Repetir a mesma chamada. | Mesma ação/payload retorna recibo idempotente sem débito duplicado; payload diferente é rejeitado. |
| AI-01 | Usuário Free em trial, orçamento ativo | Consumir 5 jobs misturando geração, mapa e formatação no mesmo dia UTC; pedir o sexto. | O sexto job falha no limite combinado diário. Chat não deve ser contabilizado nesse mesmo contador. |
| AI-02 | Usuário em trial com cota inclusa de mapa/formatação/chat esgotada e moedas suficientes | Fazer uma operação de cada tipo. | Cobrança configurada de 7/4/2 moedas respectivamente, sem duplicidade; a operação só conclui quando liquidada. |
| AI-03 | Usuário em trial com cota esgotada e saldo insuficiente | Tentar a operação com moedas. | Nenhum débito/saldo negativo; diálogo de saldo insuficiente aparece e aponta à loja. |
| AI-04 | Usuário com trial expirado e saldo positivo | Tentar chat, geração, mapa e formatação. | Todos são bloqueados antes do provedor e da cobrança; saldo permanece inalterado. |
| AI-05 | Pro com período válido | Consumir cotas de cards gerados, mapas, formatação, chat e TTS até o limite e ultrapassá-lo. | Limites por ciclo/caracteres correspondem à tabela; fallback de moedas ocorre apenas onde implementado e exibido. |
| BULK-01 | Fixtures de PDF/imagem/texto nos limites Free e Pro | Enviar logo abaixo, no limite e acima do limite de tamanho/páginas/quantidade. | Casos válidos são processados; acima do limite é recusado antes da chamada ao provedor e sem cobrança. |
| BULK-02 | Geração que retorna menos cards do que o solicitado | Salvar apenas parte dos outputs. | Moedas cobradas apenas por cards efetivamente salvos; outputs não salvos permanecem recuperáveis conforme o job. |
| BULK-03 | Dois cliques/retry na mesma ação e interrupção de rede após resposta do provedor | Repetir ou retomar o job. | Não ocorre dupla cobrança; reservas incertas são reconciliadas/quarentenadas sem sucesso falso. |
| BULK-04 | CSV válido, CSV malformado e arquivo XLSX | Importar no módulo de criação em lote. | CSV segue o parser e validação do produto; XLSX só deve ser anunciado como importável se houver suporte confirmado na UI e no parser. |
| NOTE-01 | Nota Free e Pro acima/abaixo de seus limites | Formatar texto de vários chunks; interromper no meio e retomar/falhar. | Limites 15k/60k e 6k por parte são aplicados; uma sessão consome uma unidade; cobrança/reserva é liquidada ou reconciliada. |
| STUDY-01 | Cards plain, MCQ, cloze e ImagePilot com progresso anterior | Revisar e avaliar com cada nota disponível. | Formato é renderizado corretamente e estado SM-2 (`ease_factor`, intervalo, repetições, vencimento) persiste após atualização e nova sessão. |
| LANG-01 | Conta com cada idioma listado na interface e cada idioma do tutor | Alternar idioma, gerar frase, gravar e solicitar voz. | Idioma de interface/conteúdo é tratado conforme lista suportada; confirmar explicitamente se `pt-PT` deve existir no tutor. |
| LANG-02 | Frase com acentos, pontuação, palavras extras e omissões | Usar “Repita depois de mim”. | Transcrição é comparada por tokens e score é coerente; não apresentar como avaliação fonética. Verificar comportamento do histórico acima de dez frases. |
| TTS-01 | Mesmo texto/voz/idioma solicitado duas vezes; depois texto alterado | Reproduzir a fala em nuvem. | Primeiro pedido gera/cacheia; repetição é cache hit sem nova unidade de geração; conteúdo diferente gera nova entrada. |
| STT-01 | Conta sem assinatura, inclusive após fim do trial | Usar ditado até 60 vezes no mês e tentar a chamada seguinte. | O caminho atual concede até 60 transcrições Free/mês sem verificar trial; a chamada excedente é recusada. Confirmar que essa exceção é intencional e está descrita ao usuário. |
| PRAZO-01 | Cards jurídicos positivos, negativos, duplicados e oficiais | Executar varredura, classificar e copiar para tópico do usuário. | Filtro/classificador aprovam apenas itens pertinentes, duplicados são ignorados e a origem oficial segue a política aprovada de cópia. |
| STORE-01 | Credenciais sandbox e live isoladas; compras de produto e plano | Concluir compra e aguardar webhook/sincronização. | Compra só libera o produto do mesmo ambiente; repetição de evento não duplica saldo/acesso; UI mostra estado pendente até confirmação. |
| STORE-02 | Produto de matéria com validade configurada e acesso vigente | Comprar/renovar antes e depois da expiração. | Acesso usa `validity_days`; renovação nunca reduz a data vigente; não anunciar acesso permanente se o produto expira. |
| STORE-03 | Compra de moedas e avanço de 12 meses | Consultar saldo e ledger antes/depois. | Caso precisa definir o requisito: **o código atual não fornece evidência de expiração automática das moedas**. Não aprovar a promessa de expiração até haver teste automatizado no backend. |
| STORE-04 | Transação Paddle com reembolso parcial e total | Executar reconciliação em sandbox. | Acesso/moedas são ajustados segundo política de reembolso e sem efeitos em live; saldo negativo/debt e estornos ficam auditáveis. |
| ACCOUNT-01 | Conta de teste com cards, notas, histórico, imagens, mapas, TTS e compras | Excluir com confirmação inválida e depois confirmação válida. | Confirmação inválida não exclui; confirmação válida remove identidade e dados em cascata, limpa arquivos pessoais e mantém apenas arquivo fiscal divulgado. Testar explicitamente `tts-cache` e falhas de Storage. |
| ACCOUNT-02 | Conta com compra arquivável | Excluir e consultar apenas por operador autorizado. | Arquivo fiscal contém somente os dados legalmente necessários, incluindo retenção de e-mail/ID documentada e protegida. |
| OFFICIAL-01 | Conteúdo comprado e conteúdo do usuário | Tentar editar/excluir conteúdo oficial; tentar varredura/cópia. | Edição/exclusão respeita o bloqueio; cópia segue decisão explícita de produto e não contradiz termos. |
| UI-01 | Campos editáveis e conteúdo de estudo em desktop/mobile | Copiar, recortar, colar, abrir menu de contexto e arrastar. | Proteção do shell só afeta conteúdo não editável; colagem nos campos funciona; documentar que isso não impede captura/extração técnica. |
| UI-02 | Android/iOS em retrato e paisagem; navegador instalado e não instalado | Navegar, revisar, abrir diálogo e exportar apostila. | Sem corte/overflow e fluxo funcional em ambas as orientações; instalar/offline só deve ser anunciado se validado no ambiente de produção. |
| EXTRA-01 | Caderno com vários escopos e modos de ordenação | Adicionar/remover escopos, estudar e reabrir o caderno. | Apenas cards no escopo são apresentados e a ordenação selecionada persiste. |
| EXTRA-02 | Histórico de avaliações e dados de revisão | Fazer avaliações variadas e consultar dashboard/relatórios. | Totais, precisão, vencimentos e histórico correspondem aos eventos gravados. |
| EXTRA-03 | Conta com Telegram vinculado e conta sem vínculo | Ativar/desativar lembretes e executar o hook autorizado/não autorizado. | Só envia lembretes para usuários elegíveis; segredo é exigido e preferência de desligamento é respeitada. |

## Referências principais no código

- Autenticação/termos: `src/routes/auth.tsx`; idiomas: `src/lib/i18n.tsx`, `src/lib/i18n-locales.ts`, `src/lib/languages.ts`.
- Kit: `src/components/WelcomeKitBootstrap.tsx`, `src/components/WelcomeModal.tsx`, `src/lib/welcome-kit.functions.ts`, migration `20260929010000_secure_ai_entitlements_core.sql`.
- Trial: `src/components/TrialEndedDialog.tsx`, `src/lib/trial.functions.ts`, migration `20261003160000_trial_regression_fixes.sql`, migration `20261002014333_9145f095-dede-4992-b923-505c48f676d2.sql`.
- E-mails: `src/routes/api/public/hooks/trial-nudge-daily.ts`, `.github/workflows/trial-nudge-daily.yml`, `src/lib/email-templates/trial-day9.tsx`, `src/lib/email-templates/trial-day14.tsx`.
- Cotas/cobrança: `src/lib/ai-quota.server.ts`, `src/lib/ai-credits.ts`, `src/lib/ai-credits.server.ts`, `src/lib/notes-format.functions.ts`, migrations `20260929010000_secure_ai_entitlements_core.sql` e `20261001110000_ai_feature_flashcoin_billing.sql`.
- Salvamento/limites: `src/lib/flashcards-save.functions.ts`, `src/lib/plan-limit.tsx`, migration `20261004161658_4413d3d4-968e-4e2d-aba4-6df607eb1e44.sql`.
- Arquivos: `src/lib/parse-cards-file.functions.ts`, `src/lib/parse-cards-image.functions.ts`, `src/lib/ai-input-limits.server.ts`, `src/routes/_authenticated/bulk.tsx`.
- Estudo/idiomas: `src/lib/sm2.ts`, `src/lib/flashcards.functions.ts`, `src/components/FlipCard.tsx`, `src/components/RepeatAfterMe.tsx`, `src/lib/repeat-compare.ts`, `src/lib/tts-cache.functions.ts`.
- Prazos: `src/lib/prazos-scan.functions.ts`, `src/lib/prazos-scan.server.ts`.
- Loja/conta: `src/lib/store.functions.ts`, `src/lib/store-fulfillment.server.ts`, `src/routes/api/public/payments/webhook.ts`, `src/lib/paddle.ts`, `src/lib/paddle.server.ts`, `src/lib/billing.functions.ts`, `src/lib/account.functions.ts`.
- Conteúdo legal e oficial: `src/lib/i18n-extra.ts`, `src/lib/official-content.functions.ts`.
- Recursos complementares: `src/lib/notebooks.functions.ts`, `src/routes/_authenticated/reports.tsx`, `src/components/EvolutionChart.tsx`, `src/lib/telegram.functions.ts`, `src/routes/api/public/hooks/telegram-daily.ts`.

`SECURITY-AUDIT.md` permanece como documento separado e não foi alterado por esta revisão.
