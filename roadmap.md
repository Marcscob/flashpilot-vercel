# Roadmap

## Ordem da fonte na lista de flashcards — 25/11/2026
- [x] Lista e exportações usam a hierarquia da fonte; oito testes aprovados, compilação OK e lista autenticada da LGPD começa em Disposições Preliminares, art. 1º, com 82 cards preservados.
- Inspeção de código: estudo e e-book priorizam índices; mapa pós-save mantém a ordem recebida; microcontextos leem cards por índice/data e Bulk grava índices. Seletores de assuntos priorizam índices. Consultas auxiliares de cards na matéria e de respostas vazias na revisão ainda usam pergunta; não alteradas nesta correção da lista. Novo lote completo permanece pendente conforme pausa anterior.

## Ordem da fonte na revisão — 25/11/2026 (até 5 créditos; pausar em blocos de dois)
- [x] Substituir ordem alfabética por índices da hierarquia da fonte e manter embaralhamento opcional (segundo clique restaura a fonte).
- [x] Gravar índices sequenciais nos novos assuntos/tópicos automáticos do Bulk v2, preservando índices existentes.
- [x] Corrigir os oito índices da LGPD; três cards do art. 6º e seu bloco estavam indevidamente classificados como ANPD e voltaram às Disposições Preliminares. Textos intactos, 82 cards preservados. Cinco testes novos e dois de fonte aprovados; revisão autenticada abre art. 1º, botão A–Z ausente, embaralhar/restaurar funcionando, compilação OK.
- [ ] Conferir criação/salvamento de novo lote com destinos múltiplos pela tela; pausado preventivamente pelo limite de gastos, sem geração paga nesta etapa.

## Ordem e destino na batelada — 23/11/2026 (até 5 créditos)
- [x] Estudo ordena por bloco (microcontext) antes do card; batelada grava a sequência original após o último card do assunto. Regimento da Vale já abre pelo bloco 1 (sem alterar dados). Não testado com login.
- [ ] Criação automática de matéria/assunto no Bulk v2 com pergunta ao usuário; pausado pelo limite de créditos.

## Documento inteiro sem divisão manual — 23/11/2026 (até 5 créditos)
- [x] Documento: pedidos de até 8 cards por chamada, saída de 8.192 tokens, preservação da ordem e reserva única de FlashCoins existente.
- [x] Recuperação de objetos completos em respostas truncadas e continuações menores; 32 testes aprovados. PDF real: 42 cards em seis chamadas, 15,1 segundos, nenhum truncamento.
- [ ] Conferir upload/geração/cobrança pela tela autenticada; pausado pelo limite solicitado de cinco créditos. Validação real acima exercitou o provedor e o fracionamento, não o salvamento/cobrança na tela.
- [ ] Aplicar recuperação também à importação de pares de texto prontos em parse-cards.functions.ts; pausado pelo limite solicitado. O documento PDF/TXT/DOCX com geração em parse-cards-file.functions.ts foi corrigido.

## Edição completa do PilotE-book — 22/11/2026
- [x] Editar títulos, textos de todos os microcontextos, perguntas e gabaritos; salvar nas fontes existentes e preservar conteúdo oficial somente leitura.
- [x] Login: título, microcontexto de subtópico, pergunta e gabarito salvos e reabertos em livro temporário, removido ao fim; EPUB atualizado com gabarito somente ao final e indentação preservada, tela 712px sem transbordamento. Testes e compilação aprovados.

## Editor do PilotE-book — 22/11/2026
- [x] Título visível da página e leitor de voz existente, sob demanda, com carregamento e interrupção.
- [x] Seis testes aprovados, compilação OK; editor de Python conferido com login em 1280px e 712px, sem transbordamento ou erros. Leitor mostrou carregamento, áudio real avançou e o segundo clique interrompeu a reprodução; reutiliza o acervo existente.

## Fidelidade dos exemplos de programação — 22/11/2026 (limite de 3 créditos)
- [x] Compartilhar regras de linguagem-alvo, sintaxe válida, indentação e correção de exemplos híbridos entre cards, microcontexts, notas e roteiros de vídeo.
- [x] 13 testes aprovados: referência Python executa e retorna 8, sintaxe híbrida falha e todos os prompts reutilizam a regra; compilação OK. Sem geração paga ou validação de novos resultados no app; exemplos existentes não foram regenerados.

## Automatic quantity monitoring — 21/11/2026
- [x] Clamp automatic free-plan requests to 40 cards per job.
- [x] Check the full automatic run estimate and show balance/confirmation dialogs before generating cards, including web subpages.
- [x] Eleven regression tests passed; signed-in document flow showed insufficient balance and 20-card confirmation, with cancellation returning to capture. No paid generation performed; free-plan cap verified by regression tests.

