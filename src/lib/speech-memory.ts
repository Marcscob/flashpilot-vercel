/** Object URLs are only a small working set; the actual library lives on disk/Cloud. */
export function createSpeechMemory(maxBytes = 12 * 1024 * 1024, maxEntries = 8) {
  const entries = new Map<string, { src: string; bytes: number }>();
  let bytes = 0;
  const clear = () => {
    for (const item of entries.values()) URL.revokeObjectURL(item.src);
    entries.clear();
    bytes = 0;
  };
  return {
    clear,
    get(key: string) {
      const item = entries.get(key);
      if (!item) return undefined;
      entries.delete(key);
      entries.set(key, item);
      return item.src;
    },
    put(key: string, blob: Blob, activeSrc?: string) {
      const existing = entries.get(key);
      if (existing) return existing.src;
      const src = URL.createObjectURL(blob);
      entries.set(key, { src, bytes: blob.size });
      bytes += blob.size;
      for (const [oldKey, item] of entries) {
        if (bytes <= maxBytes && entries.size <= maxEntries) break;
        if (item.src === activeSrc || oldKey === key) continue;
        URL.revokeObjectURL(item.src);
        entries.delete(oldKey);
        bytes -= item.bytes;
      }
      return src;
    },
  };
}