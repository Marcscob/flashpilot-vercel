/** Decode text bytes: strict UTF-8 (BOM stripped), else Windows-1252 so legacy Portuguese files keep accents. */
export function decodeTextBytes(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export async function readTextFile(file: Blob): Promise<string> {
  return decodeTextBytes(await file.arrayBuffer());
}
