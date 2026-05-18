/**
 * IndexedDB wrapper for HydraBlue.
 *
 * Layout:
 *   - store "kv":      key/value (device_id, profile, goal, reminders,
 *                      reminderQueue, pinMeta)
 *   - store "entries": auto-id intake entries, indexed by atIso for range
 *                      queries
 *
 * Encryption-at-rest:
 *   When a session key is registered via `setSessionKey`, every value
 *   written to either store is transparently AES-GCM encrypted (and the
 *   localStorage mirror is suppressed so plaintext doesn't leak there).
 *   When the key is null, values are stored plain — matches the no-PIN
 *   path. Two kv keys are ALWAYS plaintext regardless of the session
 *   key, since they must be readable before unlock: `device_id` and
 *   `pinMeta`.
 *
 * No external deps — uses the native IDB API.
 * Mirrors `profile`, `goal`, and `reminders` to localStorage on every
 * write as a belt-and-suspenders fallback for iOS Safari eviction. The
 * mirror is intentionally skipped when encryption is on.
 */

import {
  decryptString,
  encryptString,
  isCryptoAvailable,
} from "./crypto";

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

const MIRROR_KEYS = new Set([
  "profile",
  "goal",
  "reminders",
  "reminderQueue",
]);

const ALWAYS_PLAIN_KEYS = new Set(["device_id", "pinMeta"]);

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Session encryption key. Set by useHydraStore after `pin/set` or a
 * successful `pin/unlock`; cleared on `pin/clear` or `data/reset`.
 * Lives in module scope so kvGet/kvSet/entry* can transparently wrap
 * values without every caller threading the key through.
 */
let sessionKey: CryptoKey | null = null;

export function setSessionKey(key: CryptoKey | null): void {
  sessionKey = key;
}

export function hasSessionKey(): boolean {
  return sessionKey !== null;
}

/** Wire format for an encrypted IDB value. */
type EncryptedEnvelope = { __enc: 1; c: string };

function isEncryptedEnvelope(v: unknown): v is EncryptedEnvelope {
  return (
    !!v &&
    typeof v === "object" &&
    (v as { __enc?: unknown }).__enc === 1 &&
    typeof (v as { c?: unknown }).c === "string"
  );
}

async function maybeEncrypt(value: unknown): Promise<unknown> {
  if (sessionKey === null || !isCryptoAvailable()) return value;
  const plaintext = JSON.stringify(value);
  const c = await encryptString(sessionKey, plaintext);
  const env: EncryptedEnvelope = { __enc: 1, c };
  return env;
}

async function maybeDecrypt<T>(value: unknown): Promise<T | undefined> {
  if (value === undefined) return undefined;
  if (!isEncryptedEnvelope(value)) return value as T;
  if (sessionKey === null || !isCryptoAvailable()) {
    // Encrypted blob but no key — surface as undefined so the store
    // shows the locked / empty state instead of crashing.
    return undefined;
  }
  const plain = await decryptString(sessionKey, value.c);
  if (plain === null) return undefined;
  try {
    return JSON.parse(plain) as T;
  } catch {
    return undefined;
  }
}

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
  const raw = await tx<unknown>(KV_STORE, "readonly", (s) =>
    s.get(key) as IDBRequest<unknown>,
  );
  if (ALWAYS_PLAIN_KEYS.has(key)) {
    return raw as T | undefined;
  }
  return maybeDecrypt<T>(raw);
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  const writeValue: unknown = ALWAYS_PLAIN_KEYS.has(key)
    ? (value as unknown)
    : await maybeEncrypt(value);
  await tx<void>(KV_STORE, "readwrite", (s) => {
    s.put(writeValue, key);
  });
  // Suppress the localStorage mirror when encryption is active — we
  // don't want plaintext leaking to a less-protected store.
  if (
    sessionKey === null &&
    MIRROR_KEYS.has(key) &&
    typeof localStorage !== "undefined"
  ) {
    try {
      localStorage.setItem(`hb_${key}`, JSON.stringify(value));
    } catch {
      // localStorage may be unavailable in private mode — silently degrade
    }
  }
}

/**
 * Plain-only kv access used by `reencryptAll`. Bypasses the session key
 * entirely so the migration can read every row regardless of which key
 * (if any) was used to encrypt it.
 */
async function kvGetRaw(key: string): Promise<unknown> {
  return tx<unknown>(KV_STORE, "readonly", (s) =>
    s.get(key) as IDBRequest<unknown>,
  );
}

async function kvSetRaw(key: string, value: unknown): Promise<void> {
  await tx<void>(KV_STORE, "readwrite", (s) => {
    s.put(value, key);
  });
}

