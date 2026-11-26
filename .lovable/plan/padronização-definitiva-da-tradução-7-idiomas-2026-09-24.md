# Padronização definitiva da tradução (7 idiomas)

Objetivo: parar de depender de auditorias manuais. Todo texto visível passa a vir de um catálogo único e tipado, e o próprio sistema acusa textos fixos ou traduções faltando antes de publicar.

## Segurança
- Trabalho feito em um rascunho (draft) separado; o app publicado não muda até você aprovar.
- Só a camada de textos da interface é alterada. Banco de dados, pagamentos, preços, rotas e permissões ficam intactos.
- Acentos e caracteres especiais (ç, ã, ä, ö, ü, ß) preservados.
- Idioma resolvido antes da tela aparecer, sem piscar português.

## Regra fixa: idioma da interface e idioma do conteúdo são separados
- **Idioma da interface** (botões, menus, avisos): só muda os textos do app. Nunca muda a voz, o ditado nem a conversa.
- **Idioma da matéria/card**: o card usa o próprio idioma; sem idioma, herda o da matéria; sem nenhum, fica no comportamento normal em português.
- **Voz e ditado** seguem sempre o idioma do conteúdo (ou da conversa), nunca o da interface. Sem voz no aparelho, usa a voz na nuvem no mesmo idioma.
- **Conversação** tem seu próprio idioma (da matéria ou escolhido na tela); a IA e a voz seguem esse idioma.
- A padronização mexe só na primeira camada. As outras três não são alteradas, e a verificação final confere, por exemplo: interface em espanhol + matéria em inglês = voz e ditado em inglês.

## Etapas

### 1. Catálogo único e tipado
- Unificar os arquivos de tradução atuais num único catálogo organizado por tela, tendo o português do Brasil como referência.
- Os outros 6 idiomas passam a ser obrigados a ter todas as chaves: se faltar uma em alemão, por exemplo, a verificação falha e aponta qual.
- Migração feita por tela, reaproveitando as traduções já existentes (nada é traduzido do zero sem necessidade).

### 2. Telas e janelas com texto fixo
- Substituir os textos escritos direto nas telas por chaves do catálogo, priorizando janelas, listas de opções, menus suspensos e avisos (os que hoje escapam da tradução automática).
- Ordem: menu e rodapé, Início, Matéria/Assunto (inclui janela de transferência), Anotações, Flashcards, Estudo, Batelada, Relatórios/PDF, Loja, Planos, Minha conta, Conversação, Configurações, páginas legais e cookies, Painel.

### 3. Tradutor automático antigo em modo reserva
- O mecanismo atual que "varre" a tela continua ligado só como reserva para telas ainda não migradas e é desligado ao final, quando tudo estiver no catálogo.

### 4. Travas automáticas
- Regra que acusa texto fixo em botões, rótulos, dicas e campos, indicando arquivo e linha.
- Verificação de chaves faltando em qualquer idioma.
- Relatório de auditoria: chaves sem uso, chaves sem tradução e textos suspeitos.

### 5. Verificação
- Percorrer as telas principais em francês, alemão e demais idiomas, no computador e celular, incluindo abertura de janelas e listas, confirmando zero texto em idioma errado.

## Cobertura obrigatória (checklist da verificação)
Tudo abaixo precisa responder ao idioma escolhido, sem exceção:
- Dicas ao passar o mouse, janelas (incluindo as que abrem depois de carregar dados), rótulos, opções de listas, menus e submenus, rodapé, avisos de sucesso/erro, telas vazias, textos de campos, confirmações e títulos da aba do navegador.
- Trocar o idioma com uma janela ou lista aberta atualiza os textos na hora.

## Idioma automático pelo país
- Na primeira visita, o app escolhe o idioma pelo país/idioma do navegador (ex.: Brasil = pt-BR, Portugal = pt-PT, Espanha/América Latina = es, França = fr, Itália = it, Alemanha/Áustria = de; demais = inglês).
- Depois que o aluno escolhe um idioma, essa escolha prevalece e fica salva na conta.
- Verificação: simular navegadores de cada país e confirmar o idioma aplicado já na primeira tela, sem piscar outro idioma.

## Observações
- Nomes de idiomas, marcas (Flash Pilot, FlashCoins, Pro) e conteúdo criado por você não são traduzidos.
- É um trabalho grande; será executado em blocos, com o app funcionando ao fim de cada bloco.

## Detalhes técnicos
- Novo `src/lib/i18n/` com `pt-BR.ts` como mestre; `export type TranslationSchema = typeof ptBR`; demais locales tipados `: TranslationSchema` (pt-PT pode usar `DeepPartial` + merge sobre pt-BR, explicitamente permitido). `useT()` mantém a API atual para evitar quebra; os módulos antigos (`i18n-screens`, `-bulk`, `-commerce`, `-extra`, `-panel`, `-profile`, `-purchased`, `-audit`, `-locales`, `-microcopy`) viram reexports temporários e depois são removidos.
- `useUiMicrocopy` recebe flag para desligar por rota migrada; removido no fim.
- Lint: `eslint-plugin-i18next` `no-literal-string` em modo `jsx-text-only` + atributos `placeholder`, `title`, `aria-label`, `label`; ignorar `src/components/ui/*` só para classes/estrutura.
- `scripts/audit-i18n.ts` (bun) varre `src/routes` e `src/components`, cruza com o catálogo e gera relatório.
- `export-report-pdf.ts` recebe rótulos por parâmetro; `head()` das rotas mantém títulos por idioma quando aplicável.
- Execução em draft via criação de rascunho do projeto.
