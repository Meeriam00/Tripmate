import { sampleTrip } from "./sample";
import type { Trip } from "./types";

/** Trips are saved in this browser's localStorage under one versioned key. */
export const STORAGE_KEY = "tripmate:v2";

export interface Saved {
  trips: Trip[];
}

export type LoadResult = { ok: true; state: Saved } | { ok: false };

export function loadState(): LoadResult {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { ok: true, state: { trips: [sampleTrip()] } };
  }
  if (raw === null) return { ok: true, state: { trips: [sampleTrip()] } };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.trips)) throw new Error();
    return { ok: true, state: { trips: parsed.trips.filter(isTrip) } };
  } catch {
    return { ok: false };
  }
}

export function saveState(state: Saved): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 2, trips: state.trips }));
    return true;
  } catch {
    return false;
  }
}

function isTrip(t: unknown): t is Trip {
  if (!t || typeof t !== "object") return false;
  const x = t as Record<string, unknown>;
  return (
    typeof x.id === "string" &&
    typeof x.name === "string" &&
    Array.isArray(x.participants) &&
    Array.isArray(x.expenses) &&
    (x.expenses as Record<string, unknown>[]).every(
      (e) => e && Number.isInteger(e.amount) && typeof e.paidBy === "string" && Array.isArray(e.participantIds),
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
