import { z } from "zod";

export const StudyNoteInput = z.object({
  actionId: z.string().uuid(),
  text: z.string().trim().min(40).max(20_000),
  lang: z.string().trim().min(2).max(40),
});