## Microcontextos — bloco limitado de 18/11/2026
- [x] Mostrar Mapa do Conteúdo após salvar no Bulk v2, com totais e início do estudo por assunto; lista microcontextos já existentes, sem gerá-los.
- [x] Conferido com sessão autenticada: card manual salvo, mapa aberto e card lido no estudo; dados temporários removidos. Cinco testes aprovados e compilação OK. Pausado por limite de gastos.
- [x] Botão de recapitulação (Card 0) no estudo abre o texto do bloco do card atual; não testado com login.
- [x] Botão "Organizar em blocos" no Mapa do Conteúdo, sob demanda; não testado com geração real.
- [x] Estudo mostra o número do bloco e avisa ao entrar em novo bloco; não testado com login.
- [x] Botão Ouvir na recapitulação (leitor existente, sob demanda); não testado com login.
- [x] Anotações do bloco (Card 0) com salvar/recarregar; não testado com login.
- [x] Indicador "bloco X de Y" no estudo; não testado com login.
- [x] Botões "Criar mapa mental" e "Criar microvídeo" no Card 0: mapa usa a fonte de texto do diálogo existente; microvídeo ligado ao bloco via card_videos.microcontext_id (migração 0031), com listagem e reprodução no próprio painel. 382 testes aprovados, tipagem limpa; não testado com login nem geração real.
- Próximo bloco, sujeito a autorização: integração da landing e verificação autenticada dos botões do Card 0.

## Monitoramento — 12/11/2026
- [x] Chave Gemini atual aceita: síntese no mesmo endpoint/modelo retornou HTTP 200 com áudio; alerta antigo, sem substituição de segredo.
- [x] Conclusão de anexos exige zero falhas; três testes de regressão preservam a elegibilidade à tentativa limitada existente. Fluxo de retorno real por e-mail não exercitado nesta verificação.
- [x] Quatro chaves de boas-vindas restauradas; modal real conferido isoladamente em inglês, sem alteração da conta. 18 testes aprovados e compilação OK; ainda não publicado.

## Landing sem fricção — 04/11/2026 (pausar a cada 2 créditos)
- [x] Bloco 1: decisões confirmadas e registradas.
- [x] Bloco 2: estrutura no banco (visitantes, cards gerados e limites diários por e-mail e total global).
- [x] Bloco 3: fluxo de geração — visitante usa a captura diretamente; o pedido de nome e e-mail ocorre somente antes de liberar a visualização dos cards gerados; aviso por e-mail a contact@flashpilot.net.
- [x] Bloco 4: nova página enxuta (título, uma linha, captura direta, etapa de identificação antes do resultado, div de cards com flip e setas, link "Já tem uma conta? Entrar").
- [ ] Bloco 5: notas/mapas/vídeos até 3 de cada, depois convite ao Pro; testes e verificação.

## Anotações e mapas pelo PilotAI — 31/10/2026
- [x] Homepage pública oferece entrada segura; Home autenticada e Bulk v2 reutilizam criação de notas e mapas com título sugerido, edição antes de salvar e categorias espelho.
- [x] Nota e mapa gerados, editados e salvos com login; texto/título/árvore e categoria conferidos no acervo. Registros temporários removidos. Bulk v2 conferido com CSV gratuito e vídeos apenas por links; nenhum áudio/vídeo gerado. Cinco testes locais aprovados, compilação OK. Ainda não publicado.

## Sequência dos cards na fonte — 31/10/2026
- [x] Ajustar os prompts compartilhados para manter a ordem da fonte, inclusive artigos e subdivisões, em texto, áudio, imagens e demais capturas; formatos mistos não podem reagrupar trechos.
- [x] Cobertura conferida nos prompts de texto, documento e imagem; áudio/YouTube reutilizam o caminho textual. Dois testes locais aprovados e compilação OK, sem chamadas pagas. Cards já criados não foram reordenados; resultado de nova geração não testado para evitar gasto.

## Acervo de narração em todo o app — 30/10/2026
- [x] Implementar reutilização das respostas, persistência privada e memória limitada; antecipação das últimas 3 respostas somente com áudio já salvo, sem comprar síntese.
- [x] Conferência local na pausa: 22 testes de áudio aprovados, 0 falhas; nenhum teste de navegador em execução.
- [ ] Confirmar primeira narração, repetição e recarga em conversa gravada com login. PAUSADO por solicitação de Marcelo até retorno dos créditos; não iniciar testes pagos nem retomar automaticamente.
- Ponto de retomada e limites da verificação: `.lovable/tts-retomada-2026-10-30.md`. Implementação preservada na prévia, não publicada.

