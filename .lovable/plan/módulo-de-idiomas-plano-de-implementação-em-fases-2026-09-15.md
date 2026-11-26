# Módulo de Idiomas — plano de implementação em fases

## 0. Instrução operacional
Este é o documento oficial do Módulo de Idiomas. Uma fase por vez: **na aprovação deste plano, será implementada exclusivamente a Fase 1**, sem antecipar qualquer parte das fases seguintes — nada de conversação, voz em nuvem, créditos ou telas de conversa na Fase 1.

Ao concluir a fase: executar os testes previstos, testar regressão do que existe, corrigir regressões antes de encerrar, apresentar relatório objetivo (arquivos criados, modificados e removidos; mudanças de banco e colunas; funções e componentes criados ou modificados; testes executados e resultado de cada um; riscos, limitações e pendências) e **parar, aguardando autorização explícita** para a fase seguinte.

Proteção contra alterações indevidas: antes de mexer num arquivo existente, localizar a implementação atual, entender dependências, preservar o comportamento e mudar só o necessário. Nunca criar uma segunda implementação do que já existe (narração, ditado, autenticação, assinatura, cache, controle de acesso). Nenhuma refatoração preventiva, mudança de estilo ou alteração arquitetural fora da fase.

Banco: antes de criar tabela, coluna, função, regra de acesso, bucket ou migração, verificar se já existe algo equivalente, conferir o estado atual e as dependências, reutilizar quando compatível e evitar duplicidade. Nunca apagar ou recriar dados existentes para simplificar uma migração.

Conteúdo oficial: somente leitura para as novas funcionalidades — nada altera, sobrescreve ou converte automaticamente conteúdo oficial em pessoal, e nenhuma mudança de estrutura perde dados. Card novo é sempre card pessoal do usuário.

Preparação mínima: se uma fase precisa preparar terreno para outra, faz apenas o mínimo necessário, nunca a funcionalidade futura.

Conclusão de fase: implementação → testes → regressão → correção → relatório → sua aprovação. Só depois começa a fase seguinte.



## 1. Objetivo
Transformar o app num módulo completo de aprendizagem de idiomas, acrescentando progressivamente: pronúncia multilíngue; leitura de palavras, frases e textos; voz local com apoio da nuvem; cache global de áudio; conversação com IA; correção pedagógica; modos Conversação, Professor e Treino; criação de flashcards a partir da conversa; prática de um card na conversa; e controle de uso e custos por créditos.

## 2. Regra fundamental de preservação
Nada é substituído, reescrito ou refatorado sem necessidade. Antes de tocar em qualquer arquivo, mapear como funcionam hoje: matérias, assuntos, flashcards, card, botão de som, narração, voz atual, ditado, autenticação, assinatura, controle de acesso, banco e cache de dados. Reutilizar o que existe. Nenhuma alteração fora do escopo da fase.

Cada fase é implementada, testada e validada isoladamente. Ao concluir, relatório com: arquivos alterados, mudanças no banco, funções criadas/modificadas, componentes alterados, testes executados, resultado e riscos/pendências.

## 3. Regra crítica de retrocompatibilidade
Para matérias sem idioma definido, o comportamento atual permanece absolutamente inalterado: mesma voz, mesmo mecanismo de narração, mesmo apoio da nuvem, mesma velocidade, mesma interface, mesmos componentes e mesmo tratamento de erro. A lógica multilíngue só é ativada quando existe idioma explicitamente definido. Para isso, o botão de som e as funções existentes passam a aceitar `lang` **opcional**; sem `lang`, seguem o caminho atual.

## Fase 1 — Idioma nas matérias e nos cards
- `subjects.language` e `flashcards.language`, texto opcional. Idiomas iniciais: pt-BR, en, es, fr, it, de; acrescentar outros sem mudar a estrutura.
- Seletor de idioma opcional na configuração da matéria; possibilidade de sobrescrever no card.
- Regra: idioma do card → idioma da matéria → pt-BR. Sem alteração visual desnecessária.
- **Validação:** matéria sem idioma continua idêntica; matéria em inglês persiste o idioma.

