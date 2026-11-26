# Auditoria de segurança — FlashPilot

**Data:** 4 de outubro de 2026<br>
**Escopo:** revisão estática da aplicação, das funções de servidor, dos fluxos de cron/webhook e das migrations Supabase.<br>
**Estado:** correções preparadas nesta branch; a migration ainda precisa ser aplicada ao banco.

## Resumo

Foram identificados e corrigidos quatro problemas confirmados de acesso ou privacidade:

1. A inscrição pública na newsletter permitia definir o token de confirmação.
2. O acesso direto à tabela de comentários permitia contornar os limites contra spam e apagar o histórico usado por esses limites.
3. O registro direto de uso de flashcards permitia falsificar a métrica da auditoria comunitária.
4. A leitura pública das avaliações expunha o identificador de quem avaliou.

As respostas dos hooks de cron também foram reduzidas a dados agregados para evitar expor identificadores e informações individuais em logs. Nenhuma migration foi executada em produção.

## Achados

| # | Severidade | Arquivo e linhas | Achado e correção |
|---|------------|-----------------|-------------------|
| 1 | 🟡 MÉDIA | `supabase/migrations/20261004170000_harden_public_writes.sql:3-5`; `src/lib/blog.functions.ts:288-318` | Grants públicos permitiam enviar um `confirmation_token` escolhido pelo cliente e contornar a dupla confirmação. A escrita agora é feita pelo servidor, que gera o token; a resposta é uniforme para inscrições novas e existentes. |
| 2 | 🟡 MÉDIA | `supabase/migrations/20261004170000_harden_public_writes.sql:16-22`; `src/lib/blog.functions.ts:361-423` | Acesso direto a `blog_comments` permitia contornar o cooldown e o limite diário, além de apagar registros usados na contagem. A tabela agora é acessível apenas pelo servidor. A exclusão pelo usuário oculta o comentário e limpa o texto, preservando o registro mínimo necessário aos limites. |
| 3 | 🟡 MÉDIA | `supabase/migrations/20261004170000_harden_public_writes.sql:8-11`; `src/lib/flashcards.functions.ts:96-110` | A inserção direta em `flashcard_usage` permitia registrar uso de cards sem uma revisão validada. A escrita agora ocorre pelo servidor após a revisão. |
| 4 | ⚪ BAIXA | `supabase/migrations/20261004170000_harden_public_writes.sql:24-28`; `src/lib/blog.functions.ts:426-464` | A leitura pública de `blog_ratings` expunha o identificador do avaliador. O acesso público foi limitado às colunas `post_id` e `stars`; a leitura individual e as gravações passam pelos handlers autenticados. |
| 5 | ⚪ BAIXA | `src/routes/api/public/hooks/trial-nudge-daily.ts:61-140`; `src/routes/api/public/hooks/telegram-daily.ts:49-117` | As respostas dos hooks incluíam IDs e dados individuais que poderiam parar em logs de execução. Agora retornam resultados agregados e erros genéricos. |

## Risco condicional não confirmado

O fallback SSR em `src/lib/sanitize-html.ts` usa regex em vez de um parser HTML robusto e não oferece a mesma garantia do DOMPurify no navegador. Não foi confirmada uma exploração por conteúdo controlado por usuários: os artigos são administrados por pessoas autorizadas e as notas são privadas. Uma substituição segura exige escolher um sanitizador compatível com o runtime SSR/Cloudflare; essa mudança não foi feita nesta rodada.

## Validação e limitações

- `git diff --check`: passou.
- ESLint nos arquivos alterados: passou com as regras de formatação CRLF e `no-explicit-any` desativadas por problemas preexistentes.
- `tsc --noEmit`: bloqueado por `qrcode` ausente em `node_modules` e um `implicit any` preexistente em `src/routes/_authenticated/settings.tsx`.
- `npm audit`: não executado; o repositório possui `bun.lock`, não `package-lock.json`, e Bun não está disponível no ambiente.
- Validação local das migrations: indisponível; `psql`, Supabase CLI e Docker não estão instalados.
- Os valores de arquivos `.env` não foram lidos. A inspeção anterior verificou apenas nomes de variáveis.

## Próxima etapa de implantação

Aplicar `supabase/migrations/20261004170000_harden_public_writes.sql` no Supabase e publicar junto com as alterações dos handlers. Até a aplicação da migration, as permissões antigas ainda podem permitir acesso direto às tabelas.