## Áudio de Repita depois de mim — 30/10/2026
- [x] Reutilizar áudio entre primeira leitura e botão Ouvir, com persistência privada no dispositivo.
- [x] Manter três próximas frases com áudio em fila sequencial, preservando idioma, cotas e prioridade manual.
- [x] Com login: 4 áudios guardados (atual + 3), Repetir e Ouvir tocaram local sem chamada ao servidor, Próxima frase instantânea. 4 testes novos aprovados. Ainda não publicado.

## Layout dos cartões da Tela Início — 30/10/2026
- [x] Ícone grande dentro de círculo grande, título grande em negrito, tudo dentro do cartão com borda arredondada; entrada animada em cascata e elevação ao passar o mouse.
- [x] Medido com login: círculo 192 px com ícone 96 px no computador e 160 px com 64 px no celular; título 30 px e 24 px. Quatro cartões em grade 2×2 sem corte nem sobreposição. Hover elevou 4 px e escalou 1,015; entrada em 0/90/180/270 ms terminando em opacidade 1. Compilação OK. Ainda não publicado.


## Piscada do aviso da primeira reprodução — 30/10/2026
- [x] O aviso "Reproduza o vídeo até o fim..." pisca 5 vezes e depois fica como texto de leitura comum; continua visível enquanto a narração é preparada.
- [x] Teste autenticado no vídeo salvo do card: 5 piscadas medidas (opacidade cai a 0,08 e volta a 1), texto estabiliza em opacidade 1 e some quando a narração fica pronta. 6 testes de vídeo aprovados, compilação OK. Ainda não publicado.



## Aviso da primeira reprodução do vídeo — 30/10/2026
- [x] Enquanto a narração é preparada (spinning), mostrar aviso amigável nos 7 idiomas: reproduzir até o fim para registrar no flashcard; próxima reprodução instantânea.
- [x] Três testes aprovados e compilação OK. Teste autenticado: aviso surgiu 0,7 s após o play e sumiu quando a narração ficou pronta (vídeo avançando, 3s/31s). Ainda não publicado.

## Vídeos e narração persistentes — 30/10/2026
- [x] Reutilizar vídeo e áudio salvos por card sem nova síntese a cada reprodução, preservando voz e leitura bilíngue.
- [x] Compartilhar vídeos do AppManager em cards oficiais somente com alunos com acesso; manter materiais particulares privados e restringir alterações à anotação do próprio vídeo.
- [x] Vídeo existente reproduzido com som; áudio persistido no Cloud e no navegador. Após recarga, reprodução em 0,45 s sem aviso; sete testes aprovados e compilação OK. Nenhum novo vídeo criado. Ainda não publicado.
- [ ] Confirmar visibilidade por segunda conta de aluno com acesso oficial; depende de conta apropriada autorizada para esse teste.

## Som automático da FlashPilot-TV — 30/10/2026
- [x] Play do vídeo libera e inicia a narração sem clique prévio no leitor; erro de chave inválida corrigido. Teste autenticado: áudio de 34,85 s tocando aos 19,8 s, vídeo avançando e sem avisos. Ainda não publicado.

## Salvar e publicar artigos com traduções antigas — 30/10/2026
- [x] Aceitar idiomas regionais já armazenados sem ampliar os alvos de tradução nem descartar conteúdo antigo ao regenerar.
- [x] 107 testes aprovados e compilação OK; rascunho temporário criado, salvo, reaberto e publicado pelo editor autenticado, preservando 88 traduções (incluindo es-MX/es-HN/en-AU). Teste removido, artigos originais intactos; ainda não publicado no domínio.

## Pré-carregamento inteligente do leitor — 30/10/2026
- [x] Fila única sequencial com prioridade manual após a síntese ativa, janela atual + dois cards, cache IndexedDB privado por conta/texto/voz e versão, preservando Gemini e cotas; falhas interrompem a janela sem repetição automática.
- [x] Treze testes aprovados; deck autenticado armazenou seis áudios (frente/verso de três cards), recarga preservou os blobs e clique reproduziu WAV local de 20,25 s sem chamadas ao servidor. Compilação OK; nenhum card/progresso alterado. Ainda não publicado.

## Leitura literal de lacunas e respostas — 30/10/2026
- [x] Preservar início e resposta curta, converter lacuna em blank sem resolver, delimitar texto lido e retirar exemplos contaminantes das instruções; cache renovado.
- [x] Oito testes e compilação aprovados; leitor autenticado gerou e reproduziu os dois textos relatados, áudios disponibilizados sem alterar cards/progresso.
- [ ] Confirmar por audição que o Gemini não omite/inventa palavras; depende da avaliação de Marcelo dos dois áudios. Ainda não publicado.

