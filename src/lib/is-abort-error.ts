export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) return error.name === "AbortError";
  if (error instanceof Error) {
    if (error.name === "AbortError") return true;
    if (error.cause && error.cause !== error) return isAbortError(error.cause);
  }
  return false;
}