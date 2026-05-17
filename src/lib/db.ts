/**
 * IndexedDB wrapper for HydraBlue.
 *
 * Layout:
 *   - store "kv":      key/value (device_id, profile, goal, reminders, reminderQueue)
 *   - store "entries": auto-id intake entries, indexed by atIso for range queries
 *
 * No external deps — uses the native IDB API. ~80 LOC.
 * Mirrors `profile`, `goal`, and `reminders` to localStorage on every write
 * as a belt-and-suspenders fallback for iOS Safari eviction.
 */

export type Entry = {
  id: string;
  ml: number;
  label: string;
  atIso: string;
};

const DB_NAME = "hydrablue";
const DB_VERSION = 1;
const KV_STORE = "kv";
const ENTRIES_STORE = "entries";

const MIRROR_KEYS = new Set(["profile", "goal", "reminders"]);

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KV_STORE)) {
        db.createObjectStore(KV_STORE);
      }
      if (!db.objectStoreNames.contains(ENTRIES_STORE)) {
        const s = db.createObjectStore(ENTRIES_STORE, { keyPath: "id" });
        s.createIndex("atIso", "atIso", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        let result: T | undefined;
        const req = fn(s);
        if (req) req.onsuccess = () => (result = req.result);
        t.oncomplete = () => resolve(result as T);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return tx<T | undefined>(KV_STORE, "readonly", (s) =>
    s.get(key) as IDBRequest<T | undefined>,
  );
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  await tx<void>(KV_STORE, "readwrite", (s) => {
    s.put(value as unknown, key);
  });
  if (MIRROR_KEYS.has(key) && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(`hb_${key}`, JSON.stringify(value));
    } catch {
      // localStorage may be unavailable in private mode — silently degrade
    }
  }
}

export async function entriesAll(): Promise<Entry[]> {
  return tx<Entry[]>(ENTRIES_STORE, "readonly", (s) =>
    s.getAll() as IDBRequest<Entry[]>,
  );
}

export async function entryAdd(entry: Entry): Promise<void> {
  await tx<void>(ENTRIES_STORE, "readwrite", (s) => {
    s.put(entry);
  });
}

export async function entryRemove(id: string): Promise<void> {
  await tx<void>(ENTRIES_STORE, "readwrite", (s) => {
    s.delete(id);
  });
}

export async function entriesClear(): Promise<void> {
  await tx<void>(ENTRIES_STORE, "readwrite", (s) => {
    s.clear();
  });
}

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await kvGet<string>("device_id");
  if (existing) return existing;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await kvSet("device_id", id);
  return id;
}
