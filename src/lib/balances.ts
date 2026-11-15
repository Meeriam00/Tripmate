import { minimizeTransfers, type Transfer } from "./settle";
import { sharesFor } from "./split";
import type { Category, ID, Trip } from "./types";

export interface Balance {
  id: ID;
  /** Total this person paid for shared expenses. */
  paid: number;
  /** This person's share of all expenses. */
  share: number;
  /** paid − share. Positive: receives money. Negative: owes money. */
  net: number;
  /** What is still open after recorded payments: net + sent − received. */
  outstanding: number;
}

/**
 * Net balance = total paid − total share, for every participant.
 * Recorded payments never touch expenses; they only move the outstanding amount.
 */
export function computeBalances(trip: Trip): Map<ID, Balance> {
  const order = trip.participants.map((p) => p.id);
  const blank = (id: ID): Balance => ({ id, paid: 0, share: 0, net: 0, outstanding: 0 });
  const map = new Map<ID, Balance>(order.map((id) => [id, blank(id)]));
  const get = (id: ID) => {
    if (!map.has(id)) map.set(id, blank(id));
    return map.get(id)!;
  };
  for (const e of trip.expenses) {
    get(e.paidBy).paid += e.amount;
    for (const [id, s] of sharesFor(e, order)) get(id).share += s;
  }
  const sent = new Map<ID, number>();
  const received = new Map<ID, number>();
  for (const p of trip.payments) {
    sent.set(p.from, (sent.get(p.from) ?? 0) + p.amount);
    received.set(p.to, (received.get(p.to) ?? 0) + p.amount);
  }
  for (const b of map.values()) {
    b.net = b.paid - b.share;
    b.outstanding = b.net + (sent.get(b.id) ?? 0) - (received.get(b.id) ?? 0);
  }
  return map;
}

export function tripTotal(trip: Trip): number {
  return trip.expenses.reduce((s, e) => s + e.amount, 0);
}

/** The fewest transfers that settle everything still outstanding. */
export function settlement(trip: Trip): Transfer[] {
  const balances = computeBalances(trip);
  return minimizeTransfers(
    new Map([...balances].map(([id, b]) => [id, b.outstanding])),
    trip.participants.map((p) => p.id),
  );
}

export function categoryTotals(trip: Trip): { category: Category; amount: number }[] {
  const m = new Map<Category, number>();
  for (const e of trip.expenses) m.set(e.category, (m.get(e.category) ?? 0) + e.amount);
  return [...m].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}
