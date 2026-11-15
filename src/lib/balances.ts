import { minimizeTransfers, type Transfer } from "./settle";
import { sharesFor } from "./split";
import type { ID, Trip } from "./types";

export interface Balance {
  id: ID;
  /** Total this person paid. */
  paid: number;
  /** This person's share of all expenses. */
  share: number;
  /** paid − share. Positive: receives money. Negative: owes money. */
  net: number;
}

/** Net balance = total paid − total share of expenses, for every participant. */
export function computeBalances(trip: Trip): Map<ID, Balance> {
  const order = trip.participants.map((p) => p.id);
  const map = new Map<ID, Balance>(order.map((id) => [id, { id, paid: 0, share: 0, net: 0 }]));
  const get = (id: ID) => {
    if (!map.has(id)) map.set(id, { id, paid: 0, share: 0, net: 0 });
    return map.get(id)!;
  };
  for (const e of trip.expenses) {
    get(e.paidBy).paid += e.amount;
    for (const [id, s] of sharesFor(e, order)) get(id).share += s;
  }
  for (const b of map.values()) b.net = b.paid - b.share;
  return map;
}

export function tripTotal(trip: Trip): number {
  return trip.expenses.reduce((s, e) => s + e.amount, 0);
}

/** The fewest transfers that bring everyone to zero. */
export function settlement(trip: Trip): Transfer[] {
  const balances = computeBalances(trip);
  return minimizeTransfers(
    new Map([...balances].map(([id, b]) => [id, b.net])),
    trip.participants.map((p) => p.id),
  );
}
