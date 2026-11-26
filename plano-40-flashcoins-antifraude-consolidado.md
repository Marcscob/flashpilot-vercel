# Plano Consolidado — Degustação de IA, FlashCoins e Antifraude

**FlashPilot · Especificação funcional e técnica para implementação na branch `dev`**

## 1. Objetivo e princípios

O FlashPilot oferecerá uma degustação de recursos de inteligência artificial a novos usuários elegíveis, sem exigir cartão de crédito ou SMS no cadastro. A segurança financeira e as autorizações serão aplicadas pelo backend; a interface apenas apresenta limites, saldos e progresso.

As regras centrais são:

- Uma FlashCoin paga por um flashcard gerado por IA e efetivamente salvo.
- O usuário gratuito pode manter até 100 flashcards no acervo, somando cards manuais, importados e gerados por IA.
- Cards já salvos continuam disponíveis para revisão e estudo, mesmo quando o saldo ou as cotas de IA acabam.
- A concessão do bônus, o consumo das cotas, a cobrança, os limites de uso e a validação do plano são decididos no servidor.
- Estimativas de custo não substituem o teto financeiro nem a reserva exigida antes de cada chamada.

## 2. Oferta e regras comerciais

Após a validação de elegibilidade, o Kit de Boas-Vindas concede **40 FlashCoins**, **2 mapas mentais**, **3 formatações de anotações** e **15 turnos de conversa com o tutor**. Contas não elegíveis podem ser criadas e usadas para estudo manual, mas não recebem o kit até uma eventual aprovação posterior.

FlashCoins avulsas, incluindo pacotes de 1.000 moedas, servem somente para gerar flashcards. Depois do uso das cotas gratuitas, mapas mentais, formatação de anotações e conversação requerem assinatura Pro.

O plano Pro não debita FlashCoins e não aplica o teto gratuito de 100 cards. Por ciclo individual de cobrança, seus limites de uso justo são:

- 2.500 flashcards gerados por IA;
- 50 mapas mentais;
- 60 formatações de anotações;
- 400 turnos de conversa.

O ciclo segue a assinatura registrada pelo provedor de pagamentos, e não o mês-calendário. O backend determina o período com base no estado e nas datas confirmadas da assinatura; a interface mostra consumo e próxima renovação. O Pro não é afetado pelo orçamento de degustação Free, mas continua sujeito aos limites de uso justo, à proteção contra automação e a indisponibilidades gerais dos provedores.

## 3. Limites de entrada e geração

Todos os limites são verificados no servidor antes de encaminhar conteúdo ao modelo. O plano é obtido da autenticação e dos dados de assinatura confiáveis, nunca de um valor enviado pelo navegador.

### Plano gratuito

- PDF: até 10 páginas e 15 MB por arquivo.
- DOCX ou TXT: até 30.000 caracteres e 15 MB por arquivo.
- Imagens de câmera, upload, arrastar e soltar ou Ctrl+V: até 8 imagens por envio, 5 MB por imagem e 25 MB no total.
- Mapas mentais: até 20.000 caracteres de entrada por geração.
- Formatação de anotações: até 15.000 caracteres por operação.
- Conversa: até 400 caracteres digitados ou 45 segundos de áudio de entrada por turno; áudio sintetizado do tutor limitado a 45 segundos.
- Acervo total: até 100 flashcards.

### Plano Pro

- PDF: até 60 páginas e 50 MB por arquivo.
- DOCX ou TXT: até 150.000 caracteres e 50 MB por arquivo.
- Imagens: até 20 por envio, 10 MB por imagem e 100 MB no total.
- Mapas mentais: até 100.000 caracteres por geração.
- Formatação de anotações: até 60.000 caracteres por operação.
- Conversa: até 2.000 caracteres digitados ou 90 segundos de áudio de entrada por turno; áudio sintetizado do tutor limitado a 90 segundos.
- Acervo sem o teto gratuito de 100 cards, sujeito aos limites de uso justo e aos limites técnicos do produto.

Redimensionar ou comprimir imagens no cliente pode melhorar o envio, mas não é controle de segurança. O servidor verifica novamente quantidade, tamanho, formato e dimensões do conteúdo recebido e calcula o custo com base no conteúdo efetivamente enviado ao provedor.

