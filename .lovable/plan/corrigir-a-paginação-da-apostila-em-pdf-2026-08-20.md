# Corrigir a paginação da apostila em PDF

## Objetivo
Fazer a impressão seguir o fluxo exibido na tela: título da apostila, data, sumário e início da anotação na mesma página quando houver espaço, sem criar uma folha quase vazia apenas para a capa.

## Alterações
1. Remover das regras de impressão as quebras obrigatórias após a capa e o sumário. Atualmente ambas usam `break-after: page`, o que explica as três folhas mostradas para uma única anotação.
2. Manter capa, sumário e capítulos em fluxo contínuo, com espaçamentos compactos e próprios para A4.
3. Proteger títulos de capítulos contra isolamento no fim da página, mantendo o título junto das primeiras linhas do conteúdo sempre que possível.
4. Preservar a marca d’água repetida, imagens, tabelas, cabeçalho/rodapé do navegador e as proteções contra cópia já existentes.

## Validação
- Simular o clique real em “Imprimir / PDF” com a anotação exibida nas capturas.
- Gerar o PDF e inspecionar visualmente todas as páginas, especialmente a primeira.
- Confirmar que a primeira página contém capa, sumário e o início do texto; que não há folhas vazias; e que títulos não ficam órfãos.

## Detalhes técnicos
- Ajustar somente as regras `@media print` da apostila em `src/styles.css`.
- Manter o portal de impressão e a espera por fontes/imagens já implementados.