## Fase 2 — Idioma efetivo
- `src/lib/card-language.ts` com `resolveCardLanguage(card, subject)`, única responsável pela decisão.
- **Validação:** card com idioma; card sem idioma + matéria com idioma; ambos sem idioma; matéria em português; matéria não linguística.

## Fase 3 — Voz local multilíngue
- `src/lib/tts.ts`: `speak(text, { lang, rate })` e `stopSpeaking()`.
- Busca de voz compatível por locale/prefixo (en → en-US, en-GB; es → es-ES, es-MX; fr → fr-FR…), com escolha determinística quando há várias, sem supor que o aparelho tem determinada voz.
- **Compatibilidade:** chamadas sem `lang` funcionam exatamente como antes.

## Fase 4 — Pronúncia nos cards
- Botão de som e card recebem `lang?` vindo de `resolveCardLanguage()`; layout inalterado.
- Funciona em frente, verso, palavra, frase e texto.
- Velocidades 0,75x / 1,0x / 1,25x / 1,5x aplicadas na reprodução — nunca arquivos diferentes por velocidade.

## Fase 5 — Textos longos
- `splitTextForSpeech(text)` dividindo por parágrafo, frase e depois palavra, evitando cortes arbitrários.
- Fila de reprodução com sensação de leitura contínua; parar cancela toda a fila.
- **Validação:** palavra, frase, vários parágrafos, texto muito longo, interrupção e troca de velocidade.

## Fase 6 — Voz em nuvem
- `src/lib/tts-cloud.functions.ts`: `synthesizeSpeech({ text, lang, voice? })`, mantendo `synthesizePtBr()` como wrapper de compatibilidade.
- Fluxo: voz local adequada → toca local; senão consulta o cache; acerto → devolve; falha → gera na nuvem, salva e devolve.

## Fase 7 — Cache de áudio
- Tabela `tts_cache`: cache_key, text_hash, language, voice_id, provider, model, storage_path, created_at, last_used_at.
- `text_hash` em SHA-256; chave lógica = texto normalizado + idioma + voz + provedor + modelo. Velocidade fora da chave.

## Fase 8 — Cache global e retenção
- Mesmo conteúdo/idioma/voz/provedor/modelo gera uma única entrada reutilizável entre usuários.
- Bucket privado `tts-cache` com URL assinada — nunca tornar público para facilitar a reprodução.
- Distinguir conteúdo oficial, conteúdo do aluno e áudio de conversação, permitindo limpeza automática futura dos áudios de conversa.

## Fase 9 — Infraestrutura da conversação
- `src/lib/language-chat.functions.ts` e `src/routes/_authenticated/language-chat.tsx`, com `createServerFn` + `requireSupabaseAuth`.
- Modelo em um único ponto de configuração (`LANGUAGE_CHAT_MODEL`). Antes de implementar, verificar qual gateway/modelo já está efetivamente disponível no projeto e usar o identificador válido existente, preservando a infraestrutura atual — sem trocas silenciosas.

## Fase 10 — Histórico
- `language_chat_sessions`: user_id, subject_id, language, level, topic, mode, created_at, updated_at.
- `language_chat_messages`: session_id, user_id, role, content, correction_data (JSONB), created_at.

## Fase 11 — Segurança
- Regras de acesso por `auth.uid()`: cada usuário só vê e cria as próprias sessões e mensagens; permissões concedidas a `authenticated` e `service_role`.
- Teste explícito de usuário A tentando alcançar dados de B, inclusive manipulando identificadores na tela. Toda operação sensível também validada no servidor.

## Fase 12 — Configuração da conversa
- Idioma herdado da matéria.
- Nível: Iniciante, Intermediário, Avançado — estrutura pronta para A1–C2.
- Tema: cotidiano, viagem, entrevista, restaurante, trabalho, livre, assunto do card.

## Fase 13 — Modos pedagógicos
- **Conversação:** a IA conversa naturalmente no idioma.
- **Professor:** conversa e identifica/explica erros relevantes.
- **Treino:** cria uma situação simulada e assume o papel do interlocutor (ex.: check-in em hotel — IA recepcionista, aluno hóspede).
- Todos respeitam o nível escolhido.