### Tamanho de trabalhos e blocos

Um trabalho Free de flashcards pode gerar **até 40 cards**, processados em **até quatro blocos de até 10 cards**. Trabalhos menores usam somente os blocos necessários; não há obrigação de criar quatro blocos.

Um trabalho Pro pode gerar até 150 cards, em até 10 blocos de até 15 cards. O limite do ciclo Pro de 2.500 cards continua sendo aplicado independentemente do limite por trabalho.

O limite de saída de cada bloco é no máximo 3.000 tokens. O servidor não solicita mais tokens do que o valor coberto pela reserva orçamentária daquela chamada. O formato e a quantidade de saída devem ser validados antes de oferecer essas capacidades ao usuário.

Para o Free, o número máximo de cards que a interface oferece é o menor entre: quantidade solicitada, saldo de FlashCoins, espaço restante no acervo e limite do trabalho. Para Pro, é o menor entre: quantidade solicitada, saldo do limite do ciclo e limite técnico do trabalho.

## 4. Tentativas, concorrência e idempotência

Usuários Free podem iniciar até **cinco trabalhos de geração de conteúdo por dia**, somando flashcards, mapas mentais e formatação. A contagem reinicia às 00:00 UTC. Um trabalho conta uma vez para essa cota, ainda que contenha vários blocos. Os 15 turnos de conversa são uma cota separada.

Cada bloco pode ter a chamada inicial e até duas novas tentativas automáticas para falhas transitórias. Retries internos não aumentam a contagem de trabalhos diários, mas cada chamada ao provedor exige sua própria reserva de orçamento. Não há repetição ilimitada.

Uma falha antes de a solicitação alcançar o provedor não consome tentativa. Cancelamento, timeout ou falha depois do envio contam como trabalho iniciado, mas não debitam FlashCoins nem cotas de resultado se não houver resultado entregue e salvo conforme a regra daquele recurso.

Cada trabalho recebe um `action_id` idempotente. Repetir a solicitação com o mesmo identificador retorna o estado ou resultado existente e não inicia uma nova chamada. Isso vale para aquisição do processamento, reservas, chamadas, resultados temporários, salvamento de cards e consumo de cotas.

O backend mantém no máximo um processamento ativo por usuário, Free ou Pro. O lock usa `lease_id`, estado persistido e heartbeat. Enquanto estiver ativo, o cliente envia heartbeat a cada 15 segundos; o lease expira após 60 segundos sem renovação. Expiração do lease, por si só, não prova que a chamada ao provedor parou. Se uma chamada antiga ainda puder estar ativa, uma nova chamada para a mesma conta aguarda a confirmação de encerramento ou o hard timeout de 60 segundos.

O cancelamento do usuário usa `AbortController` como tentativa de interromper a chamada. É best-effort: fechar a aba ou perder a conexão pode impedir que o sinal chegue, e o provedor pode cobrar o processamento já realizado. O sistema não informa que o trabalho foi cancelado pelo provedor sem confirmação.

## 5. Orçamento, reservas e circuito de proteção

O custo completo estimado de um Kit de Boas-Vindas é **US$ 0,022**, a confirmar por medições do uso real do gateway e pelas tarifas vigentes. A estimativa é planejamento, não um custo garantido por usuário.

O orçamento da degustação Free tem:

- **teto diário de US$ 0,50**, reiniciado às 00:00 UTC;
- **teto mensal de US$ 15,00**, reiniciado no primeiro dia do mês às 00:00 UTC.

O orçamento disponível para uma operação é o menor entre o saldo diário e o saldo mensal. O teto mensal é soberano: atingir qualquer limite pausa novas chamadas Free, ainda que o outro limite tenha saldo. Em meses de 31 dias, o teto mensal continua em US$ 15,00; portanto, o teto diário não autoriza exceder o mensal.

Os custos de todas as chamadas gratuitas compartilham esse mesmo orçamento, incluindo usuários que ainda têm FlashCoins, mapas, formatação, chat e áudio. A pausa de chamadas não apaga saldo nem cards. Pro fica fora deste orçamento, mas sujeito a fair use.

