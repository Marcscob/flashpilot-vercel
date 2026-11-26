/**
 * Textos do bloqueio de exclusão de matérias adquiridas (pacotes oficiais),
 * nos 7 idiomas suportados.
 */
import type { Lang } from "./lang-match";

type PurchasedDict = {
  /** Selo mostrado no card/cabeçalho da matéria adquirida */
  badge: string;
  /** Aviso curto no lugar do botão de excluir */
  cannotDelete: string;
  /** Aviso para itens (assuntos, cards, anotações) de matéria adquirida */
  cannotDeleteItem: string;
};

export const PURCHASED_TEXTS: Record<Lang, PurchasedDict> = {
  pt: {
    badge: "Adquirida",
    cannotDelete: "Matéria de um pacote adquirido: não pode ser excluída.",
    cannotDeleteItem: "Item de um pacote adquirido: não pode ser excluído.",
  },
  "pt-PT": {
    badge: "Adquirida",
    cannotDelete: "Matéria de um pacote adquirido: não pode ser eliminada.",
    cannotDeleteItem: "Item de um pacote adquirido: não pode ser eliminado.",
  },
  es: {
    badge: "Adquirida",
    cannotDelete: "Materia de un paquete adquirido: no se puede eliminar.",
    cannotDeleteItem: "Elemento de un paquete adquirido: no se puede eliminar.",
  },
  en: {
    badge: "Purchased",
    cannotDelete: "This subject belongs to a purchased pack and cannot be deleted.",
    cannotDeleteItem: "This item belongs to a purchased pack and cannot be deleted.",
  },
  fr: {
    badge: "Achetée",
    cannotDelete: "Matière issue d'un pack acheté : elle ne peut pas être supprimée.",
    cannotDeleteItem: "Élément issu d'un pack acheté : il ne peut pas être supprimé.",
  },
  it: {
    badge: "Acquistata",
    cannotDelete: "Materia di un pacchetto acquistato: non può essere eliminata.",
    cannotDeleteItem: "Elemento di un pacchetto acquistato: non può essere eliminato.",
  },
  de: {
    badge: "Gekauft",
    cannotDelete: "Dieses Fach gehört zu einem gekauften Paket und kann nicht gelöscht werden.",
    cannotDeleteItem: "Dieses Element gehört zu einem gekauften Paket und kann nicht gelöscht werden.",
  },
};

export function usePurchasedTexts(lang: Lang): PurchasedDict {
  return PURCHASED_TEXTS[lang] ?? PURCHASED_TEXTS.en;
}
