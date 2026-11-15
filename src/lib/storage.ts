import { addDays, isISO, todayISO } from "./dates";
import { sampleTrip, upcomingTrip } from "./sample";
import { CATEGORIES, type Trip } from "./types";

/**
 * Trips live in this browser's localStorage. v3 adds dates, categories,
 * custom splits, budget and payments; v2 data (the previous version of the
 * app) is migrated automatically the first time v3 loads.
 */
export const STORAGE_KEY = "tripmate:v3";
const V2_KEY = "tripmate:v2";

export interface Saved {
  trips: Trip[];
}

export type LoadResult = { ok: true; state: Saved } | { ok: false };

const fresh = (): Saved => ({ trips: [upcomingTrip(), sampleTrip()] });

export function loadState(): LoadResult {
  let raw: string | null = null;
  let legacy: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) legacy = localStorage.getItem(V2_KEY);
  } catch {
    return { ok: true, state: fresh() };
  }
  if (raw === null && legacy === null) return { ok: true, state: fresh() };
  try {
    const parsed = JSON.parse((raw ?? legacy)!);
    if (!parsed || !Array.isArray(parsed.trips)) throw new Error();
    const trips = (parsed.trips as unknown[]).map(normalize).filter((t): t is Trip => t !== null);
    return { ok: true, state: { trips } };
  } catch {
    return { ok: false };
  }
}

export function saveState(state: Saved): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 3, ...state }));
    return true;
  } catch {
    return false;
  }
}

/** Validate a stored trip and fill in fields older versions didn't have. */
function normalize(x: unknown): Trip | null {
  if (!x || typeof x !== "object") return null;
  const t = x as Record<string, unknown>;
  if (typeof t.id !== "string" || typeof t.name !== "string" || !Array.isArray(t.participants) || !Array.isArray(t.expenses)) return null;
  const created = typeof t.createdAt === "number" ? t.createdAt : Date.now();
  const createdDay = new Date(created).toISOString().slice(0, 10);
  const startDate = isISO(t.startDate as string) ? (t.startDate as string) : createdDay;
  const endDate = isISO(t.endDate as string) && (t.endDate as string) >= startDate ? (t.endDate as string) : startDate;
  const expenses = (t.expenses as Record<string, unknown>[])
    .filter((e) => e && Number.isInteger(e.amount) && typeof e.paidBy === "string" && Array.isArray(e.participantIds))
    .map((e) => ({
      id: String(e.id),
      title: String(e.title ?? ""),
      amount: e.amount as number,
      paidBy: e.paidBy as string,
      participantIds: e.participantIds as string[],
      custom: e.custom && typeof e.custom === "object" ? (e.custom as Record<string, number>) : undefined,
      category: (CATEGORIES as readonly string[]).includes(e.category as string) ? (e.category as Trip["expenses"][number]["category"]) : "other",
      date: isISO(e.date as string) ? (e.date as string) : new Date(typeof e.createdAt === "number" ? e.createdAt : created).toISOString().slice(0, 10),
      note: typeof e.note === "string" && e.note ? e.note : undefined,
      createdAt: typeof e.createdAt === "number" ? e.createdAt : created,
    }));
  return {
    id: t.id,
    name: t.name,
    destination: typeof t.destination === "string" ? t.destination : "",
    startDate,
    endDate,
    currency: typeof t.currency === "string" ? t.currency : "AZN",
    budget: Number.isInteger(t.budget) && (t.budget as number) > 0 ? (t.budget as number) : undefined,
    participants: (t.participants as { id: string; name: string }[]).map((p) => ({ id: String(p.id), name: String(p.name) })),
    expenses,
    payments: Array.isArray(t.payments) ? (t.payments as Trip["payments"]).filter((p) => Number.isInteger(p.amount) && p.amount > 0) : [],
    activity: Array.isArray(t.activity)
      ? (t.activity as Trip["activity"]).filter((a) => a && typeof a.title === "string" && typeof a.at === "number")
      : expenses.map((e) => ({ id: `a-${e.id}`, kind: "add" as const, title: e.title, amount: e.amount, at: e.createdAt })).sort((a, b) => b.at - a.at),
    createdAt: created,
    updatedAt: typeof t.updatedAt === "number" ? t.updatedAt : created,
  };
}

export function uid(prefix = ""): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}${Date.now().toString(36)}${rand}`;
}

/** Default dates for a new trip: today to three days later. */
export function defaultTripDates() {
  const start = todayISO();
  return { startDate: start, endDate: addDays(start, 3) };
}
