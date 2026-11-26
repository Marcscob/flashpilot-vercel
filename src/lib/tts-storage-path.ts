/** Storage keys must not include free-form language labels or serialized objects. */
export function ttsStoragePath(key: string): string {
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("Invalid audio cache hash");
  return `${key.slice(0, 2)}/${key}.wav`;
}