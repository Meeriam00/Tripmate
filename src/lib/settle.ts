import type { ID } from "./types";

export interface Transfer {
  from: ID;
  to: ID;
  amount: number;
}

/**
 * Exact search handles groups up to this many people with a non-zero
 * balance (2^18 ≈ 262k states, a few ms). Larger groups fall back to the
 * greedy heuristic, which is never worse than n − 1 transfers.
 */
const EXACT_LIMIT = 18;

/**
 * Settle a set of balances with the fewest possible transfers.
 *
 * Every settlement of n non-zero balances needs at least n − k transfers,
 * where k is the largest number of disjoint groups whose balances each sum
 * to zero (each group can be settled internally with size − 1 transfers,
 * and no transfer plan can do better). We find k exactly with a dynamic
 * programme over subsets, then settle each group with a greedy pass.
 *
 * Example: Maryam +100, Murad +50, Ali −50, Leyla −100 splits into
 * {Ali, Murad} and {Leyla, Maryam}, so two transfers suffice instead of three.
 *
 * Input balances must sum to zero. Zero balances are ignored, so a person
 * who is square never appears in the result.
 */
export function minimizeTransfers(balances: Map<ID, number> | Record<ID, number>, order?: ID[]): Transfer[] {
  const entries = (balances instanceof Map ? [...balances.entries()] : Object.entries(balances)).filter(
    ([, v]) => v !== 0,
  );
  const sum = entries.reduce((s, [, v]) => s + v, 0);
  if (sum !== 0) throw new Error(`Balances must sum to zero (got ${sum})`);
  if (entries.length === 0) return [];

  // Stable, human-friendly ordering: biggest amounts first, then trip order.
  const pos = new Map((order ?? []).map((id, i) => [id, i]));
  entries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]) || (pos.get(a[0]) ?? 0) - (pos.get(b[0]) ?? 0));

  const groups = entries.length <= EXACT_LIMIT ? zeroSumGroups(entries) : [entries];
  const transfers: Transfer[] = [];
  for (const g of groups) transfers.push(...greedy(g));
  return transfers.sort((a, b) => b.amount - a.amount);
}

/** Partition into the maximum number of zero-sum groups (bitmask DP). */
function zeroSumGroups(entries: [ID, number][]): [ID, number][][] {
  const n = entries.length;
  const full = (1 << n) - 1;
  const sums = new Float64Array(1 << n);
  for (let mask = 1; mask <= full; mask++) {
    const low = mask & -mask;
    const i = 31 - Math.clz32(low);
    sums[mask] = sums[mask ^ low] + entries[i][1];
  }
  // dp[mask] = max number of complete zero-sum groups obtainable by ordering
  // the elements of mask so that zero prefix-sums delimit groups.
  const dp = new Int8Array(1 << n);
  const pick = new Int8Array(1 << n);
  for (let mask = 1; mask <= full; mask++) {
    let best = -1;
    let bestI = 0;
    for (let i = 0; i < n; i++) {
      const bit = 1 << i;
      if (!(mask & bit)) continue;
      const v = dp[mask ^ bit];
      if (v > best) {
        best = v;
        bestI = i;
      }
    }
    dp[mask] = best + (sums[mask] === 0 ? 1 : 0);
    pick[mask] = bestI;
  }

  // Walk back: removing `pick` elements yields the elements in reverse order;
  // whenever the remaining prefix sums to zero a group boundary is reached.
  const groups: [ID, number][][] = [];
  let current: [ID, number][] = [];
  let mask = full;
  while (mask) {
    const i = pick[mask];
    current.push(entries[i]);
    mask ^= 1 << i;
    if (sums[mask] === 0) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current);
  return groups;
}

/**
 * Greedy settlement within a zero-sum group: the largest debtor pays the
 * largest creditor until one of them is square. Each step zeros at least one
 * person and the final step zeros two, so a group of size m takes ≤ m − 1.
 */
function greedy(group: [ID, number][]): Transfer[] {
  const creditors = group.filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const debtors = group.filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const out: Transfer[] = [];
  const byAmount = (a: { v: number }, b: { v: number }) => b.v - a.v;
  creditors.sort(byAmount);
  debtors.sort(byAmount);
  while (creditors.length && debtors.length) {
    const c = creditors[0];
    const d = debtors[0];
    const amount = Math.min(c.v, d.v);
    out.push({ from: d.id, to: c.id, amount });
    c.v -= amount;
    d.v -= amount;
    if (c.v === 0) creditors.shift();
    if (d.v === 0) debtors.shift();
    creditors.sort(byAmount);
    debtors.sort(byAmount);
  }
  return out;
}
