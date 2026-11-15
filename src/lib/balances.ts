import { sharesFor } from "./split";
import type { ID, Trip } from "./types";

export interface PersonLedger {
  id: ID;
  /** Total this person paid for shared expenses. */
  paid: number;
  /** This person's share of all expenses. */
  share: number;
  /** paid − share. What the expenses alone say. */
  net: number;
  /** Settlement payments this person has sent / received. */
  sent: number;
  received: number;
  /**
   * Outstanding balance after recorded payments: net + sent − received.
   * Positive → should receive money. Negative → owes money. Zero → square.
   */
  outstanding: number;
}

/**
 * Compute every participant's ledger from the raw expense history and the
 * recorded payments. Expenses are never mutated by settling up; payments are
 * a separate list, so un-marking a payment simply removes it.
 */
export function computeLedgers(trip: Trip): Map<ID, PersonLedger> {
  const order = trip.participants.map((p) => p.id);
  const map = new Map<ID, PersonLedger>();
  const get = (id: ID) => {
    let l = map.get(id);
    if (!l) {
      l = { id, paid: 0, share: 0, net: 0, sent: 0, received: 0, outstanding: 0 };
      map.set(id, l);
    }
    return l;
  };
  for (const id of order) get(id);

  for (const e of trip.expenses) {
    get(e.paidBy).paid += e.amount;
    for (const [id, s] of sharesFor(e, order)) get(id).share += s;
  }
  for (const p of trip.payments) {
    get(p.from).sent += p.amount;
    get(p.to).received += p.amount;
  }
  for (const l of map.values()) {
    l.net = l.paid - l.share;
    l.outstanding = l.net + l.sent - l.received;
  }
  return map;
}

export function outstandingBalances(trip: Trip): Map<ID, number> {
  const out = new Map<ID, number>();
  for (const [id, l] of computeLedgers(trip)) out.set(id, l.outstanding);
  return out;
}

export function tripTotal(trip: Trip): number {
  return trip.expenses.reduce((s, e) => s + e.amount, 0);
}

/** Sum of what is still owed (equals what is still receivable). */
export function totalOutstanding(balances: Map<ID, number>): number {
  let owed = 0;
  for (const v of balances.values()) if (v < 0) owed -= v;
  return owed;
}
