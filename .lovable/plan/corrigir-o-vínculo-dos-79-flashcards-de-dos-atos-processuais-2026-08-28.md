# Corrigir o vínculo dos 79 flashcards de “Dos Atos Processuais - Geral 2”

## Diagnóstico confirmado

A categoria **“Dos Atos Processuais - Geral 2”** contém 1 anotação e referencia 79 flashcards. Ela já foi transformada em assunto dentro de **Direito Processual Civil**, porém esse novo assunto está com 0 cards.

Os 79 cards continuam classificados nos assuntos anteriores:

- 57 em “Dos Atos Processuais-Forma, Tempo e Lugar”
- 13 em “Reconvenção”
- 7 em “Da Citação - Cartas - Intimações”
- 2 em “Das Nulidades”

Como a categoria já está marcada como espelho oficial, o botão **Vincular** deixa de aparecer. O resultado é um vínculo visual na árvore de Anotações sem a correspondente classificação dos cards na árvore de Flashcards.

## Correção

1. **Reclassificar os 79 cards existentes**
   - Atualizar `topic_id` dos cards associados à anotação/categoria para o assunto oficial “Dos Atos Processuais - Geral 2”.
   - Preservar integralmente perguntas, respostas, revisões, favoritos, imagens, links e vínculo com a anotação.

2. **Tornar o vínculo consistente e repetível**
   - Ajustar a operação de vínculo no banco para sempre sincronizar o `topic_id` de todos os cards associados, inclusive quando a categoria já tiver `topic_id`/`subject_id` e precisar ser ressincronizada.
   - Fazer a operação considerar tanto cards ligados diretamente pela categoria de imagem quanto cards ligados às anotações da categoria, sem duplicar nem apagar cards.

3. **Oferecer recuperação na interface**
   - Nas categorias espelhadas que possuem cards fora do assunto oficial, exibir uma ação de **Sincronizar flashcards**.
   - Mostrar a quantidade que será movida e pedir confirmação antes da alteração.
   - Após concluir, atualizar imediatamente as árvores/listagens de Anotações e Flashcards.

4. **Validar o resultado**
   - Confirmar no banco que o assunto oficial passou de 0 para 79 cards e que nenhum card foi perdido.
   - Conferir na tela de Flashcards que selecionar Direito Processual Civil → “Dos Atos Processuais - Geral 2” lista os 79 cards.
   - Testar um novo vínculo para garantir que os cards sejam classificados corretamente já na primeira operação.

## Detalhes técnicos

- A correção dos dados existentes será feita por atualização direcionada, limitada ao usuário e à categoria confirmados.
- A função `link_note_category_to_official` será reforçada para cobrir vínculo inicial e ressincronização.
- A interface de Anotações detectará divergência entre a categoria oficial e o `topic_id` dos cards associados antes de oferecer a ação corretiva.
