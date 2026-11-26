# Auditoria da experiência de boas-vindas

**Data:** 4 de outubro de 2026  
**Escopo:** conteúdo da modal de boas-vindas e dos e-mails de cadastro/boas-vindas, comparado com as cotas e regras implementadas no app.

## Conclusão

As promessas de **40 FlashCoins, 2 mapas mentais, 3 formatações de notas e 15 turnos de conversa** correspondem às cotas previstas para o kit. A experiência, porém, precisa de ajustes para não sugerir benefícios ou prazos que não se aplicam a todas as contas.

## Verificação das promessas

| Promessa | Situação no código | Ajuste recomendado |
|---|---|---|
| 40 FlashCoins; até 40 flashcards com PilotAI | `grant_ai_welcome_kit` credita 40 FlashCoins. O texto de Termos registra o custo de 1 moeda por flashcard salvo. | Manter como máximo potencial, esclarecendo que gerar 40 cards pressupõe usar todas as moedas para isso. |
| Mais 60 flashcards manuais | O limite gratuito é de **100 cards no total**, somando cards manuais, importados e gerados com IA. O limite é aplicado pelo servidor. | Trocar a divisão fixa “40 com IA + 60 manuais” por “até 100 flashcards no total”, explicando as categorias incluídas. Os 60 só resultam da conta se a pessoa gerar 40 com IA e não tiver outros cards no acervo. |
| 2 mapas mentais | A concessão do kit define `maps_remaining = 2`; a geração de mapas usa a cota do servidor. | Manter. |
| Formatação de notas/apostilas | O kit define `formats_remaining = 3`. A modal e o bloco de boas-vindas não informam esse limite. | Informar que o kit inclui 3 formatações, se “construa suas apostilas” se refere a esse recurso. |
| 15 turnos com o tutor, incluindo “Repita depois de mim” | O kit define `chat_turns_remaining = 15`; o fluxo de chat aceita o modo `repeat` e consome cotas por turno. | Manter, de preferência chamando-os de “turnos de conversa” para explicitar a unidade. |
| Revisão inteligente e Telegram | A revisão de cards vencidos existe. Os lembretes por Telegram dependem de chat vinculado e alertas habilitados; o hook envia lembretes diários para contas configuradas. | Explicar que é necessário vincular o Telegram e ativar os alertas. A descrição com Telegram aparece em pt-BR, mas não de forma consistente nos demais idiomas. |
| Anotações, cadernos e ditado por voz | Os recursos existem. O ditado gratuito tem limite de 60 chamadas de transcrição por mês. | A promessa é válida; informar o limite mensal do ditado para não sugerir uso ilimitado. |
| Sem cartão de crédito/cobrança automática | O kit é separado da assinatura Pro e a concessão não cria uma assinatura paga. | Coerente com o fluxo implementado. A configuração operacional do provedor de pagamentos não foi validada nesta análise. |
| Continuar revisando após o teste | O diálogo de fim de teste informa que o material salvo continua disponível para revisão; criar conteúdo novo com PilotAI exige Pro. | Coerente com o comportamento descrito no app. |

## Divergências prioritárias

### O kit não é garantido para toda conta

A função `grant_ai_welcome_kit` pode recusar a concessão se o orçamento de IA não estiver habilitado e pronto para medição, se o e-mail ainda não estiver confirmado, se a conta já recebeu o kit ou se os limites antifraude de dispositivo/sub-rede forem atingidos. Apesar disso:

- a modal mostra o kit sem consultar se a concessão foi efetivada;
- o fluxo social envia o e-mail de boas-vindas mesmo quando a tentativa de concessão retorna `granted: false`;
- a cópia apresenta o kit como disponível ou como benefício de toda conta nova.

**Recomendação:** condicionar a exibição/envio à concessão efetiva ou usar uma mensagem que explique que o kit está sujeito à confirmação da conta e à elegibilidade.

### O prazo da modal pode ser inventado

Para contas anteriores a **1º de outubro de 2026**, `get_trial_status` retorna `trial_ends_at = NULL` por causa da regra de preservação das contas existentes. `getWelcomeModalState` não trata essa ausência como “sem período de teste”, e a modal calcula o fim como 15 dias a partir de hoje. O mesmo fallback pode ocorrer se a consulta do estado do teste falhar.

**Recomendação:** não exibir a modal de teste quando não houver uma data válida de término ou quando o usuário não estiver elegível ao teste.

### O e-mail não usa a data real de término

`TrialKitBlock` aceita `trialEndsAt`, mas tanto `SignupEmail` quanto `WelcomeEmail` o renderizam sem esse valor. Nesse caso, `trialEndLabel` calcula a data como 15 dias a partir do momento em que o e-mail é renderizado, em vez de usar a data real derivada da criação da conta. Isso pode divergir se a confirmação do cadastro atrasar ou se houver outro descompasso entre cadastro e envio.

**Recomendação:** obter e passar a data real do teste ao renderizar o e-mail; não calcular o vencimento a partir do horário de renderização.

## Fonte de conteúdo e manutenção

A modal e os e-mails usam `TRIAL_KIT` em `trial-kit-i18n.ts`, o que mantém o bloco principal compartilhado. `signup-i18n.ts` também contém listas próprias de benefícios, mas `SignupEmail` renderiza `TrialKitBlock`; essas listas duplicadas não são a fonte do conteúdo exibido e podem ficar desatualizadas.

## Arquivos principais verificados

- `src/components/WelcomeModal.tsx`
- `src/components/WelcomeKitBootstrap.tsx`
- `src/lib/welcome-modal.functions.ts`
- `src/lib/welcome-kit.functions.ts`
- `src/lib/email-templates/trial-kit-block.tsx`
- `src/lib/email-templates/trial-kit-i18n.ts`
- `src/lib/email-templates/signup.tsx`
- `src/lib/email-templates/welcome.tsx`
- `src/lib/email-templates/signup-i18n.ts`
- `src/lib/ai-credits.ts`
- `src/lib/ai-quota.server.ts`
- `src/lib/language-chat.functions.ts`
- `src/lib/notes-format.functions.ts`
- `src/lib/mindmap-generate.functions.ts`
- `src/lib/plan-limit.tsx`
- `supabase/migrations/20260929233349_15214c7b-4f89-461f-a8d9-4e0ee3cd46eb.sql`
- `supabase/migrations/20261004161658_4413d3d4-968e-4e2d-aba4-6df607eb1e44.sql`
- `supabase/migrations/20261003160000_trial_regression_fixes.sql`

## Limites da análise

Esta é uma verificação estática do código e das migrations do repositório. Não confirma se as migrations estão aplicadas no banco de produção, se os limites de IA estão habilitados no ambiente ativo ou se as integrações externas estão configuradas corretamente. Nenhum comportamento foi alterado durante esta auditoria.
