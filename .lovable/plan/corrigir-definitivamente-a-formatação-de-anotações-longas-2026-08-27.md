# Corrigir definitivamente a formatação de anotações longas

## Problema confirmado

O formatador já divide a anotação, mas a recuperação de erro para depois de quatro subdivisões. Se o Groq ainda encerrar uma resposta por limite de tamanho, o código abandona o processo e mostra “Trecho grande demais para o Groq”, mesmo que o trecho ainda possa ser reduzido.

O cálculo exibido no modal também não corresponde ao corte real: a tela estima partes de 12.000 caracteres, enquanto o servidor usa 3.500. Por isso aparece “parte 1 de 3”, mas internamente podem existir muito mais chamadas.

## Correção

- Trocar a recursão limitada por uma fila adaptativa: quando o Groq truncar uma parte, ela será dividida ao meio e recolocada na fila até atingir um tamanho mínimo seguro.
- Fazer a divisão preservar todo o conteúdo e as tags estruturais, incluindo texto fora de parágrafos, imagens e tabelas, sem descartar intervalos entre blocos.
- Priorizar no Groq um modelo adequado à transformação de texto sem consumir orçamento desnecessário com raciocínio; manter fallback somente para indisponibilidade real do modelo.
- Tratar separadamente limite de entrada, resposta truncada, modelo indisponível e limite de requisições; aplicar espera e repetição automática para erro temporário.
- Remover o erro genérico “Trecho grande demais” como resultado final: no limite mínimo, retornar uma mensagem com a causa real informada pelo Groq.
- Fazer o modal mostrar o progresso real das partes processadas, em vez de uma estimativa incompatível com o servidor.

## Validação

- Testar a divisão com parágrafo único longo, muitos parágrafos, tabela e imagem.
- Confirmar que a concatenação mantém o conteúdo e a ordem originais.
- Executar a anotação que falhava e verificar que todas as partes terminam antes de liberar “Aplicar”.
- Confirmar compilação e ausência de erros no navegador e no servidor.

## Detalhe técnico

Arquivos principais: `src/lib/notes-format.server.ts`, `src/lib/notes-format.functions.ts` e `src/components/AiFormatNoteDialog.tsx`.

O arquivo que declara `createServerFn` continuará como wrapper fino; validação e lógica executável ficarão em módulo importado ou dentro do handler.
