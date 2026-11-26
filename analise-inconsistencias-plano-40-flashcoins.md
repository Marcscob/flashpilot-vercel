# Análise de inconsistências — Plano de 40 FlashCoins

**Documento analisado:** Plano Completo — Degustação de IA (40 FlashCoins & Recursos Pro) e Antifraude Gradual
**Data da análise:** 28/09/2026

O plano corrigiu vários pontos da versão anterior, especialmente a concessão inicial em zero, o limite de 8 imagens e o salvamento/cobrança transacionais. Ainda há inconsistências e lacunas importantes, sobretudo no tratamento de usuários Pro, na trava de concorrência e na prevenção de custos sem geração de cards.

| Prioridade | Ponto | Por que precisa ser resolvido |
|---|---|---|
| **Alta** | **A regra de geração parece limitar também usuários Pro.** O plano diz que o Pro tem IA ilimitada, mas a função `persist_cards_and_debit` deve conferir saldo e calcular o limite pelo espaço restante no acervo gratuito. | Especificar que saldo e teto de 100 cards se aplicam somente a contas gratuitas. O servidor deve verificar o plano atual; para Pro, não exigir FlashCoins nem aplicar o teto gratuito, se essa for a regra comercial. |
| **Alta** | **A trava expira em 3 minutos, mesmo que o processamento ainda esteja ativo.** | Uma geração que leve mais de 3 minutos pode perder a trava e permitir outra chamada simultânea. Definir a renovação da trava enquanto o trabalho estiver ativo e impedir que uma execução antiga continue depois que a trava for assumida por outra. |
| **Alta** | **Cobrar por card salvo não limita o custo de operações que não gerem cards.** A chamada de IA pode processar arquivos, imagens ou áudio e terminar sem cards gravados; nesse caso, não há débito de FlashCoins, embora haja custo de API. | Definir limites rígidos para tentativas, tokens de entrada e saída e custo por usuário/período, incluindo falhas e novas tentativas. A estimativa de US$ 0,022 não é, por si só, um limite de gasto. |
| **Alta** | **A idempotência está descrita para os blocos de cards, mas não para o kit e as cotas secundárias.** A prevenção de duplicidade no ledger protege o bônus de moedas, mas não deixa claro se uma repetição pode restabelecer mapas, formatações ou mensagens. | Tornar a concessão do kit e o consumo de cada cota atômicos e idempotentes no banco. Definir chaves únicas por usuário e operação para que uma repetição retorne o resultado anterior sem conceder ou consumir novamente. |
| **Média** | **A tela prevê até o saldo de FlashCoins, mas o servidor pode permitir menos cards.** O limite real também depende dos cards solicitados e do espaço restante no acervo. | Mostrar a quantidade máxima real: o menor valor entre saldo, espaço disponível e quantidade solicitada. |
| **Média** | **O limite de 2 contas por dispositivo não é um limite antifraude confiável sozinho.** O identificador fica no navegador; pode ser apagado ou alterado, permitindo apresentar um dispositivo diferente. | Tratar o hash apenas como sinal de risco, como o plano já sugere, sem prometer que impede a criação de contas adicionais. Especificar o que acontece quando o identificador falta ou não pode ser calculado. |
| **Média** | **A regra de áudio não define a que se referem os 45 segundos.** A oferta inclui áudio nativo, mas não diz se o limite vale para o áudio enviado pelo aluno, para a resposta em áudio do tutor ou para ambos. | Definir o limite de duração por entrada e por saída, e como uma tentativa de áudio é contabilizada quando a resposta falha ou é repetida. |
| **Média** | **Os limites de tamanho não estão completos para todos os formatos.** PDF tem limite de páginas, mas não há tamanho máximo de arquivo; para imagens, há limites individuais e agregados, mas o total efetivo é 25 MB — menor que 8 imagens de 5 MB cada. | Definir também o tamanho máximo do PDF e deixar explícito que, embora cada imagem possa ter até 5 MB, o conjunto enviado não pode ultrapassar 25 MB. |

## Conclusão

Antes de implementar, é importante fechar primeiro três regras: a separação entre limites gratuitos e Pro, a renovação segura da trava de processamento e os limites de custo para chamadas que não geram cards. Em seguida, especificar a idempotência das cotas e a experiência de áudio para que falhas e repetições não produzam cobranças ou consumos inconsistentes.