## Correção de pronúncia e leituras simultâneas — 30/10/2026
- [x] Reproduzir o erro da imagem: dois disparos simultâneos causam conflito na trava da conta; idioma da matéria chega ao leitor mesmo quando a frase está em português.
- [x] Sínteses serializadas, disparos idênticos compartilhados e pedidos antigos ignorados; idioma inferido pela frase, instruções por trecho e cache renovado. Reprodução autenticada repetiu os dois disparos sem conflito; seis testes e compilação aprovados.
- [ ] Confirmar pronúncia por audição do novo áudio do card da imagem; depende da avaliação de Marcelo. Não publicado; teste local não confirma a versão no domínio público.

## Leitor Gemini em chamada única — 30/10/2026
- [x] Substituir segmentação por uma síntese do texto inteiro com voz feminina Kore no Gemini aprovado; preservar reprodução, carregamento, cotas e cache com nova versão.
- [x] Treze testes aprovados e compilação OK; em /study com login, loader visível, reprodução real de 20,21 s em um áudio e repetição do mesmo arquivo salvo confirmadas. Nenhum card ou progresso alterado. Ainda não publicado.

## Convite de instalação mobile — 30/10/2026
- [x] Convite na landing/login com dispensa por dispositivo, instruções Safari, evento Android e bloqueio em standalone; manifesto e ícones existentes preservados, sem cache offline.
- [x] Oito testes aprovados; Safari simulado com passos/dispensa/navegação/reload, Android com eventos simulados e confirmação somente após appinstalled, standalone sem convite nas duas páginas; sem erros no navegador, compilação OK. Instalação real ainda depende de aparelho publicado.
- [ ] Conferir instalação nativa após publicação em Android/iPhone; depende de publicação e aparelho.

## Nova marca — 30/10/2026
- [x] Aplicar grafite quase preto e dimensão uniforme de 64 px no componente compartilhado; cabeçalho compacto em todas as telas autenticadas e na landing.
- [x] Aplicar logo enviada com base clara de contraste no componente compartilhado e no endereço usado por e-mails/PDFs; ícone F com base escura e contorno claro nos atalhos e favicon.
- [x] Contraste claro/escuro e nova logo na página inicial/login conferidos; três ícones do manifesto disponíveis, compilação OK.
- [ ] Conferir atualização do atalho em aparelho instalado após publicação; depende de publicação e aparelho.

## Captura direta no Bulk v2 — 29/10/2026
- [x] Reproduzir os controles da landing: arquivos e planilhas abrem o seletor diretamente; fotos usam uma área única para upload/câmera/colagem/arrastar; narração, traduções e processamento preservados.
- [x] Com login: filtros do seletor de documentos/áudio/planilha conferidos; upload/colagem/arrastar imagens, remoção, troca de fonte e gravação direta aprovados; CSV com dois cards importado sem salvar. Tela larga e estreita sem transbordamento nem erros de navegador; 19 testes existentes aprovados e compilação OK. Nenhuma geração paga ou alteração em dados salvos.

## Google Cloud Text-to-Speech — 28/10/2026
- [x] Integrar GOOGLE_TTS_API_KEY com vozes Standard/Neural2 e SSML por idioma, preservando limites e cache privado; catálogo real consultado, WAV mantém validação de duração. Idiomas explícitos têm prioridade; detecção local de frases/termos é heurística e não garante todo termo estrangeiro isolado.
- [x] Validar síntese real mono/bilíngue, reutilização do cache e reprodução no app com conta conectada: WAV bilíngue de 3,77 s, segunda chamada em cache, reprodução ativa, player retornou cloud e velocidade 1,25. 23 testes aprovados e compilação OK. Publicação ainda necessária para levar ao domínio público.

## Curadoria de conteúdo da comunidade — 27/10/2026
- [x] Auditoria e redação padronizada de candidatos, preservando originais e o mínimo existente de 3 pessoas distintas; verificação automática não autoriza venda.
- [x] Candidatos e histórico privados, taxonomia matéria/assunto/tópico, decisão humana versionada e confirmação de origem/direitos; pendentes e rejeitados não entram nas matérias da Loja.
- [x] Admin: comparar original, editar, salvar parecer, aprovar/incorporar ou rejeitar; incorporação atômica na taxonomia oficial sem ativar produtos. Texto/taxonomia do card incorporado protegidos contra alterações fora da revisão.
- [x] 30 testes aprovados; com login real, edição salva, confirmação obrigatória, aprovação/incorporação e rejeição persistidas; versão e histórico conferidos no banco, tentativa de alteração não revisada bloqueada, zero produto automático, sem erro de navegador ou transbordamento. Dados sintéticos removidos.
- [ ] Auditar material comunitário real: nenhum card alcança atualmente o mínimo de 3 usuários distintos; requer candidatos elegíveis e comprovação de direitos/autorização antes de uso comercial.

