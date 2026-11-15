/**
 * Domain model. Money is always stored as an integer number of the
 * currency's smallest unit (qəpik, cent), never as a float.
 */

export type ID = string;

export interface Participant {
  id: ID;
  name: string;
}

export interface Expense {
  id: ID;
  title: string;
  /** Amount in minor units (e.g. 2550 = 25,50 ₼). */
  amount: number;
  /** Who paid. */
  paidBy: ID;
  /** Who shares this expense equally. May or may not include the payer. */
  participantIds: ID[];
  createdAt: number;
}

export interface Trip {
  id: ID;
  name: string;
  destination: string;
  currency: string;
  participants: Participant[];
  expenses: Expense[];
  createdAt: number;
  updatedAt: number;
}