async function kvKeys(): Promise<string[]> {
  return tx<string[]>(KV_STORE, "readonly", (s) =>
    s.getAllKeys() as IDBRequest<string[]>,
  );
}

export async function entriesAll(): Promise<Entry[]> {
  const rows = await tx<unknown[]>(ENTRIES_STORE, "readonly", (s) =>
    s.getAll() as IDBRequest<unknown[]>,
  );
  const out: Entry[] = [];
  for (const row of rows) {
    if (isEncryptedEntryRow(row)) {
      const plain = await maybeDecrypt<Entry>(row.payload);
      if (plain) out.push({ ...plain, id: row.id });
      continue;
    }
    out.push(row as Entry);
  }
  return out;
}

/** Encrypted entry row wire format: `{ id, payload: EncryptedEnvelope }`. */
type EncryptedEntryRow = { id: string; payload: EncryptedEnvelope };

function isEncryptedEntryRow(v: unknown): v is EncryptedEntryRow {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as { id?: unknown }).id === "string" &&
    isEncryptedEnvelope((v as { payload?: unknown }).payload)
  );
}

async function buildEntryRow(entry: Entry): Promise<Entry | EncryptedEntryRow> {
  if (sessionKey === null || !isCryptoAvailable()) return entry;
  const env = (await maybeEncrypt(entry)) as EncryptedEnvelope;
  return { id: entry.id, payload: env };
}

export async function entryAdd(entry: Entry): Promise<void> {
  const row = await buildEntryRow(entry);
  await tx<void>(ENTRIES_STORE, "readwrite", (s) => {
    s.put(row);
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

/**
 * Walk every encrypted row, decrypt under `oldKey`, re-encrypt under
 * `newKey`, and write back. Called when enabling, disabling, or
 * changing the PIN. Either key may be null (null = plaintext side).
 *
 * Implementation runs outside the regular session-key path: we
 * temporarily swap `sessionKey` for old/new and use kvGetRaw/kvSetRaw
 * to avoid double-encrypting. All work happens in a single pass over
 * the kv store + the entries store.
 */
export async function reencryptAll(
  oldKey: CryptoKey | null,
  newKey: CryptoKey | null,
): Promise<void> {
  const previous = sessionKey;
  try {
    // 1) kv store
    const keys = await kvKeys();
    for (const k of keys) {
      if (ALWAYS_PLAIN_KEYS.has(k)) continue;
      const raw = await kvGetRaw(k);
      // Decrypt with old key
      sessionKey = oldKey;
      const plain = await maybeDecrypt<unknown>(raw);
      if (plain === undefined) continue;
      // Encrypt with new key
      sessionKey = newKey;
      const next = await maybeEncrypt(plain);
      await kvSetRaw(k, next);
      // Drop the localStorage mirror — fresh value lands via the normal
      // kvSet path next time the user writes.
      if (MIRROR_KEYS.has(k) && typeof localStorage !== "undefined") {
        try {
          localStorage.removeItem(`hb_${k}`);
        } catch {
          // ignore
        }
      }
    }
    // 2) entries store
    const rows = await tx<unknown[]>(ENTRIES_STORE, "readonly", (s) =>
      s.getAll() as IDBRequest<unknown[]>,
    );
    for (const row of rows) {
      let plainEntry: Entry | undefined;
      if (isEncryptedEntryRow(row)) {
        sessionKey = oldKey;
        plainEntry = await maybeDecrypt<Entry>(row.payload);
      } else {
        plainEntry = row as Entry;
      }
      if (!plainEntry) continue;
      sessionKey = newKey;
      const next = await buildEntryRow(plainEntry);
      await tx<void>(ENTRIES_STORE, "readwrite", (s) => {
        s.put(next);
      });
    }
  } finally {
    sessionKey = previous;
  }
}

/**
 * Wipe both IDB stores and the localStorage mirror. Used by
 * "Forgot PIN — reset all data" and the explicit "Reset all data"
 * setting. After this resolves, callers typically reload the page so
 * the store re-hydrates from a clean slate.
 */
export async function resetAllData(): Promise<void> {
  await Promise.all([
    tx<void>(KV_STORE, "readwrite", (s) => {
      s.clear();
    }),
    tx<void>(ENTRIES_STORE, "readwrite", (s) => {
      s.clear();
    }),
  ]);
  if (typeof localStorage !== "undefined") {
    try {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith("hb_")) localStorage.removeItem(k);
      }
    } catch {
      // ignore
    }
  }
}
