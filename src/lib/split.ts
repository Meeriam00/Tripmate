import type { ID, SplitMethod } from "./types";

/**
 * Splitting an expense into per-person shares, in whole minor units.
 * Every function here returns shares that add up to exactly the amount.
 */

/** Order used to hand out leftover cents: the payer first, then trip order. */
function payerFirst(ids: ID[], payerId: ID, order: ID[]): ID[] {
  const pos = new Map(order.map((id, i) => [id, i]));
  return [...new Set(ids)].sort((a, b) => {
    if (a === payerId) return -1;
    if (b === payerId) return 1;
    return (pos.get(a) ?? 1e9) - (pos.get(b) ?? 1e9);
  });
}

/**
 * Equal split. 10,00 € among three, paid by Leyla → Leyla 3,34 €, the others
 * 3,33 €: leftover cents go one at a time to the payer, then in trip order.
 */
export function equalShares(amount: number, participantIds: ID[], payerId: ID, order: ID[]): Record<ID, number> {
  const ids = payerFirst(participantIds, payerId, order);
  const out: Record<ID, number> = {};
  if (ids.length === 0) return out;
  const base = Math.floor(amount / ids.length);
  let left = amount - base * ids.length;
  for (const id of ids) {
    out[id] = base + (left > 0 ? 1 : 0);
    if (left > 0) left--;
  }
  return out;
}

/**
 * Percentage split. `basisPoints` must add up to 10 000 (= 100%). Each share
 * is rounded down, then the leftover cents go to the largest fractional
 * remainders (ties: payer first, then trip order) — the largest remainder
 * method, so the result is as close to the requested percentages as possible.
 */
export function percentShares(
  amount: number,
  basisPoints: Record<ID, number>,
  payerId: ID,
  order: ID[],
): Record<ID, number> {
  const ids = payerFirst(
    Object.keys(basisPoints).filter((id) => basisPoints[id] > 0),
    payerId,
    order,
  );
  const out: Record<ID, number> = {};
  const rema: { id: ID; r: number; i: number }[] = [];
  let given = 0;
  ids.forEach((id, i) => {
    const exact = amount * basisPoints[id];
    const whole = Math.floor(exact / 10_000);
    out[id] = whole;
    given += whole;
    rema.push({ id, r: exact - whole * 10_000, i });
  });
  rema.sort((a, b) => b.r - a.r || a.i - b.i);
  for (let k = 0; given < amount && k < rema.length; k++, given++) out[rema[k].id] += 1;
  return out;
}

export interface SplitInput {
  amount: number;
  method: SplitMethod;
  payerId: ID;
  participantIds: ID[];
  /** Custom method: exact amounts per member. */
  custom?: Record<ID, number>;
  /** Percent method: basis points per member. */
  percents?: Record<ID, number>;
  order: ID[];
}

export type SplitResult =
  | { ok: true; shares: Record<ID, number>; percents: Record<ID, number> | null }
  | { ok: false; error: string };

/**
 * Validate and compute an expense split. Errors are Azerbaijani sentences,
 * ready to show next to the form.
 */
export function computeSplit(input: SplitInput): SplitResult {
  const { amount, method, payerId, order } = input;
  const ids = [...new Set(input.participantIds)];
  if (!Number.isSafeInteger(amount) || amount <= 0) return { ok: false, error: "Məbləğ sıfırdan böyük olmalıdır." };
  if (ids.length === 0) return { ok: false, error: "Ən azı bir iştirakçı seçin." };

  if (method === "equal") {
    return { ok: true, shares: equalShares(amount, ids, payerId, order), percents: null };
  }

  if (method === "custom") {
    const custom = input.custom ?? {};
    const shares: Record<ID, number> = {};
    for (const id of ids) {
      const v = custom[id] ?? 0;
      if (!Number.isSafeInteger(v) || v < 0) return { ok: false, error: "Məbləğlər mənfi ola bilməz." };
      if (v > 0) shares[id] = v;
    }
    const diff = amount - Object.values(shares).reduce((s, v) => s + v, 0);
    if (diff !== 0) return { ok: false, error: diff > 0 ? "Fərdi məbləğlərin cəmi xərcdən azdır." : "Fərdi məbləğlərin cəmi xərcdən çoxdur." };
    if (Object.keys(shares).length === 0) return { ok: false, error: "Ən azı bir iştirakçıya məbləğ yazın." };
    return { ok: true, shares, percents: null };
  }

  const pct = input.percents ?? {};
  const bp: Record<ID, number> = {};
  for (const id of ids) {
    const v = pct[id] ?? 0;
    if (!Number.isSafeInteger(v) || v < 0) return { ok: false, error: "Faizlər mənfi ola bilməz." };
    if (v > 0) bp[id] = v;
  }
  const total = Object.values(bp).reduce((s, v) => s + v, 0);
  if (total !== 10_000) return { ok: false, error: total < 10_000 ? "Faizlərin cəmi 100%-dən azdır." : "Faizlərin cəmi 100%-dən çoxdur." };
  return { ok: true, shares: percentShares(amount, bp, payerId, order), percents: bp };
}

/** "33,33" → 3333 basis points; null if not a valid 0–100 percentage with ≤ 2 decimals. */
export function parsePercent(input: string): number | null {
  const s = input.trim().replace("%", "").replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null;
  const [w, f = ""] = s.split(".");
  const bp = Number(w) * 100 + Number((f + "00").slice(0, 2));
  return bp <= 10_000 ? bp : null;
}

/** 3333 → "33,33" */
export function formatPercent(bp: number): string {
  const w = Math.floor(bp / 100);
  const f = bp % 100;
  return f === 0 ? String(w) : `${w},${String(f).padStart(2, "0").replace(/0$/, "")}`;
}

/** Spread 100% as evenly as possible (in basis points) — the starting point for the percent form. */
export function evenPercents(ids: ID[]): Record<ID, number> {
  const out: Record<ID, number> = {};
  if (!ids.length) return out;
  const base = Math.floor(10_000 / ids.length);
  let left = 10_000 - base * ids.length;
  for (const id of ids) {
    out[id] = base + (left > 0 ? 1 : 0);
    if (left > 0) left--;
  }
  return out;
}
