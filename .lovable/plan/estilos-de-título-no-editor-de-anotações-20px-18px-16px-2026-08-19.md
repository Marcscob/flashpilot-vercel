# Estilos de título no editor de anotações (20px / 18px / 16px)

## Resumo

Adicionar 3 botões de estilo de título na barra de ferramentas do `RichTextEditor`. O usuário seleciona uma frase e clica em um dos botões: o editor aplica o tamanho de fonte correspondente, negrito, e um pequeno espaçamento inferior. Sem IA, sem geração de texto — apenas formatação.

## Comportamento

- **Título 1** → 20px, negrito, `margin-bottom: 0.6em`
- **Título 2** → 18px, negrito, `margin-bottom: 0.5em`
- **Título 3** → 16px, negrito, `margin-bottom: 0.4em`
- Aplica ao texto selecionado (ou à linha atual se nada selecionado)
- Funcam como toggle: clicar de novo remove o estilo e volta ao parágrafo normal
- Respeita o padrão sans-serif já configurado no editor

## Implementação

### 1. CSS — `src/styles.css`

Adicionar 3 classes utilitárias para os títulos:

```css
.note-h1 { font-size: 20px; font-weight: 700; margin-bottom: 0.6em; }
.note-h2 { font-size: 18px; font-weight: 700; margin-bottom: 0.5em; }
.note-h3 { font-size: 16px; font-weight: 700; margin-bottom: 0.4em; }
```

### 2. TipTap — `src/components/RichTextEditor.tsx`

Criar 3 extensões customizadas simples baseadas em parágrafo (não heading nativo, que conflita com o padrão atual de sem negrito em títulos). Usar `Paragraph.extend` com `addAttributes` para classe CSS e `addCommands` para toggle:

```ts
const NoteH1 = Paragraph.extend({
  name: "noteH1",
  addAttributes: () => ({ class: { default: "note-h1" } }),
  addCommands: () => ({ setNoteH1: () => ({ commands }) => commands.setNode("noteH1") }),
});
```

Registrar `NoteH1`, `NoteH2`, `NoteH3` nas extensões do editor.

### 3. Toolbar — `src/components/RichTextEditor.tsx`

Adicionar 3 botões após o bloco de formatação (antes do divisor de lista), com rótulos "T1", "T2", "T3" e tooltips "Título 1 (20px)", "Título 2 (18px)", "Título 3 (16px)". Cada botão chama o comando setNoteHx correspondente. O estado `active` destaca quando o cursor está em um parágrafo daquele nível.

### 4. Normalização — `src/lib/note-format.ts`

Garantir que `normalizeNoteHtml` preserve as classes `note-h1`, `note-h2`, `note-h3` nos parágrafos (adicionar à whitelist de classes permitidas).

## Arquivos a editar

| Arquivo | Ação |
|---|---|
| `src/styles.css` | Adicionar classes `.note-h1/2/3` |
| `src/components/RichTextEditor.tsx` | Criar 3 extensões + 3 botões na toolbar |
| `src/lib/note-format.ts` | Permitir classes note-h* na normalização |

## Validação

- Selecionar uma frase no editor, clicar T1 → fica 20px negrito com espaço abaixo
- Clicar T2 → troca para 18px
- Salvar a nota, reabrir → estilo persiste
- Verificar que o autosave e a normalização não removem os estilos
