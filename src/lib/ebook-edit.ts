/** UI eligibility only; database RLS remains the write authority. */
export function canEditEbook(userId: string | null | undefined, subjectOwner: string | null | undefined, rowOwner: string | null | undefined): boolean {
  return Boolean(userId && userId === subjectOwner && userId === rowOwner);
}

export type EbookEditTarget =
  | { table: "subjects"; field: "name"; id: string }
  | { table: "topics"; field: "name"; id: string }
  | { table: "microcontexts"; field: "title" | "content"; id: string }
  | { table: "flashcards"; field: "question" | "answer"; id: string };

export const ebookEditKey = (target: EbookEditTarget) => `${target.table}:${target.id}:${target.field}`;