O custo estimado de 20 kits completos é US$ 0,44. Assim, 20 kits por dia são uma meta condicionada à procura, ao custo real e ao orçamento restante; não há garantia de acomodar 20 kits completos além de todo o consumo de usuários Free existentes. A projeção de 600 kits a US$ 0,022 seria US$ 13,20 em 30 dias, antes de qualquer consumo Free adicional; o limite mensal continua sendo US$ 15,00.

### Pipeline sequencial e pré-reserva

Trabalhos com vários blocos são processados em sequência, um bloco por vez. Não se reservam simultaneamente os custos de todos os blocos.

Antes de cada chamada, o servidor calcula a reserva usando as tarifas vigentes do gateway e os limites efetivos da chamada: tokens de entrada do texto/documento, custo de visão das imagens após a validação e normalização, tokens máximos de saída e, quando aplicável, transcrição e síntese de áudio. O preço e a versão da tabela tarifária usados na estimativa devem ser registrados para auditoria.

O parâmetro máximo de saída da chamada não pode superar os tokens de saída cobertos pela reserva. A reserva inclui também a entrada máxima que será enviada. Uma reserva é gravada atomicamente e precisa caber simultaneamente nos saldos diário e mensal, considerando custos reconciliados e reservas ainda ativas. Se não couber, a chamada não é enviada e o trabalho fica pausado ou é colocado em espera.

Após a resposta, o servidor reconcilia a reserva com o uso faturado informado pelo gateway e libera somente a diferença confirmadamente não utilizada. Se houver timeout, cancelamento sem confirmação ou custo ainda desconhecido, a reserva permanece retida até confirmação ou até que uma estimativa conservadora, definida para aquela chamada, seja contabilizada. Nenhum valor incerto é liberado por presunção. O bloco seguinte só começa depois da reconciliação ou contabilização conservadora do anterior.

As reservas e reconciliações atualizam os controles diário e mensal em uma transação atômica. Valores monetários devem usar precisão fixa (por exemplo, micros de dólar) para evitar erros de arredondamento. A implementação registra cada reserva, chamada, reconciliação, liberação e custo estimado.

Se não houver orçamento suficiente para um novo kit, a concessão pode ficar em fila. A fila não reserva verba antecipadamente nem promete data de liberação. Quando houver capacidade, o servidor reavalia em ordem de chegada orçamento, confirmação de e-mail, elegibilidade antifraude e concessão prévia. Uma concessão repetida deve ser idempotente.

## 6. Saldo e cotas no banco

Toda conta nasce com saldo de FlashCoins igual a zero e cotas de degustação iguais a zero. O Kit só é concedido por função protegida do backend, após verificação de identidade, elegibilidade, antifraude e orçamento.

O cliente não pode definir ou alterar saldo, cotas, plano ou registros de concessão. RLS, privilégios e triggers bloqueiam inserções e atualizações diretas dessas informações. Somente funções autorizadas do servidor podem alterá-las.

A concessão do kit ocorre em transação, com trava de linha e chave idempotente por usuário. Ela credita 40 moedas e as cotas de 2 mapas, 3 formatações e 15 turnos, registra o bônus no ledger e marca a concessão.

O ledger de FlashCoins é imutável para o cliente e registra bônus, compra, débito, estorno e ajustes administrativos. Uma restrição única impede mais de uma concessão de boas-vindas por usuário.

O consumo de mapas, formatações e chat é registrado com `user_id`, `action_id` e tipo de recurso. Uma chave única impede consumo duplicado. Cota só é consumida após resposta bem-sucedida conforme a regra do recurso.

### Salvamento e cobrança de flashcards

Uma função transacional protegida valida o proprietário, o trabalho, a assinatura atual, o limite do ciclo, o saldo e o espaço do acervo. Para Free, ela bloqueia o perfil, verifica o teto de 100 cards e o saldo, insere os cards, debita exatamente uma moeda por card inserido e grava o ledger com a chave idempotente. Qualquer falha reverte cards e cobrança juntos.

Para Pro, a função confirma assinatura ativa e saldo disponível do limite de 2.500 cards do ciclo. Não consulta nem debita FlashCoins e não aplica o teto Free de 100 cards.

