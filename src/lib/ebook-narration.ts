import { chapterHeading, type Ebook, type EbookExercise } from "./ebook";

/** Read the current book order, keeping solutions in the final answer key only. */
export function ebookNarration(book: Ebook, plainText: (html: string) => string): string {
  const exerciseText = (items: EbookExercise[]) => items.length
    ? ["Exercícios", ...items.map((e) => `${e.number}. ${e.question}`)] : [];
  const answers: EbookExercise[] = [];
  const parts = [book.title];
  for (const chapter of book.chapters) {
    parts.push(chapterHeading(chapter), plainText(chapter.html));
    for (const section of chapter.sections) {
      parts.push(`${section.number} - ${section.title}`, plainText(section.html), ...exerciseText(section.exercises));
      answers.push(...section.exercises);
    }
    parts.push(...exerciseText(chapter.exercises));
    answers.push(...chapter.exercises);
  }
  if (answers.length) parts.push("Gabarito comentado", ...answers.map((e) => `${e.number}. ${e.answer}`));
  return parts.filter(Boolean).join("\n\n");
}