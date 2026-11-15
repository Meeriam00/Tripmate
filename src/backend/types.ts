import type {
  AppNotification,
  Category,
  Expense,
  ID,
  Profile,
  SplitMethod,
  Trip,
  TripBundle,
  TripSummary,
} from "../lib/types";

/** An error whose message is a ready-to-show Azerbaijani sentence. */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string = "error",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export interface Session {
  userId: ID;
  email: string;
}

export interface TripInput {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  currency: string;
  budget: number | null;
  cover?: string | null;
}

export interface ExpenseInput {
  title: string;
  amount: number;
  category: Category;
  paidBy: ID;
  method: SplitMethod;
  participantIds: ID[];
  custom?: Record<ID, number>;
  percents?: Record<ID, number>;
  date: string;
  note?: string | null;
  receipt?: string | null;
}

export interface InvitePreview {
  tripId: ID;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  memberCount: number;
  /** Seats added by name that nobody has claimed yet. */
  openSeats: { id: ID; name: string }[];
  alreadyMember: boolean;
}

export type ImageKind = "avatar" | "cover" | "receipt";

/**
 * Everything the UI needs from a backend. Two implementations:
 * `LocalBackend` (in-browser, for demo mode) and `SupabaseBackend`.
 * Both enforce the same permissions and validation rules.
 */
export interface Backend {
  readonly mode: "local" | "supabase";
  readonly googleAvailable: boolean;

  getSession(): Promise<Session | null>;
  onAuthChange(cb: (s: Session | null, event?: string) => void): () => void;
  signUp(email: string, password: string): Promise<Session | null>;
  signIn(email: string, password: string): Promise<Session>;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
  /** Local mode returns a one-time code to show on screen (no e-mail is sent). */
  requestPasswordReset(email: string): Promise<{ localCode?: string }>;
  /** Local: needs email + code. Supabase: called from the recovery link session. */
  resetPassword(input: { email?: string; code?: string; password: string }): Promise<void>;
  changePassword(current: string, next: string): Promise<void>;
  deleteAccount(): Promise<void>;

  getProfile(): Promise<Profile | null>;
  updateProfile(patch: Partial<Omit<Profile, "id" | "email" | "createdAt">>): Promise<Profile>;
  uploadImage(kind: ImageKind, dataUrl: string): Promise<string>;

  listTrips(): Promise<TripSummary[]>;
  getTrip(tripId: ID): Promise<TripBundle>;
  createTrip(input: TripInput, participants: string[]): Promise<Trip>;
  updateTrip(tripId: ID, input: TripInput): Promise<void>;
  setArchived(tripId: ID, archived: boolean): Promise<void>;
  previewInvite(code: string): Promise<InvitePreview>;
  joinTrip(code: string, claimMemberId: ID | null): Promise<ID>;
  addMember(tripId: ID, name: string, email?: string): Promise<void>;
  removeMember(tripId: ID, memberId: ID): Promise<void>;

  saveExpense(tripId: ID, input: ExpenseInput, expenseId?: ID): Promise<Expense>;
  deleteExpense(tripId: ID, expenseId: ID): Promise<void>;

  markPaymentSent(tripId: ID, from: ID, to: ID, amount: number): Promise<void>;
  resolvePayment(tripId: ID, paymentId: ID, action: "confirm" | "reject" | "cancel"): Promise<void>;

  listNotifications(): Promise<AppNotification[]>;
  markNotificationsRead(ids?: ID[]): Promise<void>;

  /** Called whenever data may have changed (this tab, another tab, or realtime). */
  subscribe(cb: () => void): () => void;
}