## 7. Trabalhos recuperáveis

Resultados de flashcards ainda não salvos podem ficar em `document_jobs` por até 24 horas. Enquanto estiverem em pré-visualização, não há débito de FlashCoins. O job registra proprietário, `action_id`, estado, blocos concluídos, payload, reservas associadas, validade e timestamps.

Toda leitura, revisão, salvamento ou descarte verifica no servidor se o usuário autenticado é o proprietário. O navegador só lista os próprios trabalhos.

Ao selecionar “Revisar e salvar”, uma função segura confirma que o job está pronto e não expirou, valida o plano, o espaço e o saldo e grava cards e cobrança atomicamente. O salvamento posterior não exige que o lease de geração ainda esteja ativo; exige que o job seja válido, pertença ao usuário e não tenha sido consumido. Ao selecionar “Descartar”, o payload é removido sem cobrança. Jobs expirados são limpos por rotina agendada ou limpeza oportunista segura. Reservas só são liberadas se não houver chamada ativa e o custo estiver confirmado ou conservadoramente contabilizado.

Se uma chamada retornar depois de perder o lease, ela não pode gravar cards. O orçamento da chamada continua contabilizado conforme a regra de timeout e custo. A interface explica que o cancelamento é tentado, mas não garantido, e que resultados recuperáveis ficam disponíveis por 24 horas.

## 8. Antifraude e privacidade

`fp_device_id` é um identificador pseudônimo e sinal heurístico, não identidade comprovada. Pode ser alterado, apagado ou compartilhado. Permite limitar a duas concessões por identificador válido durante sua retenção; não é a única barreira antifraude.

A contagem por dispositivo é transacional. A terceira conta associada não recebe automaticamente o bônus, mas pode usar recursos manuais e estudar. Registros de dispositivo expiram após 180 dias de inatividade; depois da expiração, o identificador deixa de impor o limite anterior. Essa duração e finalidade devem constar na política de privacidade.

Se o identificador não puder ser criado, o bônus fica pendente até confirmação de e-mail, uma janela de segurança de 15 minutos e avaliação dos sinais antifraude disponíveis. A ausência do identificador não concede automaticamente bônus ilimitado nem bloqueia a conta. Desafios adicionais, como CAPTCHA adaptativo, podem ser solicitados diante de risco elevado.

Para limitar rajadas de cadastro, o servidor pode processar temporariamente o IP em memória, extrair a sub-rede (/24 IPv4 ou /48 IPv6) e descartar o IP bruto. Uma tabela transitória armazena somente HMAC da sub-rede, contador e expiração de 10 minutos. A chave HMAC permanece estável durante toda a janela, inclusive na virada do dia, e é rotacionada apenas com sobreposição suficiente para não dividir uma janela ativa. Mais de cinco cadastros na mesma janela direcionam novos bônus para observação, sem bloquear o estudo manual. O IP bruto não é persistido. O uso, retenção e finalidade dos sinais devem ser documentados e revisados para conformidade com a LGPD.

## 9. Experiência do usuário

As telas de IA mostram saldo ou cota restante, limites relevantes, previsão realista, progresso e mensagens de bloqueio compreensíveis. No Bulk, o botão anuncia a quantidade máxima calculada pelo servidor ou por dados confiáveis e atualizados. Não deve prometer custo ou quantidade que o backend não possa autorizar.

O saldo de 6 a 40 moedas aparece em badge discreto. Entre 1 e 5, há aviso cordial com link para a Loja. Em saldo zero, a interface informa que cards já salvos permanecem disponíveis e oferece opções de compra ou Pro. Mapas, anotações e chat mostram cotas Free ou uso Pro e data de renovação.

O progresso pode apresentar fases de leitura, compreensão, geração e salvamento. Percentual e tempo restante são estimativas, não garantias. Cancelamento antes do envio ao provedor não gera custo de API; após o envio, o cancelamento é best-effort e pode contar como trabalho iniciado.

Telas vazias podem oferecer exemplos práticos de um clique. Os exemplos não devem disparar cobrança, consumir cotas ou iniciar uma chamada real sem consentimento explícito.

## 10. Estruturas e funções a implementar

