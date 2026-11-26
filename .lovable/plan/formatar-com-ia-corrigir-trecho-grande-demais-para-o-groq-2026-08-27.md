# Formatar com IA: corrigir "Trecho grande demais para o Groq"

A divisão automática já entrou em ação, mas os blocos continuam grandes demais: cada parte tem até 12.000 caracteres e a resposta do modelo é limitada a 8.000 tokens (dos quais parte é consumida pelo raciocínio interno). Como o texto formatado sai maior que o original, a resposta é cortada e o bloco é rejeitado — inclusive na primeira parte, por isso o erro aparece sozinho na tela.

Suas anotações maiores têm ~113 mil e ~61 mil caracteres, então esse cenário é o normal, não a exceção.

## O que muda

1. Partes menores: cada bloco passa a ter cerca de 3.500 caracteres, com folga suficiente para o texto formatado caber na resposta.
2. Orçamento de resposta maior e sem gasto com raciocínio interno, para o modelo usar todo o espaço com o conteúdo.
3. Se mesmo assim um bloco estourar, ele é subdividido até 4 vezes; parágrafos únicos e muito longos passam a ser quebrados por frase (hoje eles não conseguem ser divididos e derrubam o processo).
4. Mensagem de erro mais clara, sempre indicando em qual parte parou e mantendo o que já foi formatado.
5. As partes são processadas em sequência com uma pequena pausa entre elas, evitando o limite por minuto do Groq em anotações grandes.

Anotações muito longas levarão mais tempo (uma de 113 mil caracteres vira ~30 partes); o modal segue mostrando o número estimado de partes.

## Detalhes técnicos

- `src/lib/notes-format.server.ts`:
  - `MAX_CHUNK_CHARS` de 12000 para 3500.
  - `max_completion_tokens` de 8000 para 16000; remover `reasoning_effort` (ou usar `"none"` quando suportado) para não consumir o orçamento.
  - `splitHtmlIntoChunks`: quando um único bloco de topo exceder `maxChars`, quebrá-lo por sentença/`<br>` em vez de devolvê-lo inteiro, garantindo que a recursão sempre progrida.
  - `formatChunkWithRetry`: profundidade máxima 4 e mensagem final incluindo o índice da parte.
  - Pequeno `await` (~300 ms) entre partes.
