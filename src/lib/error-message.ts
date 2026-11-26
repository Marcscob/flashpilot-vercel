/**
 * Server functions and PostgREST can serialise errors as plain objects instead
 * of preserving the Error prototype. Read the useful message without exposing
 * an opaque "[object Object]" fallback to the user.
 */
export function getErrorMessage(raw: unknown, fallback = ""): string {
  const seen = new Set<object>();

  function read(value: unknown, depth: number): string[] {
    if (depth > 4 || value == null) return [];
    if (typeof value === "string") return value.trim() ? [value.trim()] : [];
    if (value instanceof Error) {
      const parts = value.message.trim() ? [value.message.trim()] : [];
      parts.push(...read(value.cause, depth + 1));
      return parts;
    }
    if (typeof value !== "object") return [];
    if (seen.has(value)) return [];
    seen.add(value);

    const record = value as Record<string, unknown>;
    return ["message", "error_description", "details", "error", "cause"].flatMap((key) =>
      read(record[key], depth + 1),
    );
  }

  const parts = [...new Set(read(raw, 0))];
  return parts.join(" | ") || fallback;
}