Implementar as mudanças em etapas, sem alterar regras de produção fora do escopo:

1. **Banco e permissões:** campos de saldo e concessão; ledgers de FlashCoins e cotas; tabela de orçamento e reservas; jobs; locks; fila de bônus; registros temporários de sub-rede; consumo Pro por ciclo. Aplicar RLS, privilégios mínimos, índices, restrições únicas e funções `SECURITY DEFINER` com `search_path` fixo e validação de identidade.
2. **Funções protegidas:** concessão idempotente do kit; validação de plano e upload; aquisição/renovação/liberação de lease; reserva/reconciliação do orçamento; execução idempotente por `action_id`; persistência transacional de cards e débito; consumo de cotas; fila/reavaliação de bônus; limpeza de jobs e estado transitório expirados.
3. **Integração de IA:** processamento sequencial; limites e timeouts; no máximo duas novas tentativas automáticas por bloco; `AbortController` best-effort; captura de uso do gateway; reconciliação sem liberar custo incerto.
4. **Interface:** indicadores de saldo e cotas, quantidade máxima, progresso, avisos de limite, retomada de jobs, fila de bônus e mensagens claras sobre cancelamento e indisponibilidade.
5. **Testes e implantação:** aplicar migrations primeiro em ambiente de desenvolvimento, validar casos abaixo, executar build/type-check e só então propor publicação. Todas as alterações devem permanecer na branch `dev`; não incluir trabalho local não relacionado no mesmo commit.

## 11. Critérios de homologação

- Tentativas de criar ou alterar saldo, cotas ou plano pelo navegador são recusadas pelo banco.
- Uma conta elegível recebe o kit uma vez; requisições simultâneas ou repetidas não duplicam concessão.
- Contas não elegíveis podem estudar manualmente, mas não recebem cotas indevidas.
- Terceira conta no mesmo identificador não recebe automaticamente o kit; ausência do identificador segue o fluxo pendente.
- Limites de PDF, DOCX/TXT e imagens são recusados no servidor conforme o plano; Free e Pro têm limites próprios.
- Um usuário Free com 95 cards não consegue exceder 100; a previsão limita geração a até cinco cards.
- Pro não gasta moedas nem fica sujeito ao teto Free de cards, mas respeita limites do ciclo.
- Duas abas não iniciam duas chamadas simultâneas; chamada antiga sem encerramento confirmado bloqueia nova execução até confirmação ou hard timeout.
- Repetir o mesmo `action_id` não chama o provedor novamente, não duplica cards e não consome cotas duas vezes.
- Cada bloco reserva orçamento antes da chamada, reconcilia antes do bloco seguinte e nunca permite que reservas ativas mais custos reconciliados ultrapassem qualquer teto Free.
- Timeout sem custo confirmado não libera reserva por presunção.
- Cancelamento antes e depois do envio ao provedor segue contabilização distinta; a interface não promete cancelamento garantido.
- Jobs são acessíveis somente pelo proprietário, expiram após 24 horas e não cobram moedas antes do salvamento confirmado.
- O circuito pausa chamadas Free ao atingir o teto diário ou mensal, preserva saldo e cards e não bloqueia Pro por orçamento Free.
- A renovação dos limites Pro coincide com o ciclo individual confirmado pelo provedor de pagamento.
- Rajadas de cadastro acionam observação sem persistir IP bruto nem bloquear automaticamente recursos manuais.

## 12. Condições para ativação

O valor de US$ 0,022 por kit e a capacidade de saída por bloco são hipóteses até serem medidos no gateway com os formatos reais de entrada e resposta. Antes de ativar para usuários, registrar custos por recurso, verificar se as tarifas usadas na reserva estão atualizadas e testar que o limite de 3.000 tokens comporta os cards prometidos. Se a medição divergir, ajustar a estimativa, o limite de saída ou a oferta antes de liberar a funcionalidade.

O teto mensal de US$ 15,00 é um controle da aplicação, não uma garantia sobre cobrança externa ou indisponibilidade do provedor. Configurar também alertas operacionais no gateway/conta de cobrança. Não anunciar “segurança financeira absoluta”; comunicar limites, estimativas e pausas temporárias de forma transparente.