## Fila offline e sincronização em lote de revisões — 27/10/2026
- [x] Backend: coluna revision_version em flashcards e official_card_progress; função sync_flashcard_reviews com controle monotônico (applied/conflict/invalid/not_found/forbidden) validada no banco; função de servidor syncFlashcardReviews; revisão individual também incrementa a versão; 12 testes novos, 81 no total aprovados, compilação OK.
- [ ] Frontend: fila offline de revisões no estudo e envio em lote ao reconectar (fase seguinte).

## Planilhas modelo traduzidas — 26/10/2026
- [x] Criar sete planilhas XLSX com cabeçalhos e três exemplos traduzidos (pt, pt-PT, en, es, fr, it, de); conteúdo e apresentação conferidos em todas.
- [x] Selecionar pelo idioma atual nos dois downloads do Bulk v2; sete downloads conferidos com login e exemplo italiano reimportado com três cards, sem importar o cabeçalho. 16 testes aprovados e compilação sem erros.

## Vincular Pro 2 e separar assinantes — 24/10/2026
- [x] Resolver os IDs reais informados no checkout e nos eventos verificados de pagamentos, mantendo teste e real separados; ambos resolvidos via chamada autenticada, sem efetuar cobrança.
- [x] Reconhecer pro_2 com cotas existentes de 2.200 cards (confirmadas nas funções do banco) e listar Pro/Pro 2 separadamente no Admin, com contagens de teste e real.
- [x] Sincronizar preços exibidos Pro 2 com US$ 11,99/mês e US$ 79,90/ano, conforme escolha de Marcelo; 51 testes aprovados, painel e preços conferidos com login, compilação aprovada e aviso sem assinatura rejeitado com HTTP 400.
- [ ] Validar compra Pro 2 ponta a ponta: IDs existem somente no ambiente real; não realizar cobrança real para teste. Depende de compra autorizada ou catálogo Pro 2 de teste.

## Planos e Loja — Pro 2 — 24/10/2026
- [x] Exibir quatro opções Pro/Pro 2 com preços, cotas, FlashCoins e plano ativo nas duas telas.
- [x] Acrescentar informações de matérias e FlashCoins e sincronizar os sete idiomas.
- [x] 47 testes aprovados; telas e ícones informativos verificados com sessão autenticada, sem erros no navegador nem transbordamento móvel; compilação e tipagem automáticas aprovadas.
- [x] IDs Pro 2 reais fornecidos em 24/10 vinculados no checkout; sem import_meta, reconhecimento por mapeamento seguro. Validação de compra completa registrada na seção acima.

## SEO e integridade de slugs — 24/10/2026
- [x] Normalizar e validar slugs no admin e no servidor, com fallback seguro no formulário.
- [x] Excluir slugs inválidos do sitemap e explicitar rastreadores preservando restrições privadas.
- [x] Oito testes específicos e 39 testes totais aprovados; formulário autenticado conferido sem salvar posts; índice e todos os sitemaps retornam XML válido, sem /blog/%20; compilação aprovada.

## Senha no retorno — 19/10/2026
- [x] Oferecer criação de senha à conta autenticada sem senha na tela atual, sem pedir e-mail; revalidar conta e senha antes de salvar. Sete idiomas nativos e fallback inglês nos adicionais.
- [x] Oito testes aprovados; conta conectada com senha não recebe oferta, visitante não pode consultar status, navegação permanece em uma aba e sem transbordamento no celular; compilação aprovada. PWA existente preservado, sem mudar manifesto; abertura de links pelo e-mail depende do sistema operacional.
- [ ] Validar criação real de primeira senha e retorno pelo e-mail no PWA instalado: conta de teste disponível já tem senha; não alterar a senha existente. Requer conta elegível e aparelho instalado para concluir.

## Correção de saldo — 19/10/2026
- [x] Impedir retomada automática de captura antiga na entrada de contas conectadas; retomar somente no retorno explícito por e-mail, mantendo a raiz pública para visitantes.
- [x] Conferir saldo, reservas e descontos da conta indicada na captura: saldo registrado 40, 18 cards salvos sem outputs gerados vinculados, nenhum débito; outro processamento tem reserva de 9 moedas ainda não salvas.
- [x] Alinhar ImagePilot da landing a 10 outputs, preservar erro real de reserva em vez de acusar falta de saldo, atualizar caches após salvar e recarregar Minha conta ao abrir. Doze testes aprovados; Minha conta autenticada abre sem erro de localidade; compilação aprovada.
- [ ] Confirmar origem dos 18 cards com o usuário (planilha/manual ou PilotAI) antes de qualquer ajuste retroativo; dados atuais não comprovam geração paga desses cards.
- [ ] Verificar geração ImagePilot e cobrança ponta a ponta na conta afetada; sessão disponível é do AppManager, sem cobrança, e não há material de teste autorizado para essa conta.

