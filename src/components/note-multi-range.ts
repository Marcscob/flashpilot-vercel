import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export type Range = { from: number; to: number };

export const multiRangeKey = new PluginKey<Range[]>("noteMultiRange");

/**
 * Seleção múltipla estilo Word: o usuário seleciona um trecho, segura Ctrl/Cmd
 * e seleciona outro — o trecho anterior fica guardado e destacado. Os comandos
 * de formatação são aplicados a todos os trechos guardados + à seleção atual.
 */
export const MultiRange = Extension.create({
  name: "noteMultiRange",
  addProseMirrorPlugins() {
    return [
      new Plugin<Range[]>({
        key: multiRangeKey,
        state: {
          init: () => [],
          apply(tr: Transaction, value: Range[]) {
            const meta = tr.getMeta(multiRangeKey) as
              | { type: "add"; range: Range }
              | { type: "clear" }
              | undefined;

            let next = value.map((r) => ({
              from: tr.mapping.map(r.from),
              to: tr.mapping.map(r.to),
            })).filter((r) => r.to > r.from);

            if (meta?.type === "clear") return [];
            if (meta?.type === "add") {
              const { from, to } = meta.range;
              if (to > from && !next.some((r) => r.from === from && r.to === to)) {
                next = [...next, { from, to }];
              }
            }
            return next;
          },
        },
        props: {
          decorations(state: EditorState) {
            const ranges = multiRangeKey.getState(state) ?? [];
            if (!ranges.length) return null;
            return DecorationSet.create(
              state.doc,
              ranges.map((r) =>
                Decoration.inline(r.from, r.to, { class: "note-multisel" })
              )
            );
          },
          handleDOMEvents: {
            mousedown(view, event) {
              const e = event as MouseEvent;
              const sel = view.state.selection;
              if (e.ctrlKey || e.metaKey) {
                if (sel.from !== sel.to) {
                  view.dispatch(
                    view.state.tr.setMeta(multiRangeKey, {
                      type: "add",
                      range: { from: sel.from, to: sel.to },
                    })
                  );
                }
              } else if ((multiRangeKey.getState(view.state) ?? []).length) {
                view.dispatch(view.state.tr.setMeta(multiRangeKey, { type: "clear" }));
              }
              return false;
            },
            keydown(view, event) {
              if ((event as KeyboardEvent).key === "Escape") {
                view.dispatch(view.state.tr.setMeta(multiRangeKey, { type: "clear" }));
              }
              return false;
            },
          },
        },
      }),
    ];
  },
});

export function getMultiRanges(editor: Editor): Range[] {
  return multiRangeKey.getState(editor.state) ?? [];
}

export function clearMultiRanges(editor: Editor) {
  editor.view.dispatch(editor.state.tr.setMeta(multiRangeKey, { type: "clear" }));
}

/** Aplica um comando encadeado a todos os trechos guardados + à seleção atual. */
export function runOnRanges(editor: Editor, apply: (chain: any) => any) {
  const sel = editor.state.selection;
  const ranges = [...getMultiRanges(editor)];
  if (sel.from !== sel.to || !ranges.length) {
    ranges.push({ from: sel.from, to: sel.to });
  }
  let chain: any = editor.chain().focus();
  for (const r of ranges) {
    chain = apply(chain.setTextSelection(r));
  }
  chain.run();
}
