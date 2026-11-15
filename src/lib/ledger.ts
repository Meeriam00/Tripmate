import { todayISO } from "./dates";
import { minimizeTransfers, type Transfer } from "./settle";
import type { Category, Expense, ID, Member, Payment, Trip, TripBundle } from "./types";

/**
 * The financial calculation engine. Pure functions over a trip's records.
 *
 *   paid        what a member paid for shared expenses
 *   share       their part of all expenses
 *   net         paid − share  (+ receives, − owes)
 *   sent        confirmed settlement payments they made
 *   received    confirmed settlement payments they received
 *   outstanding net + sent − received — what is still open
 *
 * Only payments the receiver has confirmed count. Pending payments are
 * reported separately and never reduce a debt.
 */
export interface Balance {
  id: ID;
  paid: number;
  share: number;
  net: number;
  sent: number;
  received: number;
  outstanding: number;
  /** Awaiting the receiver's confirmation. */
  pendingOut: number;
  pendingIn: number;
}

export function computeBalances(
  members: Pick<Member, "id">[],
  expenses: Pick<Expense, "amount" | "paidBy" | "shares">[],
  payments: Pick<Payment, "from" | "to" | "amount" | "status">[],
): Map<ID, Balance> {
  const map = new Map<ID, Balance>();
  const get = (id: ID) => {
    let b = map.get(id);
    if (!b) {
      b = { id, paid: 0, share: 0, net: 0, sent: 0, received: 0, outstanding: 0, pendingOut: 0, pendingIn: 0 };
      map.set(id, b);
    }
    return b;
  };
  for (const m of members) get(m.id);
  for (const e of expenses) {
    get(e.paidBy).paid += e.amount;
    for (const [id, s] of Object.entries(e.shares)) get(id).share += s;
  }
  for (const p of payments) {
    if (p.status === "confirmed") {
      get(p.from).sent += p.amount;
      get(p.to).received += p.amount;
    } else if (p.status === "pending") {
      get(p.from).pendingOut += p.amount;
      get(p.to).pendingIn += p.amount;
    }
  }
  for (const b of map.values()) {
    b.net = b.paid - b.share;
    b.outstanding = b.net + b.sent - b.received;
  }
  return map;
}

export interface PlannedTransfer extends Transfer {
  /** Already reported as sent and waiting for confirmation on this pair. */
  pending: number;
  /** What the debtor can still report: amount − pending. */
  sendable: number;
}

/** The fewest transfers that settle every outstanding balance. */
export function settlementPlan(bundle: Pick<TripBundle, "members" | "expenses" | "payments">): PlannedTransfer[] {
  const balances = computeBalances(bundle.members, bundle.expenses, bundle.payments);
  const transfers = minimizeTransfers(
    new Map([...balances].map(([id, b]) => [id, b.outstanding])),
    bundle.members.map((m) => m.id),
  );
  return transfers.map((t) => {
    const pending = pendingBetween(bundle.payments, t.from, t.to);
    return { ...t, pending, sendable: Math.max(0, t.amount - pending) };
  });
}

export function pendingBetween(payments: Pick<Payment, "from" | "to" | "amount" | "status">[], from: ID, to: ID): number {
  return payments.filter((p) => p.status === "pending" && p.from === from && p.to === to).reduce((s, p) => s + p.amount, 0);
}

/** How much `from` may report as sent to `to` right now (0 = nothing open on this pair). */
export function maxSendable(bundle: Pick<TripBundle, "members" | "expenses" | "payments">, from: ID, to: ID): number {
  return settlementPlan(bundle).find((t) => t.from === from && t.to === to)?.sendable ?? 0;
}

export function tripTotal(expenses: Pick<Expense, "amount">[]): number {
  return expenses.reduce((s, e) => s + e.amount, 0);
}

export function categoryTotals(expenses: Pick<Expense, "amount" | "category">[]): { category: Category; amount: number }[] {
  const m = new Map<Category, number>();
  for (const e of expenses) m.set(e.category, (m.get(e.category) ?? 0) + e.amount);
  return [...m].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

export function dailyTotals(expenses: Pick<Expense, "amount" | "date">[]): { date: string; amount: number }[] {
  const m = new Map<string, number>();
  for (const e of expenses) m.set(e.date, (m.get(e.date) ?? 0) + e.amount);
  return [...m].map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date));
}

export type TripPhase = "upcoming" | "active" | "past";

export function tripPhase(trip: Pick<Trip, "startDate" | "endDate" | "archived">, today = todayISO()): TripPhase {
  if (trip.archived || trip.endDate < today) return "past";
  if (trip.startDate > today) return "upcoming";
  return "active";
}

export interface BudgetState {
  budget: number | null;
  spent: number;
  remaining: number | null;
  /** 0..∞ ratio of spent / budget, null without a budget. */
  ratio: number | null;
  level: "none" | "calm" | "watch" | "over";
}

export function budgetState(budget: number | null, spent: number): BudgetState {
  if (!budget) return { budget: null, spent, remaining: null, ratio: null, level: "none" };
  const ratio = spent / budget;
  return { budget, spent, remaining: budget - spent, ratio, level: ratio > 1 ? "over" : ratio >= 0.8 ? "watch" : "calm" };
}

/** Sanity check used by tests and the dev console: everything reconciles to zero. */
export function reconciles(balances: Map<ID, Balance>): boolean {
  let net = 0;
  let out = 0;
  for (const b of balances.values()) {
    net += b.net;
    out += b.outstanding;
  }
  return net === 0 && out === 0;
}
