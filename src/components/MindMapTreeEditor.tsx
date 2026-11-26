import { Input } from "@/components/ui/input";
import { T } from "@/lib/i18n-ui";
import type { MindMapNode } from "@/lib/mindmap-render";

export function MindMapTreeEditor({ nodes, onChange }: {
  nodes: MindMapNode[];
  onChange: (nodes: MindMapNode[]) => void;
}) {
  return <div className="space-y-2">
    {nodes.map((node, index) => <div key={index} className="space-y-2 border-l border-border pl-3">
      <Input aria-label={T("Editar") + ` ${index + 1}`} maxLength={90} value={node.label}
        onChange={(event) => onChange(nodes.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} />
      {node.children?.length ? <MindMapTreeEditor nodes={node.children}
        onChange={(children) => onChange(nodes.map((item, i) => i === index ? { ...item, children } : item))} /> : null}
    </div>)}
  </div>;
}