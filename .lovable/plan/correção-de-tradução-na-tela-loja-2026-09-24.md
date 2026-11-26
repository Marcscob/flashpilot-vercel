# Correção de tradução na tela Loja

## Problema confirmado
Na seção de FlashCoins, a descrição de cada cartão é exibida diretamente do catálogo de produtos. Como esse texto está salvo em português, ele permanece como “Moedas para usar os recursos de IA” mesmo quando a interface está em francês ou outro idioma.

## Correção
- Criar uma descrição curta e própria dos cartões de FlashCoins no catálogo de traduções da Loja.
- Preencher essa descrição corretamente em **pt-BR, pt-PT, inglês, espanhol, francês, italiano e alemão**.
- Na Loja, usar a descrição traduzida para produtos FlashCoins, em vez do texto português armazenado no produto.
- Aplicar o mesmo tratamento às descrições genéricas dos pacotes de matérias, preservando nomes próprios das matérias e dados comerciais.
- Manter preços, quantidades, checkout, saldo e regras de compra inalterados.

## Validação
- Trocar o idioma dentro da Loja e confirmar que título, descrição, quantidade, validade e botão de cada cartão mudam juntos.
- Verificar os sete idiomas, inclusive os cartões carregados dinamicamente.
- Conferir a Loja em computador e celular, sem quebra de layout.
- Confirmar que a compra continua abrindo o produto e preço corretos.
