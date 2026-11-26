# IA formatadora de anotações + apostila em PDF

## O que será construído

1. **Formatar com IA (nota única)** — botão no editor de anotações que reescreve o texto em padrão didático de apostila (títulos T1/T2/T3, listas, destaques, tabelas quando fizer sentido), com pré-visualização lado a lado e opção de aplicar ou descartar.
2. **Formatar em lote por categoria** — na lista de anotações, escolher uma categoria e formatar todas as notas dela, com barra de progresso, resultado por nota e possibilidade de cancelar.
3. **Gerar apostila em PDF** — compilar várias notas (de uma categoria ou seleção manual) em um único documento com capa, sumário, cabeçalho/rodapé e numeração de páginas, pronto para impressão.

## Padrão de formatação aplicado pela IA

- **T1 (20px)** para o tema principal da nota; **T2 (18px)** para seções; **T3 (16px)** para subseções.
- Parágrafos curtos, listas com marcadores para enumerações, tabelas para comparações.
- Blocos de destaque (citação) para "Atenção", "Pegadinha de concurso" e "Referência (Lei Seca)".
- Conteúdo pode ser reorganizado e resumido para fins didáticos (conforme escolhido), mas nunca inventando fatos: a IA recebe instrução explícita de só reorganizar/esclarecer o que já está na nota.
- Imagens e tabelas existentes são preservadas.

## Segurança e reversibilidade

- Antes de aplicar, o HTML original é guardado na própria nota, permitindo **Desfazer formatação** por 1 clique.
- No lote, nada é gravado sem confirmação final; falhas em notas individuais não interrompem as demais.

## Detalhes técnicos

| Item | Abordagem |
|---|---|
| Modelo | Lovable AI (`google/gemini-3.7-flash`) via `createServerFn` em `src/lib/notes-format.functions.ts` |
| Saída | HTML restrito ao subconjunto já suportado pelo editor (`p`, `span.note-h1/2/3`, `ul/ol/li`, `blockquote`, `table`, `img`, `hr`) |
| Sanitização | Reaproveitar/estender `normalizeNoteHtml` em `src/lib/note-format.ts` para descartar tags fora da whitelist |
| Nota única | Botão na toolbar de `src/routes/_authenticated/notes.tsx` + diálogo de pré-visualização |
| Lote | Diálogo novo `src/components/BulkFormatNotesDialog.tsx`; processamento sequencial (1 nota por requisição) para respeitar limites do gateway, com backoff em 429 e mensagem clara em 402/403 |
| Reverter | Nova coluna `content_html_backup` em `notes` (migração com GRANT e política RLS por usuário) |
| PDF | Geração no cliente com `@react-pdf`/impressão via folha de estilo dedicada `@media print` (A4, margens 2cm, fontes serifadas para corpo), rota `/apostila` que renderiza as notas selecionadas e aciona a impressão/salvar como PDF |
| Sumário | Montado a partir dos T1/T2 detectados no HTML formatado |
| Cópia | A tela da apostila respeita o bloqueio de cópia já existente no app |

## Ordem de entrega

1. Migração (`content_html_backup`) + server function de formatação.
2. Botão "Formatar com IA" na nota + pré-visualização + desfazer.
3. Formatação em lote por categoria.
4. Tela/rota de apostila com capa, sumário e layout de impressão.
