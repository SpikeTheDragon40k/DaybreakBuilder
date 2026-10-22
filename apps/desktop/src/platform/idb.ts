/** Tiny promise wrapper over IndexedDB (available in browsers and in the Tauri webview). */

// Kept from before the rename to DaybreakBuilder so existing saved data stays readable.
const DB_NAME = "dndbuilder";
const DB_VERSION = 2;
export const STORES = ["packs", "packFiles", "characters", "parties"] as const;
export type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await open();
  return wrap(db.transaction(store, "readonly").objectStore(store).get(key)) as Promise<T | undefined>;
}

export async function idbPut<T>(store: StoreName, key: string, value: T): Promise<void> {
  const db = await open();
  await wrap(db.transaction(store, "readwrite").objectStore(store).put(value, key));
}

export async function idbDelete(store: StoreName, key: string): Promise<void> {
  const db = await open();
  await wrap(db.transaction(store, "readwrite").objectStore(store).delete(key));
}

export async function idbAll<T>(store: StoreName): Promise<T[]> {
  const db = await open();
  return wrap(db.transaction(store, "readonly").objectStore(store).getAll()) as Promise<T[]>;
}
