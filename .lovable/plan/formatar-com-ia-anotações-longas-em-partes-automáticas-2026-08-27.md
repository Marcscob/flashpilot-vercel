# Formatar com IA: anotações longas em partes automáticas

Hoje, quando a anotação é grande, o Groq recusa a requisição (limite de tamanho) e a tela mostra "A anotação ultrapassa o limite do Groq. Divida o texto em partes menores." — jogando o trabalho de dividir para você.

## O que muda

O formatador passa a dividir a anotação sozinho e a remontar o resultado, sem você precisar fazer nada.

1. Antes de chamar a IA, o texto é medido. Se couber, segue como hoje (uma chamada só).
2. Se for grande, ele é cortado em blocos por limites naturais (parágrafos, títulos, `<hr>`, tabelas e imagens nunca são partidos no meio).
3. Cada bloco é formatado em sequência, com a mesma regra de estilo, e o resultado final é a junção dos blocos na ordem original.
4. Se ainda assim um bloco individual estourar (ex.: uma tabela gigante), ele é subdividido mais uma vez; só em último caso aparece mensagem de erro.
5. Durante o processo o modal mostra o andamento ("Formatando parte 2 de 5…") para não parecer travado.
6. Se uma parte falhar no meio do caminho, as partes já prontas são mantidas e a mensagem indica exatamente onde parou.

## Detalhes técnicos

- `src/lib/notes-format.server.ts`: extrair a chamada atual para `formatChunk()`; adicionar `splitHtmlIntoChunks(html, maxChars)` que fatia em elementos de topo (`<p>`, `<ul>`, `<ol>`, `<blockquote>`, `<table>`, `<hr>`) acumulando até o teto (~12k caracteres por bloco, margem segura para `max_completion_tokens: 8000`); `formatNoteWithGroq` passa a iterar os blocos sequencialmente (evita 429) e concatenar o HTML sanitizado.
- Tratamento de `413` e de `finish_reason === "length"` passa a acionar re-split do bloco (uma tentativa com metade do tamanho) em vez de erro imediato.
- `src/lib/notes-format.functions.ts`: sem mudança de assinatura; opcionalmente retorna `parts` para a UI.
- Tela `/apostila`: texto do botão/estado de carregamento passa a mostrar progresso por partes.
