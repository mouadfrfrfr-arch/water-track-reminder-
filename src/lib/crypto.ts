/**
 * Thin SubtleCrypto wrapper for HydraBlue.
 *
 * No external dependencies — uses the native `crypto.subtle` API
 * available in modern browsers and the Capacitor Android WebView.
 *
 * All functions are no-ops when `crypto.subtle` is missing (e.g. SSR);
 * callers should always check `isCryptoAvailable()` before invoking.
 *
 * Design choices:
 *  - PBKDF2-HMAC-SHA256, 100,000 iterations: matches OWASP 2023 floor,
 *    deliberately slow to make a 4-digit PIN brute-force less trivial.
 *  - AES-GCM, 12-byte random IV per encrypt: 256-bit key, authenticated
 *    ciphertext — tampering returns `null` from `decryptString`.
 *  - Base64 wire format: `[iv(12 bytes) | ciphertext(N bytes)]` joined,
 *    then standard base64 encoded. Single string per value.
 */

export const PBKDF2_ITERATIONS = 100_000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
export const KEY_BITS = 256;

export function isCryptoAvailable(): boolean {
  return (
    typeof crypto !== "undefined" &&
    typeof crypto.subtle !== "undefined"
  );
}

export function randomSaltB64(): string {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  return b64encode(salt);
}

export function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return typeof btoa === "function"
    ? btoa(s)
    : Buffer.from(bytes).toString("base64");
}

export function b64decode(b64: string): Uint8Array {
  const s = typeof atob === "function"
    ? atob(b64)
    : Buffer.from(b64, "base64").toString("binary");
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

/**
 * Derive an AES-GCM CryptoKey from a (PIN, salt) pair via PBKDF2.
 * The returned key is marked non-extractable so the raw bytes can't be
 * exported back out of the WebCrypto layer.
 */
export async function deriveKey(
  pin: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const pinBytes = new TextEncoder().encode(pin);
  const baseKey = await crypto.subtle.importKey(
    "raw",
    pinBytes as BufferSource,
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: KEY_BITS },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt `plaintext` with `key` using AES-GCM and a fresh random IV.
 * Output is a single base64 string: `[iv(12) | ciphertext(N+tag)]`.
 */
export async function encryptString(
  key: CryptoKey,
  plaintext: string,
): Promise<string> {
  const iv = new Uint8Array(IV_BYTES);
  crypto.getRandomValues(iv);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      new TextEncoder().encode(plaintext) as BufferSource,
    ),
  );
  const out = new Uint8Array(iv.length + ciphertext.length);
  out.set(iv, 0);
  out.set(ciphertext, iv.length);
  return b64encode(out);
}

/**
 * Decrypt a base64 string produced by `encryptString`. Returns `null` on
 * AES-GCM tag mismatch (wrong key / tampered ciphertext) or any other
 * decryption error.
 */
export async function decryptString(
  key: CryptoKey,
  b64: string,
): Promise<string | null> {
  try {
    const buf = b64decode(b64);
    if (buf.length <= IV_BYTES) return null;
    const iv = buf.slice(0, IV_BYTES);
    const ciphertext = buf.slice(IV_BYTES);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}
