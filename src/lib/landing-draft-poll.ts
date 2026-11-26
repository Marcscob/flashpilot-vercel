/** A failed row may belong to the previous attempt until this request claims it. */
export function landingDraftPollOutcome(
  status: string,
  requestPendingAtRead: boolean,
  observedProcessing: boolean,
): "done" | "failed" | "wait" {
  if (status === "done") return "done";
  if (status === "missing") return "failed";
  if (status === "failed" && (!requestPendingAtRead || observedProcessing)) return "failed";
  return "wait";
}