import type { Expense, ID, Split } from "./types";

/**
 * Turn an expense's split rule into concrete per-person shares in minor units.
 * The returned shares ALWAYS sum to exactly `amount` (for valid input).
 *
 * Rounding policy: when an amount doesn't divide evenly, the leftover minor
 * units are handed out one at a time — first to the payer (if they share the
 * expense), then in participant order. The payer absorbing the odd cent is
 * the convention most groups already use ("I'll take the extra cent").
 */
export function computeShares(
  amount: number,
  split: Split,
  payerId: ID,
  order: ID[],
): Map<ID, number> {
  const out = new Map<ID, number>();
  if (split.mode === "exact") {
    for (const id of order) {
      const v = split.amounts[id];
      if (v) out.set(id, v);
    }
    // Ids not in `order` (removed participants) are still honoured.
    for (const [id, v] of Object.entries(split.amounts)) if (v && !out.has(id)) out.set(id, v);
    return out;
  }

  const weights = new Map<ID, number>();
  if (split.mode === "equal") {
    for (const id of sortByOrder(split.participantIds, order)) weights.set(id, 1);
  } else {
    for (const id of sortByOrder(Object.keys(split.shares), order)) {
      const w = split.shares[id];
      if (w > 0) weights.set(id, w);
    }
  }
  if (weights.size === 0) return out;

  return allocate(amount, weights, payerId);
}

/**
 * Largest-remainder allocation of an integer amount by weights.
 * Ties on the fractional remainder go to the payer first, then list order.
 */
export function allocate(amount: number, weights: Map<ID, number>, payerId?: ID): Map<ID, number> {
  const ids = [...weights.keys()];
  const total = ids.reduce((s, id) => s + weights.get(id)!, 0);
  const out = new Map<ID, number>();
  if (total <= 0) return out;

  let assigned = 0;
  const remainders: { id: ID; frac: number; idx: number }[] = [];
  ids.forEach((id, idx) => {
    const exact = (amount * weights.get(id)!) / total;
    const base = Math.floor(exact + 1e-9);
    out.set(id, base);
    assigned += base;
    remainders.push({ id, frac: exact - base, idx });
  });

  let left = amount - assigned;
  remainders.sort((a, b) => {
    if (Math.abs(b.frac - a.frac) > 1e-9) return b.frac - a.frac;
    if (a.id === payerId) return -1;
    if (b.id === payerId) return 1;
    return a.idx - b.idx;
  });
  for (let i = 0; left > 0; i = (i + 1) % remainders.length) {
    const r = remainders[i];
    out.set(r.id, out.get(r.id)! + 1);
    left--;
  }
  return out;
}

function sortByOrder(ids: ID[], order: ID[]): ID[] {
  const pos = new Map(order.map((id, i) => [id, i]));
  return [...new Set(ids)].sort((a, b) => (pos.get(a) ?? 1e9) - (pos.get(b) ?? 1e9));
}

export function sharesFor(expense: Expense, order: ID[]): Map<ID, number> {
  return computeShares(expense.amount, expense.split, expense.paidBy, order);
}

/** Who takes part in a split (regardless of mode). */
export function splitParticipants(split: Split): ID[] {
  if (split.mode === "equal") return split.participantIds;
  if (split.mode === "exact") return Object.keys(split.amounts).filter((id) => split.amounts[id] > 0);
  return Object.keys(split.shares).filter((id) => split.shares[id] > 0);
}

export type SplitError =
  | { code: "no-participants" }
  | { code: "exact-mismatch"; difference: number }
  | { code: "negative" }
  | { code: "bad-weight" };

/** Validate a split against an amount. Returns null when the split is valid. */
export function validateSplit(amount: number, split: Split): SplitError | null {
  if (split.mode === "equal") {
    return split.participantIds.length === 0 ? { code: "no-participants" } : null;
  }
  if (split.mode === "exact") {
    const values = Object.values(split.amounts);
    if (values.some((v) => v < 0 || !Number.isInteger(v))) return { code: "negative" };
    if (!values.some((v) => v > 0)) return { code: "no-participants" };
    const sum = values.reduce((s, v) => s + v, 0);
    return sum === amount ? null : { code: "exact-mismatch", difference: amount - sum };
  }
  const values = Object.values(split.shares);
  if (values.some((v) => !Number.isFinite(v) || v < 0)) return { code: "bad-weight" };
  if (!values.some((v) => v > 0)) return { code: "no-participants" };
  return null;
}
