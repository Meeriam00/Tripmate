/**
 * Domain model. All money is stored as integers in the currency's smallest
 * unit ("minor units": cents for EUR, whole yen for JPY, fils for KWD).
 * Floating point never touches a stored amount.
 */

export type ID = string;

export interface Participant {
  id: ID;
  name: string;
  /** Index into the avatar palette (see lib/avatars.ts). */
  color: number;
}

export const CATEGORIES = [
  "accommodation",
  "food",
  "transport",
  "activities",
  "shopping",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type Split =
  /** Divide evenly among the listed participants. */
  | { mode: "equal"; participantIds: ID[] }
  /** Exact minor-unit amounts per participant; must sum to the expense total. */
  | { mode: "exact"; amounts: Record<ID, number> }
  /** Weighted shares (e.g. nights stayed). Weights are positive numbers. */
  | { mode: "shares"; shares: Record<ID, number> };

export interface Expense {
  id: ID;
  title: string;
  /** Amount in the trip currency, minor units. This is what gets split. */
  amount: number;
  /**
   * If the expense was paid in another currency, the original figures are
   * kept for display. `amount` is the converted value used for all maths.
   */
  original?: { currency: string; amount: number; rate: number; amounts?: Record<ID, number> };
  paidBy: ID;
  category: Category;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  note?: string;
  split: Split;
  createdAt: number;
}

/** A real-world transfer recorded when someone marks a settlement as paid. */
export interface Payment {
  id: ID;
  from: ID;
  to: ID;
  amount: number;
  date: string;
  createdAt: number;
}

export interface Trip {
  id: ID;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  currency: string;
  participants: Participant[];
  expenses: Expense[];
  payments: Payment[];
  createdAt: number;
  updatedAt: number;
  /** Set once every balance is zero and the group closes the trip. */
  closedAt?: number;
}
