import { sampleTrip } from "./sample";
import type { Trip } from "./types";

/**
 * Persistence. No backend: trips live in the browser's localStorage under a
 * single versioned key. Reads validate shape so a corrupt or foreign value
 * produces a recoverable error instead of a crash.
 */
export const STORAGE_KEY = "tripmate:v1";

export interface PersistedState {
  version: 1;
  trips: Trip[];
}

export type LoadResult =
  | { ok: true; state: PersistedState; firstRun: boolean }
  | { ok: false; error: string; raw: string | null };

export function loadState(): LoadResult {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { ok: true, state: { version: 1, trips: [sampleTrip()] }, firstRun: true };
  }
  if (raw === null) return { ok: true, state: { version: 1, trips: [sampleTrip()] }, firstRun: true };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.trips)) throw new Error("Unexpected format");
    const trips = (parsed.trips as unknown[]).filter(isTrip);
    return { ok: true, state: { version: 1, trips }, firstRun: false };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unreadable data", raw };
  }
}

export function saveState(state: PersistedState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function isTrip(t: unknown): t is Trip {
  if (!t || typeof t !== "object") return false;
  const x = t as Record<string, unknown>;
  return (
    typeof x.id === "string" &&
    typeof x.name === "string" &&
    typeof x.currency === "string" &&
    Array.isArray(x.participants) &&
    Array.isArray(x.expenses) &&
    Array.isArray(x.payments) &&
    (x.expenses as Record<string, unknown>[]).every(
      (e) => e && typeof e.amount === "number" && Number.isInteger(e.amount) && typeof e.paidBy === "string" && !!e.split,
    )
  );
}

export function uid(prefix = ""): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}${Date.now().toString(36)}${rand}`;
}
