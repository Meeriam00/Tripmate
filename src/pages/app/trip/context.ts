import { createContext, useContext } from "react";
import type { Balance, PlannedTransfer } from "../../../lib/ledger";
import type { Expense, ID, Member, TripBundle } from "../../../lib/types";

export interface TripCtx {
  bundle: TripBundle;
  me: Member;
  isAdmin: boolean;
  readOnly: boolean;
  balances: Map<ID, Balance>;
  plan: PlannedTransfer[];
  total: number;
  member: (id: ID) => Member | undefined;
  /** "Ali" or "Sən" for the current user. */
  nameOf: (id: ID) => string;
  money: (minor: number, opts?: { signed?: boolean }) => string;
  openExpense: (e?: Expense) => void;
  canEdit: (e: Expense) => boolean;
  base: string;
}

export const TripContext = createContext<TripCtx | null>(null);
export function useTripCtx() {
  const c = useContext(TripContext);
  if (!c) throw new Error("TripContext missing");
  return c;
}