## Fase 14 — Correção pedagógica
- A IA responde primeiro à conversa; não transforma cada mensagem em aula de gramática.
- Quando há erro relevante, mostra à parte: correção, explicação curta e forma mais natural.
- Iniciante: poucos erros essenciais. Intermediário: erros relevantes e formas mais naturais. Avançado: também naturalidade, registro, colocações, nuances e expressões idiomáticas.
- Tom amigável, nunca constrangedor.

## Fase 15 — Ouvir as respostas da IA
- Botão "Ouvir" em cada resposta, no idioma da sessão, pelo mesmo caminho: voz local → nuvem → cache. Nenhum segundo sistema de áudio.

## Fase 16 — Falar com a IA
- Reutiliza o ditado existente: microfone → texto → verificação de acesso/crédito → IA → resposta → som.

## Fase 17 — Criar flashcard a partir da conversa
- Ação "Criar flashcard" em frases da conversa, gerando card pessoal do aluno, com idioma herdado da sessão salvo alteração explícita.
- Conteúdo oficial nunca é alterado, editado ou sobrescrito.

## Fase 18 — Card → Praticar
- Ação "Praticar esta frase" no card de idioma, abrindo a conversa com o card como contexto: a IA identifica a estrutura, cria situação, o aluno usa a estrutura e recebe correção.

## Fase 19 — Créditos
- Não é contagem de mensagens: conceito de créditos de IA com camada de abstração para o cálculo, considerando conversa, caracteres de voz em nuvem, duração/quantidade de áudio e recursos futuros.
- Apresentação amigável ("usou 35/100 créditos hoje", "cerca de 20 minutos de conversa restantes"); a unidade interna não precisa ser a exibida.

## Fase 20 — Assinatura e autorização
- Ordem obrigatória antes de qualquer chamada externa: autenticado → assinatura válida → tem crédito → executar.
- Sem assinatura: recurso apenas para assinantes. Sem crédito: limite diário atingido. As verificações nunca dependem só da tela.

## Fase 21 — Estado da interface
- TanStack Query para sessões, histórico, atualização de mensagens e retomada, sem recarregar a tela.
- Estados separados: session, messages, input, speechRecognition, tts, loading, error, credits. Histórico sempre disponível.

## Fase 22 — Tratamento de erros
- Voz local indisponível → nuvem; nuvem indisponível → avisar sem quebrar o card; cache indisponível → gerar de novo; IA indisponível → não perder a mensagem; limite atingido → não chamar o serviço; texto longo → dividir; interrupção → cancelar a fila; sessão expirada → pedir autenticação preservando o que for possível localmente.

## Fase 23 — Testes finais e preservação
- **Matérias não linguísticas:** narração, voz, apoio em nuvem, velocidade e telas idênticos ao comportamento anterior.
- **Matérias linguísticas:** inglês, espanhol, francês, italiano, alemão e português.
- **Flashcards:** idioma herdado, idioma próprio, matéria sem idioma, criação de card, preservação do conteúdo oficial.
- **Áudio:** voz local, nuvem, acerto e falha de cache, textos longos, interrupção, velocidade.
- **Conversação:** criação e retomada de sessão, histórico, três modos, três níveis, temas, ditado, som, correção, criação de flashcard.
- **Segurança:** acesso cruzado entre usuários, manipulação de identificadores, sem autenticação, sem assinatura, sem crédito.

## Regra de execução
Não implementar todas as fases numa única execução. Fase 1 → validar → Fase 2 → validar → … → Fase 23. Ao final de cada fase: testes, correção de regressões, relatório de arquivos, banco, funções e componentes alterados, e espera pela validação antes da fase seguinte. Nenhuma refatoração ou "melhoria" fora da fase.

## Princípio arquitetural
Matéria → idioma → flashcard → ouvir → praticar → conversar → errar → corrigir → melhorar a expressão → criar flashcard → revisar → praticar novamente. O objetivo é o ciclo integrado de aprendizagem, mantendo intacto todo o funcionamento atual das demais matérias.
