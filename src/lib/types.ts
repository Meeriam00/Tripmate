/**
 * TRIPMATE domain model.
 *
 * Money is always an integer number of the currency's minor unit (cent,
 * qəpik), never a float. Calendar dates are "YYYY-MM-DD" strings; moments
 * in time are epoch milliseconds.
 */

export type ID = string;

export type Role = "admin" | "member";
export type Theme = "light" | "dark" | "system";

export interface NotifyPrefs {
  expenses: boolean;
  payments: boolean;
  members: boolean;
}

export interface Profile {
  id: ID;
  email: string;
  firstName: string;
  lastName: string;
  /** Data URL (local mode) or public URL (Supabase Storage). */
  avatar?: string | null;
  currency: string;
  language: "az";
  theme: Theme;
  notify: NotifyPrefs;
  /** False until the "Profilin tamamlanması" step is done. */
  completed: boolean;
  createdAt: number;
}

export const CATEGORIES = ["stay", "food", "transport", "fun", "shopping", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Trip {
  id: ID;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  currency: string;
  /** Optional planned budget in minor units. */
  budget: number | null;
  cover?: string | null;
  inviteCode: string;
  createdBy: ID;
  archived: boolean;
  createdAt: number;
}

/**
 * A seat in a trip. `userId` is null for a friend who was added by name and
 * has not joined with an account yet; they can claim the seat via the invite.
 */
export interface Member {
  id: ID;
  tripId: ID;
  userId: ID | null;
  name: string;
  avatar?: string | null;
  role: Role;
  status: "active" | "removed";
  joinedAt: number;
}

export type SplitMethod = "equal" | "custom" | "percent";

export interface Expense {
  id: ID;
  tripId: ID;
  title: string;
  /** Total in minor units, > 0. */
  amount: number;
  category: Category;
  /** Member id of the person who paid. */
  paidBy: ID;
  method: SplitMethod;
  /**
   * Final share of every participant in minor units. Always sums exactly to
   * `amount`. Stored at save time so later trip changes (a new member, a
   * removed member) never silently alter a recorded expense.
   */
  shares: Record<ID, number>;
  /** Percent split only: basis points per member (100% = 10 000). */
  percents?: Record<ID, number> | null;
  date: string;
  note?: string | null;
  receipt?: string | null;
  /** Member id of whoever recorded it (for "edit own expenses"). */
  createdBy: ID;
  createdAt: number;
  updatedAt: number;
}

export type PaymentStatus = "pending" | "confirmed" | "rejected" | "cancelled";

/** A settlement transfer reported by the debtor and confirmed by the receiver. */
export interface Payment {
  id: ID;
  tripId: ID;
  from: ID;
  to: ID;
  amount: number;
  status: PaymentStatus;
  /** Member id of whoever marked it as sent. */
  createdBy: ID;
  createdAt: number;
  /** Member id of whoever confirmed / rejected / cancelled it. */
  resolvedBy?: ID | null;
  resolvedAt?: number | null;
}

export type ActivityKind =
  | "trip_created"
  | "trip_updated"
  | "trip_archived"
  | "trip_unarchived"
  | "member_added"
  | "member_joined"
  | "member_removed"
  | "expense_added"
  | "expense_updated"
  | "expense_deleted"
  | "payment_sent"
  | "payment_confirmed"
  | "payment_rejected"
  | "payment_cancelled";

export interface Activity {
  id: ID;
  tripId: ID;
  kind: ActivityKind;
  /** Member id of whoever did it (null for system events). */
  actor: ID | null;
  /** Free-form details: titles, amounts, other member ids. */
  data: {
    title?: string;
    amount?: number;
    category?: Category;
    expenseId?: ID;
    memberId?: ID;
    to?: ID;
    from?: ID;
  };
  at: number;
}

export type NotificationKind =
  | "expense_added"
  | "trip_invite"
  | "member_joined"
  | "balance_updated"
  | "payment_sent"
  | "payment_confirmed"
  | "payment_rejected";

export interface AppNotification {
  id: ID;
  userId: ID;
  tripId: ID | null;
  kind: NotificationKind;
  /** Ready-to-show Azerbaijani sentence. */
  text: string;
  /** In-app path to open. */
  link: string;
  read: boolean;
  at: number;
}

/** Everything about one trip, as the trip screens need it. */
export interface TripBundle {
  trip: Trip;
  members: Member[];
  expenses: Expense[];
  payments: Payment[];
  activity: Activity[];
}

/** A row on "Səfərlərim". */
export interface TripSummary {
  trip: Trip;
  members: Pick<Member, "id" | "name" | "avatar" | "status">[];
  total: number;
}