## Unificação das fontes — Bulk v2
- [x] Organizar captura em quatro grupos com seletores e traduções nos idiomas nativos e adicionais; seletores testados isoladamente no navegador, grade móvel 2x2 e desktop em quatro colunas sem transbordamento.
- [ ] Verificar a tela após login; Lovable Cloud indisponível impede obter sessão nesta tentativa.

## Correção — Documentos no Bulk v2
- [x] Conectar PDF/DOCX/TXT ao processamento existente e verificar a leitura dos três formatos no navegador; compilação aprovada.
- [ ] Verificar geração autenticada; acesso ao Lovable Cloud indisponível nesta tentativa.

## Nova Home — 17/10/2026
- [x] Criar Home com quatro caminhos e manter a tela de matérias em Revisar Flashcards.
- [x] Preservar cabeçalho/rodapé e traduzir os rótulos nos sete idiomas nativos, com fallback inglês nos adicionais.
- [ ] Verificar navegação autenticada; bloqueada pela indisponibilidade do Lovable Cloud, que impede obter uma sessão de login.

## Boas-vindas — 10/10/2026
- [x] Traduzir a tela e os e-mails de cadastro/boas-vindas nos idiomas disponíveis, preservando variantes regionais e datas locais, sem chamadas de tradução paga.
  - Catálogo compartilhado validado nos 55 idiomas/variantes disponíveis; ambos os e-mails renderizados em todos eles. Conferência visual dos e-mails em chinês, japonês, russo e árabe; compilação limpa.
- [ ] Conferir o modal em conta elegível e a entrega real após publicação e novo cadastro. A conta autenticada usada na verificação não exibe mais o modal; nenhuma preferência da conta foi alterada.

## Prioridades solicitadas — 09/10/2026
- [x] 1. Corrigir fechamento do seletor no celular e espera de tradução na lista do blog.
- [x] 2. Disponibilizar geração por link do YouTube na Criação em Batelada e na landing page, preservando cobrança e vínculo do vídeo.
  - Validado com vídeo público: extração, geração, recuperação, salvamento e leitura de três cards no assunto, com link persistido; campo da landing conferido. Cadastro por e-mail da landing não retestado.
- [ ] 3. Completar traduções pendentes dos idiomas adicionais, preservando traduções existentes.
  - Bloqueada: serviço de tradução retornou HTTP 402 por saldo insuficiente; não repetir chamadas até regularização.
- Reservar margem para correções; não prometer quantidade fixa de créditos por tarefa.

## Em andamento — Landing page funcional e acabamento da Home
- [x] Aplicar nos cards de matérias o friso prateado em fade no topo e na lateral direita.
- [x] Substituir a demonstração fictícia de `/bulkdemo` por geração real de flashcards com PilotAI.
- [x] Conduzir usuário novo ou existente com autenticação segura, sem revelar dados da conta.
- [x] Salvar os cards gerados em Matéria Demo / Assunto Demo e abrir a Home.
- [x] Validar compilação, TypeScript e lint dos arquivos alterados; a validação manual autenticada no navegador permanece pendente.

## Concluído — Domínio flashpilot.net + infraestrutura de e-mail
- [x] Comprar flashpilot.net pelo Lovable
- [x] Adicionar www.flashpilot.net
- [x] Definir flashpilot.net como primário
- [x] Configurar domínio de e-mail (sender `notify.flashpilot.net`, from `noreply@flashpilot.net`)
- [x] Instalar infraestrutura de e-mail (`@lovable.dev/email-js`, `@lovable.dev/webhooks-js`, `@react-email/components`, `@react-email/render`) + rotas `/lovable/email/*`
- [x] Modelos de auth com a marca (signup, recovery, reauthentication, magic-link, invite, email-change) + `auth-email-hook` publicado em `/lovable/email/auth/webhook`
- [x] Modelos transacionais do app (welcome, trial-ended)
- [x] og:url/canonical/hreflang do blog ajustados para flashpilot.net
- [ ] Verificação final manual (enviar e-mail de teste de cada template e confirmar entrega)

## Pendências anteriores
- [x] Verificar no navegador o bloqueio de cópia dos posts (src/routes/blog/$slug.tsx) — confirmado: seleção, cópia e menu de contexto bloqueados corretamente.

## Opcional (você decide)
- [ ] Caixa de entrada contact@flashpilot.net (provedor de hospedagem de e-mail)

