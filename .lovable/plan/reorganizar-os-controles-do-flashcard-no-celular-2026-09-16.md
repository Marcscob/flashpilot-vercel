# Reorganizar os controles do flashcard no celular

## Resultado esperado
- Manter no topo apenas o nome do assunto, sem disputar espaço com os comandos.
- Levar os comandos para uma barra própria na parte inferior do card, organizada em duas linhas quando necessário.
- Garantir uma área de toque de pelo menos 44 × 44 px por ação, com espaço entre os botões para evitar toques acidentais.
- Usar a mesma ordem nas duas faces do card: tamanho do texto, narração automática, ouvir, velocidade, praticar, traduzir e editar; ações que não se aplicam ao card simplesmente não aparecem.
- Manter o texto do card com rolagem própria, sem ficar encoberto pela nova barra.

## Comportamento por tamanho de tela
- **Celular:** assunto no topo; conteúdo no centro; comandos em grade na parte inferior. “Praticar” vira um comando compacto com ícone, mantendo o nome acessível ao leitor de tela.
- **Tablet e computador:** preservar a disposição horizontal atual no topo, sem alterar o fluxo já conhecido.
- A marcação “Revisado” e a indicação de virar o card continuam no rodapé, sem sobrepor os novos comandos.

## Verificação
- Conferir frente e verso em 407 × 776, incluindo cards com tradução, edição, anotação, mapa mental e vídeos.
- Confirmar que todos os comandos podem ser tocados isoladamente e que nenhum texto ou botão se sobrepõe.
- Conferir também uma tela larga para garantir que a versão atual de computador permaneceu intacta.

## Detalhes técnicos
- Concentrar a mudança em `src/components/FlipCard.tsx`, reaproveitando as ações existentes e sem alterar narração, tradução ou salvamento.
- Aplicar a organização móvel abaixo de `sm`; acima disso, manter a barra superior atual.
- Usar dimensões responsivas e classes semânticas já existentes; nenhuma mudança no banco de dados.
