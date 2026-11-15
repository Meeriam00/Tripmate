import type { Expense, ID } from "./types";

/**
 * Split an amount equally among participants, in whole minor units.
 * The shares always add up to exactly `amount`.
 *
 * When the amount doesn't divide evenly, the leftover qəpiks are handed out
 * one at a time: first to the payer (if they share the expense), then in the
 * order participants were added to the trip. Example: 10,00 ₼ among three,
 * paid by Leyla → Leyla 3,34 ₼, the others 3,33 ₼.
 */
export function equalShares(amount: number, participantIds: ID[], payerId: ID, order: ID[]): Map<ID, number> {
  const pos = new Map(order.map((id, i) => [id, i]));
  const ids = [...new Set(participantIds)].sort((a, b) => {
    if (a === payerId) return -1;
    if (b === payerId) return 1;
    return (pos.get(a) ?? 1e9) - (pos.get(b) ?? 1e9);
  });
  const out = new Map<ID, number>();
  if (ids.length === 0) return out;
  const base = Math.floor(amount / ids.length);
  let left = amount - base * ids.length;
  for (const id of ids) {
    out.set(id, base + (left > 0 ? 1 : 0));
    if (left > 0) left--;
  }
  return out;
}

export function sharesFor(expense: Expense, order: ID[]): Map<ID, number> {
  return equalShares(expense.amount, expense.participantIds, expense.paidBy, order);
}
