# Formatação com IA de anotações longas, parte por parte

## Problema confirmado
A anotação inteira vai em um único pedido. O servidor formata todas as partes dentro desse pedido, e ele é cancelado depois de 60 segundos. Com isso, anotações longas falham no meio e a barra de progresso não avança. O limite de caracteres por plano (15 mil no gratuito, 60 mil no Pro) continua valendo, porque é uma regra de preço.

## Correção
- A tela divide a anotação em partes e envia uma parte por pedido, em sequência. A barra mostra "parte X de N" de verdade.
- Todas as partes usam o mesmo código de operação. A formatação desconta **1** da cota uma única vez, na primeira parte bem-sucedida, e as partes seguintes aproveitam essa mesma reserva.
- O servidor confere o tamanho total da anotação, conforme o plano, antes de processar a primeira parte. Não é possível burlar o limite enviando várias partes pequenas: o total e a quantidade de partes ficam registrados na reserva.
- Cada pedido de uma parte tem sua própria janela de 60 segundos. Partes muito grandes continuam sendo subdivididas no servidor.
- Se uma parte falhar, a tela oferece "Tentar novamente a partir da parte X" sem cobrar de novo.

## Detalhes técnicos
- `notes-format.functions.ts`: nova entrada `{ actionId, partIndex, totalParts, totalChars, chunk }`. Na parte 0, chama `runWithAiQuota` com a verificação de tamanho. Nas outras, confere com `has_ai_quota_action` se a ação já existe e formata dentro de `runWithAiGenerationLease`.
- `AiFormatNoteDialog.tsx`: usa `splitNoteHtml`, faz um laço com progresso real e junta o resultado.
- Validação: formatar uma anotação com cerca de 14 mil caracteres (conta gratuita) e outra com cerca de 50 mil (Pro); conferir que só uma unidade da cota foi descontada.
