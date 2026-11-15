import { computeLedgers } from "./balances";
import { minimizeTransfers, type Transfer } from "./settle";
import { sharesFor, splitParticipants } from "./split";
import { CATEGORIES, type Category, type ID, type Trip } from "./types";

/** Why a participant can't be removed (null = safe to remove). */
export function participantInvolvement(trip: Trip, id: ID): string | null {
  const paid = trip.expenses.filter((e) => e.paidBy === id).length;
  const shared = trip.expenses.filter((e) => e.paidBy !== id && splitParticipants(e.split).includes(id)).length;
  const payments = trip.payments.filter((p) => p.from === id || p.to === id).length;
  const bits: string[] = [];
  if (paid) bits.push(`paid for ${paid} expense${paid > 1 ? "s" : ""}`);
  if (shared) bits.push(`shares ${shared} expense${shared > 1 ? "s" : ""}`);
  if (payments) bits.push(`has ${payments} recorded payment${payments > 1 ? "s" : ""}`);
  return bits.length ? bits.join(", ") : null;
}

export function categoryTotals(trip: Trip): { category: Category; amount: number; count: number }[] {
  return CATEGORIES.map((category) => {
    const list = trip.expenses.filter((e) => e.category === category);
    return { category, amount: list.reduce((s, e) => s + e.amount, 0), count: list.length };
  })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.amount - a.amount);
}

/** Each person's consumption (share) broken down by category. */
export function personCategoryShares(trip: Trip): Map<ID, Map<Category, number>> {
  const order = trip.participants.map((p) => p.id);
  const out = new Map<ID, Map<Category, number>>();
  for (const id of order) out.set(id, new Map());
  for (const e of trip.expenses) {
    for (const [id, s] of sharesFor(e, order)) {
      const m = out.get(id) ?? new Map();
      m.set(e.category, (m.get(e.category) ?? 0) + s);
      out.set(id, m);
    }
  }
  return out;
}

export function dailyTotals(trip: Trip): { date: string; amount: number }[] {
  const m = new Map<string, number>();
  for (const e of trip.expenses) m.set(e.date, (m.get(e.date) ?? 0) + e.amount);
  return [...m.entries()].map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date));
}

export interface SettlementView {
  ledgers: ReturnType<typeof computeLedgers>;
  transfers: Transfer[];
  /** Total still owed across the group. */
  outstanding: number;
  /** Total of the plan before any payment was recorded (for progress). */
  original: number;
  settled: boolean;
}

export function settlementView(trip: Trip): SettlementView {
  const order = trip.participants.map((p) => p.id);
  const ledgers = computeLedgers(trip);
  const balances = new Map([...ledgers].map(([id, l]) => [id, l.outstanding]));
  const transfers = minimizeTransfers(balances, order);
  const outstanding = transfers.reduce((s, t) => s + t.amount, 0);
  const paid = trip.payments.reduce((s, p) => s + p.amount, 0);
  return { ledgers, transfers, outstanding, original: outstanding + paid, settled: outstanding === 0 };
}
