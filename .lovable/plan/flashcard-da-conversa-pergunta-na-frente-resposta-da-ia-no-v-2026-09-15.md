# Flashcard da conversa: pergunta na frente, resposta da IA no verso

## Objetivo
Na tela de conversação, ao tocar em "Criar flashcard" abaixo de uma resposta da IA, o flashcard já deve nascer preenchido assim:

- **Frente (pergunta):** a mensagem que eu enviei logo antes daquela resposta.
- **Verso (resposta):** a resposta da IA.

Hoje a resposta da IA vai para a frente e o verso fica vazio — o comportamento será corrigido.

## Como fica a tela
- O botão "Criar flashcard" continua aparecendo só abaixo das respostas da IA.
- Ao abrir, a caixa já mostra os dois campos preenchidos (minha pergunta na frente, resposta da IA no verso) — ambos continuam **editáveis** antes de salvar, como hoje.
- Se a resposta da IA for a primeira da conversa e não houver mensagem minha antes (caso raro), a frente abre vazia para eu preencher.
- Matéria, assunto e idioma continuam funcionando exatamente como estão (idioma herdado da conversa, card sempre pessoal do aluno).

## Detalhes técnicos
- `src/routes/_authenticated/language-chat.tsx`: em vez de guardar só o texto da resposta (`cardPhrase`), guardar o par `{ question, answer }` — a pergunta é a última mensagem do usuário anterior à resposta na lista `turns`; a resposta é o conteúdo da própria mensagem da IA.
- `src/components/CreateCardFromChatDialog.tsx`: ganha o campo `answer` inicial preenchido a partir da resposta da IA (hoje abre sempre vazio); a frente passa a receber a pergunta do usuário. Nenhuma mudança na gravação — continua inserindo card pessoal em `flashcards` com matéria/assunto/idioma escolhidos.
- Nenhuma mudança no banco de dados, nas funções de IA, na correção pedagógica ou em outras telas.

## Testes previstos
1. Enviar uma pergunta real e criar o flashcard: frente = minha pergunta, verso = resposta da IA.
2. Editar frente e verso antes de salvar e confirmar que o card salvo respeita a edição.
3. Verificar o card na lista de flashcards do assunto escolhido, com o idioma herdado da conversa.
4. Regressão: conversa normal, correção do modo Professor, narração e ditado seguem iguais; telas Início, Flashcards e Conversação abrem sem erros.
5. Dados e consumos de teste apagados ao final.
