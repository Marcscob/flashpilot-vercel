export const WEB_PAGES_BULK_MAX = 5;

/** Uma URL por linha (ou separada por espaço, vírgula ou ponto e vírgula), sem repetidas. */
export function parseWebUrls(value: string): string[] {
  return Array.from(new Set(value.split(/[\s,;]+/).map((part) => part.trim()).filter(Boolean)));
}