## Concluído — Trial de 15 dias + presente de +5 dias
- [x] Trial de 15 dias com tela de conclusão em duas etapas (assinar Pro ou "preciso pensar um pouco" revelando +5 dias de presente).
  - Bloqueio em duas camadas: triggers no banco (flashcards/notes/subjects/topics) + checagem nas RPCs de IA (`reserve_ai_quota_included_only`, `reserve_ai_generated_flashcard_billing`), e diálogo proativo no frontend (`TrialEndedDialog`).
  - Leitura de conteúdo já criado nunca é bloqueada, só a criação de conteúdo novo.
  - Assinantes (em qualquer ambiente, mesmo quem assinou durante o próprio trial) nunca são bloqueados.
  - Contas criadas antes do lançamento do trial (2026-10-01) são isentas da contagem de dias (grandfathered) — corrigido bug que bloqueava contas antigas desde o primeiro acesso após o deploy.
  - Diálogo de fim de trial pode ser fechado normalmente (X, Escape, clique fora) — corrigido bug que travava o app inteiro.
  - E-mail de fim de trial (`trial-ended`) disparado uma única vez quando o status vira bloqueado — **texto/layout ainda provisórios**, a definir.

## Concluído (código) — E-mails de régua e boas-vindas ao assinante
- [x] E-mail do dia 9 (reengajamento) e dia 14 (aviso de encerramento, CTA para a Loja): rota de cron `/api/public/hooks/trial-nudge-daily` (autenticada via `CRON_SECRET`), calcula a janela de dia calendário em fuso América/São_Paulo a partir de `profiles.created_at`, exclui assinantes ativos e o app manager, envia uma única vez por usuário.
- [x] E-mail de boas-vindas ao assinante: disparado em `handleSubscriptionCreated`/`handleSubscriptionUpdated` no webhook de pagamentos, uma única vez na vida do usuário (idempotente via `profiles.subscriber_welcome_email_sent_at`).
- [ ] Layout visual definitivo dos e-mails (dia 9, dia 14, fim de trial e boas-vindas ao assinante) — textos atuais são provisórios.
- [x] Agendador externo criado: workflow `.github/workflows/trial-nudge-daily.yml` (GitHub Actions) chama `/api/public/hooks/trial-nudge-daily` todo dia às 09:00 (América/São_Paulo). Pendente apenas cadastrar o segredo `CRON_SECRET` no repositório (Settings > Secrets and variables > Actions), com o mesmo valor já usado em produção.


## Histórico — Sessão de 01–03/10/2026 (trial, migrations e cron)
- [x] Corrigidos 2 bugs do trial: diálogo de fim de trial intravável e contas antigas bloqueadas (grandfathering em 2026-10-01).
- [x] Descoberto que as migrations do trial/cobrança FlashCoins estavam só no repositório; Lovable aplicou as 4 no banco real (cobrança, trial gating, marcadores de e-mail, grandfathering) e fechou brecha em 
eserve_ai_quota_included_only_v1 (REVOKE para PUBLIC/anon/authenticated). Validado via API REST + 	sc limpo.
- [x] Criado workflow GitHub Actions diário (09h BRT) para a régua de e-mails do trial.
- [ ] Cadastrar CRON_SECRET nos secrets do GitHub (valor igual ao de produção).
- [ ] Rodar no Preview os 5 cenários críticos de cobrança de FlashCoins.
- [ ] Definir layout definitivo dos e-mails (dia 9, dia 14, fim de trial, boas-vindas).
- Lição: em migrations com RENAME TO + wrapper, sempre incluir REVOKE/GRANT explícito na função renomeada.

## Pendente — SEO Fase 1 (pedido de Marcelo)
- [x] Rotas /$lang/blog/$slug com hreflang só das traduções salvas, canonical por idioma e 301 de /blog/$slug
- [x] Revisar sitemap: excluir rotas privadas e /bulkdemo; preparar sitemap modular

- [x] SEO Fase 2: sitemap.xml como índice → /sitemaps/pages.xml e /sitemaps/blog-<idioma>.xml

## Pendente — SEO Fase 3 (adiada pelo usuário)
- [ ] Gerador gratuito de flashcards público (/$lang/tools/flashcard-generator) com limite por visitante, modo estudo, CTA de cadastro e schemas SoftwareApplication/HowTo

## Nova página pública — 19/10/2026
- [x] Renovar apresentação, quatro fontes, três amostras, ecossistema, planos e FAQ; sete idiomas nativos, sem prova social inventada.
- [x] Raiz pública SSR 200, variantes nativas por ?lang com canonical/hreflang, 301 legado e raiz prioritária no sitemap modular; sessão ativa chega à Home via navegador, mantendo a autenticação existente.
- [x] Verificar amostras, CSV, modelo XLSX, idiomas SSR, desktop/celular, 301 e Home autenticada. Importação salva e lida pela busca na conta; zero débito confirmado, cards de teste removidos. Sete testes de regras aprovados.
- [ ] Verificar geração autenticada com áudio/câmera/PilotAI e confirmação de cadastro por e-mail; pendente material real/entrega de e-mail. Nenhuma geração paga anônima foi habilitada.
- [ ] Redirecionamento HTTP 302 de sessão no servidor: depende de uma migração de sessão para cookies, não realizada para preservar a autenticação atual.

