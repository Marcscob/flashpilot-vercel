const DB_NAME = "flashpilot-bulk-demo";
const STORE_NAME = "drafts";
const DRAFT_KEY = "active";
const FALLBACK_KEY = "flashpilot:bulk-demo:draft";

export type BulkDemoFile = {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  extractedText?: string;
};

export type BulkDemoDraft = {
  version: 1;
  actionId: string;
  fullName?: string;
  email: string;
  guidance?: string;
  imagePilot?: boolean;
  destination?: {
    subject: string;
    topic: string;
  };
  mode: "files" | "text" | "youtube" | "web";
  youtubeUrl?: string;
  webUrl?: string;
  text: string;
  files: BulkDemoFile[];
  createdAt: number;
};

function canUseIndexedDb(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB unavailable"));
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  return openDatabase().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const request = operation(transaction.objectStore(STORE_NAME));
        transaction.oncomplete = () => {
          db.close();
          if (!request) resolve(undefined);
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error ?? new Error("IndexedDB transaction failed"));
        };
        if (request) {
          request.onsuccess = () => {
            db.close();
            resolve(request.result);
          };
          request.onerror = () => {
            db.close();
            reject(request.error ?? new Error("IndexedDB request failed"));
          };
        }
      }),
  );
}

export async function saveBulkDemoDraft(draft: BulkDemoDraft): Promise<void> {
  if (typeof window === "undefined") return;
  if (canUseIndexedDb()) {
    try {
      await withStore("readwrite", (store) => store.put(draft, DRAFT_KEY));
      return;
    } catch (error) {
      console.error("Failed to save landing draft to IndexedDB", error);
    }
  }
  try {
    sessionStorage.setItem(FALLBACK_KEY, JSON.stringify(draft));
  } catch (error) {
    console.error("Failed to save landing draft to session storage", error);
    throw new Error("Não foi possível preservar seu material no navegador.");
  }
}

export async function loadBulkDemoDraft(): Promise<BulkDemoDraft | null> {
  if (typeof window === "undefined") return null;
  if (canUseIndexedDb()) {
    try {
      const draft = await withStore<BulkDemoDraft | undefined>("readonly", (store) =>
        store.get(DRAFT_KEY),
      );
      if (draft) return draft;
    } catch (error) {
      console.error("Failed to load landing draft from IndexedDB", error);
    }
  }
  try {
    const raw = sessionStorage.getItem(FALLBACK_KEY);
    return raw ? (JSON.parse(raw) as BulkDemoDraft) : null;
  } catch (error) {
    console.error("Failed to load landing draft from session storage", error);
    return null;
  }
}

export async function clearBulkDemoDraft(): Promise<void> {
  if (typeof window === "undefined") return;
  if (canUseIndexedDb()) {
    try {
      await withStore("readwrite", (store) => store.delete(DRAFT_KEY));
    } catch (error) {
      console.error("Failed to clear landing draft from IndexedDB", error);
    }
  }
  try {
    sessionStorage.removeItem(FALLBACK_KEY);
  } catch (error) {
    console.error("Failed to clear landing draft from session storage", error);
  }
}
