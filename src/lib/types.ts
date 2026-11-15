/**
 * Domain model. Money is always an integer number of the currency's smallest
 * unit (qəpik, cent), never a float. Dates are plain "YYYY-MM-DD" strings.
 */

export type ID = string;

export interface Participant {
  id: ID;
  name: string;
}

export const CATEGORIES = ["food", "transport", "stay", "fun", "shopping", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Expense {
  id: ID;
  title: string;
  /** Amount in minor units (2550 = 25,50 ₼). */
  amount: number;
  /** Who paid. */
  paidBy: ID;
  /** Who shares this expense. May or may not include the payer. */
  participantIds: ID[];
  /**
   * Custom split: each participant's exact share in minor units, summing to
   * `amount`. When absent the expense is split equally.
   */
  custom?: Record<ID, number>;
  category: Category;
  date: string;
  note?: string;
  createdAt: number;
}

/** Money that actually changed hands when someone settled up. */
export interface Payment {
  id: ID;
  from: ID;
  to: ID;
  amount: number;
  createdAt: number;
}

/** One line in a trip's activity history. */
export interface Activity {
  id: ID;
  kind: "add" | "edit" | "delete" | "paid" | "undo" | "trip";
  /** Expense title, or "from → to" names for payments. */
  title: string;
  amount?: number;
  at: number;
}

export interface Trip {
  id: ID;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  currency: string;
  /** Optional total budget in minor units. */
  budget?: number;
  participants: Participant[];
  expenses: Expense[];
  payments: Payment[];
  /** Newest first, capped at 60 entries. */
  activity: Activity[];
  createdAt: number;
  updatedAt: number;
}