## Texto da tela de login — 23/10/2026
- [x] Substituir a frase longa da tela de login por "Flashcards inteligentes com o PilotAI" nos sete idiomas nativos.
- [x] Escrever a nova frase nos 42 idiomas adicionais (public/i18n) e descartar a chave antiga; conferido no navegador em nl, ja, ar, zh-CN, tr, pl, ko, ru, he e nos sete nativos. Os arquivos de hi, id e fil existem mas esses idiomas não estão na lista do app, então não aparecem na tela.

## Onboarding da landing page — 24/10/2026
- [x] Campo de texto com contador em tempo real (limite 15.000), borda vermelha e envio bloqueado acima do limite.
- [x] Rascunho salvo no backend (tabela landing_drafts: actionId, e-mail normalizado, conteúdo, idioma, TTL 24h) com e-mail de ativação no idioma do usuário (token + actionId).
- [x] Landing congela em confirmação estática com aviso de Spam/Lixo Eletrônico; login detectado na mesma máquina mostra apenas aviso neutro de outra aba.
- [x] Rota /activate: valida token e TTL, e-mail desabilitado, senha com olho e validação ao vivo (mín. 8), checkbox de Termos/Privacidade, botão "Ativar conta e Estudar"; link expirado oferece reenvio.
- [x] Geração em background (matéria/assunto/cards pelo PilotAI) debitando 1 FlashCoin por card das 40 do Kit de Boas-Vindas via save_flashcards_atomically.
- [x] Primeiro acesso obrigatório em /review?actionId: loading "O PilotAI está estruturando seus flashcards...", polling 2.500ms × 24 (60s), fallback com "Tentar gerar novamente" reaproveitando o actionId, sucesso renderiza sem recarregar.
- [x] E-mail já cadastrado: rascunho salvo, mensagem "Vimos que você já tem conta!" com link /auth?actionId; após login o backend valida draft.email === user.email e redireciona para /review; logins sem actionId seguem para /home.
- [x] Verificado no navegador: contador ao vivo, congelamento com aviso de spam, fluxo de usuário existente e /activate com link inválido; build OK e testes de regras passando.
- [ ] Não verificado ponta a ponta: ativação real por e-mail (requer caixa de entrada) e geração completa com débito de FlashCoins em conta real.

## Microfone direto no Bulk v2 — 25/10/2026
- [x] "Narrar no microfone" inicia a gravação ao toque, mostra "Gravando…" no próprio botão e oscila de cor enquanto grava; botão de microfone interno do campo de texto removido.
  - Gravado e transcrito no navegador com microfone simulado: "Gravando…" com a cor alternando entre alerta e cor da marca, retorno a "Narrar no microfone" depois de "Transcrevendo…" e o texto da narração aparecendo no campo; nenhum ícone de microfone dentro do campo. Rótulos dos dois estados nos sete idiomas nativos; 54 testes aprovados, tipagem e compilação limpas.
- [x] Spinner no botão de áudio enquanto o TTS carrega

## Bolinha de materiais ao criar nota, mapa ou microvídeo — 30/10/2026
- [x] Ao ficar pronto um microvídeo, mapa mental ou anotação, a bolinha de contagem dos materiais de estudo pisca em vermelho 8 vezes e volta à cor normal.
  - Medido no preview: animação de 0,35s × 8, vermelha no meio de cada piscada, terminando na cor normal; sem piscar quando o sistema pede "reduzir movimento". 225 testes aprovados.

## Pergunta de volta no encerramento do vídeo — 30/10/2026
- [x] O roteiro do microvídeo passa a trazer a pergunta da face A no encerramento: a última cena fala a pergunta de novo (e a mostra na tela) antes de comentar o gabarito.
  - Regra escrita no prompt do roteiro; 3 testes novos aprovados (228 no total). Vale para vídeos criados daqui para frente; roteiros já salvos não mudam.

## E-book da matéria — 21/11/2026 (bloco de 5 créditos)
- [x] Núcleo: capítulos/subcapítulos numerados (1, 1.1, 1.2), reordenação com renumeração automática, flashcards como exercícios sem resposta. 4 testes aprovados.
- [x] Exportação EPUB 3 compatível com Kindle (nav.xhtml + toc.ncx, quebra de página por capítulo, gabarito ao final com links de ida e volta).
- [ ] Tela do e-book: sumário arrastável, edição de texto, inserção de imagens, salvar ordem.
- [ ] Exportação PDF e botões "Exportar E-book" no card da matéria e na tela de flashcards.
- [ ] Futuro: envio direto ao Kindle.
