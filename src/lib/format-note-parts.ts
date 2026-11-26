import { splitNoteHtml } from "@/lib/note-chunks";
import type { AiBillingReceipt } from "@/lib/ai-quota.server";
import { getErrorMessage } from "@/lib/error-message";

type PartFn = (args: {
  data: {
    actionId: string;
    title: string;
    partIndex: number;
    totalParts: number;
    totalChars: number;
    chunk: string;
  };
}) => Promise<{ html: string; billing?: AiBillingReceipt | null; billingHoldId?: string }>;

export type FormatNoteProgress = { done: number; total: number };

/** Formats a note part by part (one request each). Resume with `startAt`/`previous`. */
export async function formatNoteInParts(
  fn: PartFn,
  input: { actionId: string; title: string; html: string },
  onProgress?: (p: FormatNoteProgress, partial: string[]) => void,
  resume?: { startAt: number; previous: string[] },
  onBilling?: (receipt: AiBillingReceipt) => void,
): Promise<string> {
  const parts = splitNoteHtml(input.html);
  const totalChars = parts.reduce((sum, part) => sum + part.length, 0);
  const out = resume ? [...resume.previous] : [];
  onProgress?.({ done: out.length, total: parts.length }, out);
  for (let i = resume?.startAt ?? 0; i < parts.length; i++) {
    try {
      const r = await fn({
        data: {
          actionId: input.actionId,
          title: input.title,
          partIndex: i,
          totalParts: parts.length,
          // Soma real das partes: blocos grandes são reembrulhados com tags ao dividir.
          totalChars,
          chunk: parts[i]!,
        },
      });
      out.push(r.html);
      if (r.billing) onBilling?.(r.billing);
    } catch (e) {
      throw new FormatPartError(getErrorMessage(e, "Falha"), i, out, parts.length);
    }
    onProgress?.({ done: out.length, total: parts.length }, out);
  }
  return out.join("\n");
}

export class FormatPartError extends Error {
  constructor(
    message: string,
    readonly partIndex: number,
    readonly previous: string[],
    readonly total: number,
  ) {
    super(message);
  }
}
