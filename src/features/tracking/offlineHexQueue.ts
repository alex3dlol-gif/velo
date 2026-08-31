export type QueuedHexReveal = {
  id?: number;
  h3Index: string;
  revealedAt: number;
  synced: boolean;
};

const DB_NAME = "veilo-tracking";
const DB_VERSION = 1;
const STORE = "hex-queue";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("synced", "synced", { unique: false });
        store.createIndex("h3Index", "h3Index", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

export async function queueHexReveal(h3Index: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const entry: Omit<QueuedHexReveal, "id"> = {
    h3Index,
    revealedAt: Date.now(),
    synced: false,
  };
  await withStore("readwrite", (store) => store.add(entry));
}

export async function getPendingReveals(): Promise<QueuedHexReveal[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const all = (req.result as QueuedHexReveal[]).filter((e) => !e.synced);
      resolve(all);
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function markSynced(ids: number[]): Promise<void> {
  if (ids.length === 0 || typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const id of ids) {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const row = getReq.result as QueuedHexReveal | undefined;
        if (row) store.put({ ...row, synced: true });
      };
    }
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/** Синхронизация очереди при появлении сети (заглушка API — помечает как synced). */
export async function flushOfflineQueue(): Promise<number> {
  if (!navigator.onLine) return 0;
  const pending = await getPendingReveals();
  if (pending.length === 0) return 0;

  const ids = pending.map((p) => p.id).filter((id): id is number => id != null);
  await markSynced(ids);
  return pending.length;
}

export function installOfflineSyncListener(onFlushed?: (count: number) => void): () => void {
  const handler = () => {
    void flushOfflineQueue().then((count) => {
      if (count > 0) onFlushed?.(count);
    });
  };

  window.addEventListener("online", handler);
  if (navigator.onLine) handler();

  return () => window.removeEventListener("online", handler);
}
