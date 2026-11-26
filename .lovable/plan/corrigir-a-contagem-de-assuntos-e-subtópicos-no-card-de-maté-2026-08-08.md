Corrigir a contagem de assuntos e subtópicos no card de matéria

Objetivo
Ajustar o card de cada matéria na tela inicial para mostrar, em linhas separadas:
- quantos assuntos (tópicos raiz, parent_id IS NULL) a matéria tem;
- quantos subtópicos (tópicos filhos, parent_id IS NOT NULL) a matéria tem.

Atualmente o card mostra "35 assuntos" porque a contagem de topics(count) não separa tópicos raiz de subtópicos.

Escopo de mudança
1. Dados
   - Alterar a query de subjects em src/routes/_authenticated/home.tsx para não depender mais de topics(count) como única métrica.
   - Buscar os tópicos do usuário com subject_id e parent_id e, no cliente, computar:
     - rootCount = tópicos com parent_id === null por subject_id
     - subtopicCount = tópicos com parent_id !== null por subject_id
   - Manter a contagem de flashcards se ainda for exibida (opcional, dependendo do layout final).

2. Interface
   - No card de matéria, substituir a linha única "X assuntos" por duas linhas:
     - "X assuntos"
     - "Y subtópicos"
   - Aplicar estilos compactos para não aumentar excessivamente a altura do card no mobile.

3. Internacionalização
   - Adicionar as chaves necessárias em src/lib/i18n.tsx para pt/es/en:
     - home.topicsOne / home.topicsMany (já existem para "assuntos")
     - home.subtopicsOne / home.subtopicsMany (novas para "subtópico/subtópicos")

4. Verificação
   - Garantir que os cards da tela inicial reflitam corretamente a hierarquia real.
   - Confirmar que a contagem não aparece como decimal ou valor negativo.

O que NÃO será alterado
- A estrutura de banco (tabelas subjects/topics) permanece a mesma.
- A navegação e ações (excluir, renomear) do card não mudam.
- A tela de detalhe da matéria (subjects.$subjectId) não é alterada, salvo se a contagem similar existir lá.
