/**
 * Versioned backup format for HydraBlue.
 *
 * `BackupV2` is the on-disk JSON shape for `Export to file` /
 * `Import from file`. The `version` field is the upgrade safety net — a
 * future BackupV3 can be auto-migrated, and unknown versions are
 * rejected cleanly instead of silently corrupting the store.
 *
 * Backups are always PLAINTEXT — they're meant to be portable across
 * devices. Encrypting them with the PIN would lock the user out of
 * their own data when they most need it (phone lost, restoring from a
 * cloud copy).
 */

import type { Entry } from "./db";
import type { Profile, ReminderConfig } from "./appEvents";

export const BACKUP_SCHEMA_VERSION = 2;

export type BackupV2Data = {
  entries: Entry[];
  profile: Profile;
  reminders: ReminderConfig;
  goalMl: number;
  hasCompletedOnboarding: boolean;
};

export type BackupV2 = {
  version: 2;
  /** ISO timestamp of the export. */
  createdAt: string;
  /** `package.json` version string. Surfaced in the UI on import. */
  hydraVersion: string;
  data: BackupV2Data;
};

export type HydraSnapshot = BackupV2Data;

export function buildBackup(
  snapshot: HydraSnapshot,
  hydraVersion: string,
): BackupV2 {
  return {
    version: BACKUP_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    hydraVersion,
    data: snapshot,
  };
}

/**
 * Strict-ish parse: reject anything that doesn't match the V2 shape.
 * We intentionally don't transitively validate every field — the
 * structural shape + version check is enough to catch the common
 * "wrong file" / "corrupted" cases without bloating the validator.
 */
export function parseBackup(
  raw: string,
): { ok: true; backup: BackupV2 } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Not a valid JSON file." };
  }
  if (!json || typeof json !== "object") {
    return { ok: false, error: "Backup file is empty or malformed." };
  }
  const obj = json as Record<string, unknown>;
  if (obj.version !== BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Unsupported backup version: ${String(obj.version)} (expected ${BACKUP_SCHEMA_VERSION}).`,
    };
  }
  const data = obj.data as Record<string, unknown> | undefined;
  if (!data) {
    return { ok: false, error: "Backup file is missing the data section." };
  }
  if (!Array.isArray(data.entries)) {
    return { ok: false, error: "Backup file has no entries array." };
  }
  if (typeof data.goalMl !== "number") {
    return { ok: false, error: "Backup file has no goalMl." };
  }
  if (typeof data.hasCompletedOnboarding !== "boolean") {
    return { ok: false, error: "Backup file has no onboarding flag." };
  }
  if (!data.profile || typeof data.profile !== "object") {
    return { ok: false, error: "Backup file has no profile." };
  }
  if (!data.reminders || typeof data.reminders !== "object") {
    return { ok: false, error: "Backup file has no reminders config." };
  }
  return { ok: true, backup: obj as unknown as BackupV2 };
}

/**
 * Trigger a browser download. Filename matches the convention used by
 * iOS / Android share sheets (date-stamped, no spaces).
 */
export function downloadBackup(backup: BackupV2): void {
  if (typeof document === "undefined") return;
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hydrablue-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so Safari has time to read the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readBackupFile(
  file: File,
): Promise<{ ok: true; backup: BackupV2 } | { ok: false; error: string }> {
  try {
    const raw = await file.text();
    return parseBackup(raw);
  } catch {
    return { ok: false, error: "Could not read the selected file." };
  }
}
