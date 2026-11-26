# Varredura de prazos — cópia de cards para "Estudo dos Prazos"

Rotina reutilizável que varre os flashcards de **Direito Processual Civil**, identifica os que tratam de prazo / lapso temporal e cria uma **cópia independente** dentro do assunto **Estudo dos Prazos**.

## Como vai funcionar

1. Botão **"Varredura de prazos"** no menu da tela de Flashcards (engrenagem / hambúrguer).
2. Ao abrir, um modal permite escolher a matéria (padrão: Direito Processual Civil) e o assunto de destino (padrão: Estudo dos Prazos).
3. Etapa 1 — pré-filtro por palavras-chave, feito no banco: prazo, dias, horas, meses, anos, tempestivo/intempestivo, preclusão, decadência, prescrição, termo inicial/final, dilatório, peremptório, suspensão/interrupção, contagem, feriado, férias forenses, antecedência. Hoje isso seleciona ~667 de 3.808 cards.
4. Etapa 2 — a IA revisa cada candidato em lotes e responde apenas "sim/não": o card realmente trata de prazo, contagem ou lapso temporal com efeito jurídico? Descarta menções acidentais a tempo.
5. Etapa 3 — tela de resumo mostra quantos foram analisados, aprovados e quantos já existem no destino; você confirma e a cópia é feita.
6. As cópias entram em **Estudo dos Prazos** como cards novos e independentes: progresso de revisão zerado, sem alterar o original. Pergunta, resposta, imagem, vídeo e anotação vinculada são preservados.

## Evitar duplicatas em novas varreduras

Antes de copiar, a rotina compara a pergunta (normalizada) dos cards já existentes em Estudo dos Prazos e ignora os repetidos — então rodar de novo depois de acrescentar conteúdo só traz o que é novo.

## Progresso e custo

O modal mostra progresso por lote ("analisando 120 de 667"), permite cancelar e informa erros de IA (limite de uso, indisponibilidade) sem perder o que já foi copiado.

## Detalhes técnicos

- `src/lib/prazos-scan.functions.ts` — server functions com `requireSupabaseAuth`:
  - `scanPrazoCandidates`: busca paginada (contorna o limite de 1000 linhas) dos cards da matéria, aplica o regex de palavras-chave e devolve os candidatos.
  - `classifyPrazoBatch`: chama o Lovable AI Gateway (`google/gemini-3.1-flash-lite`, lotes de ~25 cards, saída JSON estrita) e devolve os ids aprovados; trata 429/5xx com backoff e 402/403 como erro terminal exibido na UI.
  - `copyPrazoCards`: insere as cópias em `flashcards` com `topic_id` = Estudo dos Prazos, `ease_factor/interval_days/repetitions/due_date` padrão, `reviewed=false`, copiando `image_url`, `image_category_id`, `linked_note_id`, `video_url_1/2`, `card_format`; deduplica por pergunta normalizada.
- `src/lib/prazos-scan.server.ts` — lista de palavras-chave, prompt de classificação e normalização de pergunta (reutilizável em futuras varreduras de outros temas).
- `src/components/PrazoScanDialog.tsx` — modal com seleção de matéria/destino, barra de progresso, resumo e confirmação.
- Ponto de entrada em `src/routes/_authenticated/flashcards.tsx`, invalidando as queries de flashcards ao final.
- Nenhuma mudança de schema é necessária.
