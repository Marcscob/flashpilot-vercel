import type { Lang } from "./lang-match";

export type HomeHubTexts = {
  create: string;
  review: string;
  conversation: string;
  management: string;
  edit: string;
  reports: string;
};

export const HOME_HUB_DICTS: Record<Lang, { homeHub: HomeHubTexts }> = {
  pt: { homeHub: { create: "Criar múltiplos flashcards", review: "Revisar Flashcards", conversation: "Conversação", management: "Edição / Relatórios", edit: "Editar flashcards", reports: "Relatórios" } },
  "pt-PT": { homeHub: { create: "Criar múltiplos flashcards", review: "Rever Flashcards", conversation: "Conversação", management: "Edição / Relatórios", edit: "Editar flashcards", reports: "Relatórios" } },
  en: { homeHub: { create: "Create multiple flashcards", review: "Review Flashcards", conversation: "Conversation", management: "Editing / Reports", edit: "Edit flashcards", reports: "Reports" } },
  es: { homeHub: { create: "Crear múltiples flashcards", review: "Repasar Flashcards", conversation: "Conversación", management: "Edición / Informes", edit: "Editar flashcards", reports: "Informes" } },
  fr: { homeHub: { create: "Créer plusieurs flashcards", review: "Réviser les Flashcards", conversation: "Conversation", management: "Édition / Rapports", edit: "Modifier les flashcards", reports: "Rapports" } },
  it: { homeHub: { create: "Creare più flashcard", review: "Ripassare le Flashcard", conversation: "Conversazione", management: "Modifica / Rapporti", edit: "Modificare le flashcard", reports: "Rapporti" } },
  de: { homeHub: { create: "Mehrere Lernkarten erstellen", review: "Lernkarten wiederholen", conversation: "Konversation", management: "Bearbeitung / Berichte", edit: "Lernkarten bearbeiten", reports: "Berichte" } },
};