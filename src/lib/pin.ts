/**
 * PIN setup, verification, and metadata persistence.
 *
 * The PIN itself is NEVER stored anywhere. Instead we store a `PinMeta`
 * object with a salt and a `verifyToken` — the constant string
 * `"HYDRABLUE_OK"` encrypted with the key derived from the PIN. On
 * verify, we re-derive the key from the entered PIN + stored salt and
 * attempt to decrypt the token; if it decrypts to the constant, the PIN
 * was correct.
 *
 * Forgot PIN = unrecoverable. The UI offers "Reset all data" as the only
 * recovery path.
 */

import {
  b64decode,
  deriveKey,
  encryptString,
  decryptString,
  randomSaltB64,
} from "./crypto";

const VERIFY_CONST = "HYDRABLUE_OK";

export type PinMeta = {
  enabled: boolean;
  /** Base64 PBKDF2 salt. Empty string when `enabled` is false. */
  salt: string;
  /** Base64 AES-GCM ciphertext of VERIFY_CONST. Empty when disabled. */
  verifyToken: string;
};

export const NO_PIN: PinMeta = {
  enabled: false,
  salt: "",
  verifyToken: "",
};

/**
 * Treat `pin` as a 4-digit numeric PIN. Reject anything else early so we
 * don't silently accept e.g. trimmed whitespace or short codes.
 */
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/**
 * Derive a key from the given PIN, encrypt VERIFY_CONST with it, and
 * return both the new `PinMeta` (for persistence) and the live key (the
 * caller — `useHydraStore` — keeps it in memory for the session).
 */
export async function setPin(
  pin: string,
): Promise<{ meta: PinMeta; key: CryptoKey }> {
  if (!isValidPin(pin)) {
    throw new Error("PIN must be 4 digits");
  }
  const saltB64 = randomSaltB64();
  const key = await deriveKey(pin, b64decode(saltB64));
  const verifyToken = await encryptString(key, VERIFY_CONST);
  return {
    meta: { enabled: true, salt: saltB64, verifyToken },
    key,
  };
}

/**
 * Try to unlock with the entered PIN. Returns the key on success, null
 * on mismatch. We do not differentiate "wrong PIN" from "decryption
 * error" — both look the same to the caller, which matches the threat
 * model (don't leak whether the token blob is valid).
 */
export async function verifyPin(
  pin: string,
  meta: PinMeta,
): Promise<CryptoKey | null> {
  if (!meta.enabled) return null;
  if (!isValidPin(pin)) return null;
  try {
    const key = await deriveKey(pin, b64decode(meta.salt));
    const plain = await decryptString(key, meta.verifyToken);
    return plain === VERIFY_CONST ? key : null;
  } catch {
    return null;
  }
}
