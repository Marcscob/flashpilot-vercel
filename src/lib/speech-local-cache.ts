import { TTS_CACHE_VOICE } from "./speech-cache-version";

export async function localSpeechKey(userId: string, text: string, lang: string, origin: string, voice = TTS_CACHE_VOICE) {
  const bytes = new TextEncoder().encode(JSON.stringify([userId, text, lang, origin, voice]));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

let database: Promise<IDBDatabase> | undefined;
function openCache(): Promise<IDBDatabase> {
  if (!database) {
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open("flashpilot-speech", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("audio");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Audio cache unavailable"));
    });
    void database.catch(() => { database = undefined; });
  }
  return database;
}

export async function readLocalSpeech(key: string): Promise<Blob | undefined> {
  try {
    const db = await openCache();
    return await new Promise((resolve, reject) => {
      const request = db.transaction("audio", "readonly").objectStore("audio").get(key);
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : undefined);
      request.onerror = () => reject(request.error);
    });
  } catch { return undefined; } // Private browsing/storage denial must not break narration.
}

export async function writeLocalSpeech(key: string, blob: Blob): Promise<void> {
  try {
    const db = await openCache();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("audio", "readwrite");
      transaction.objectStore("audio").put(blob, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch { /* Full/disabled storage falls back to the bounded session cache. */ }
}