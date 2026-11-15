import type {
  Activity,
  AppNotification,
  Expense,
  ID,
  Member,
  Payment,
  Profile,
  Trip,
  TripBundle,
  TripSummary,
} from "../lib/types";
import { assertTrip, emailError, nameError, participantNamesError, passwordError, prepareExpense } from "../lib/validate";
import { AppError, type Backend, type ExpenseInput, type ImageKind, type InvitePreview, type Session, type TripInput } from "./types";

/**
 * SupabaseBackend — used when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
 * are set. Reads go through Row Level Security; every write is a call to a
 * SECURITY DEFINER function in supabase/schema.sql, which re-validates the
 * input and checks the caller's role (so a modified client cannot, e.g.,
 * confirm its own payment).
 *
 * The client library is loaded lazily so demo-mode builds stay small.
 */

// Minimal structural types for the parts of supabase-js we use.
/* eslint-disable @typescript-eslint/no-explicit-any */
type SB = any;
type Row = Record<string, any>;

const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0);

function toTrip(r: Row): Trip {
  return {
    id: r.id,
    name: r.name,
    destination: r.destination,
    startDate: r.start_date,
    endDate: r.end_date,
    currency: r.currency,
    budget: r.budget === null ? null : Number(r.budget),
    cover: r.cover_url,
    inviteCode: r.invite_code,
    createdBy: r.created_by,
    archived: r.archived,
    createdAt: ms(r.created_at),
  };
}
function toMember(r: Row): Member {
  return { id: r.id, tripId: r.trip_id, userId: r.user_id, name: r.name, avatar: r.avatar_url, role: r.role, status: r.status, joinedAt: ms(r.joined_at) };
}
function toExpense(r: Row): Expense {
  const shares: Record<ID, number> = {};
  for (const s of r.expense_shares ?? []) shares[s.member_id] = Number(s.amount);
  return {
    id: r.id,
    tripId: r.trip_id,
    title: r.title,
    amount: Number(r.amount),
    category: r.category,
    paidBy: r.paid_by,
    method: r.method,
    shares,
    percents: r.percents,
    date: r.date,
    note: r.note,
    receipt: r.receipt_url,
    createdBy: r.created_by,
    createdAt: ms(r.created_at),
    updatedAt: ms(r.updated_at),
  };
}
function toPayment(r: Row): Payment {
  return {
    id: r.id,
    tripId: r.trip_id,
    from: r.from_member,
    to: r.to_member,
    amount: Number(r.amount),
    status: r.status,
    createdBy: r.created_by,
    createdAt: ms(r.created_at),
    resolvedBy: r.resolved_by,
    resolvedAt: r.resolved_at ? ms(r.resolved_at) : null,
  };
}
function toActivity(r: Row): Activity {
  const d = r.data ?? {};
  if (typeof d.amount === "string") d.amount = Number(d.amount);
  return { id: r.id, tripId: r.trip_id, kind: r.kind, actor: r.actor, data: d, at: ms(r.at) };
}
function toProfile(r: Row): Profile {
  return {
    id: r.id,
    email: r.email,
    firstName: r.first_name,
    lastName: r.last_name,
    avatar: r.avatar_url,
    currency: r.currency,
    language: "az",
    theme: r.theme,
    notify: r.notify,
    completed: r.completed,
    createdAt: ms(r.created_at),
  };
}

/** Turn library / database errors into Azerbaijani messages. */
function fail(error: { message?: string; code?: string } | null | undefined): never {
  const msg = error?.message ?? "";
  console.error("[TRIPMATE/supabase]", error);
  // Messages raised by our SQL functions are already Azerbaijani.
  if (/[əğıöüşçƏĞİÖÜŞÇ]/.test(msg)) throw new AppError(msg, error?.code ?? "db");
  if (/Invalid login credentials/i.test(msg)) throw new AppError("E-poçt və ya şifrə yanlışdır.", "credentials");
  if (/already registered|already been registered/i.test(msg)) throw new AppError("Bu e-poçt artıq qeydiyyatdan keçib. Daxil olun.", "exists");
  if (/Email not confirmed/i.test(msg)) throw new AppError("E-poçtunuz hələ təsdiqlənməyib. Gələnlər qutusundakı keçidə klikləyin.", "unconfirmed");
  if (/rate limit|too many/i.test(msg)) throw new AppError("Çox sayda cəhd oldu. Bir neçə dəqiqə sonra yenidən yoxlayın.", "rate");
  if (/provider is not enabled|Unsupported provider/i.test(msg)) throw new AppError("Google ilə giriş Supabase-də hələ aktiv edilməyib.", "not_configured");
  if (/Failed to fetch|NetworkError/i.test(msg)) throw new AppError("İnternet bağlantısı yoxdur. Yenidən cəhd edin.", "network");
  throw new AppError("Əməliyyat alınmadı. Bir az sonra yenidən cəhd edin.", error?.code ?? "unknown");
}

export class SupabaseBackend implements Backend {
  readonly mode = "supabase" as const;
  readonly googleAvailable = true;
  private client: Promise<SB>;
  private listeners = new Set<() => void>();
  private channel: any = null;

  constructor(url: string, anonKey: string) {
    this.client = import("@supabase/supabase-js").then((m: any) =>
      m.createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }),
    );
  }

  private async sb(): Promise<SB> {
    return this.client;
  }

  private async uid(): Promise<string> {
    const sb = await this.sb();
    const { data } = await sb.auth.getSession();
    const id = data.session?.user?.id;
    if (!id) throw new AppError("Sessiya bitib. Yenidən daxil olun.", "auth");
    return id;
  }

  private async rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
    const sb = await this.sb();
    const { data, error } = await sb.rpc(fn, args);
    if (error) fail(error);
    this.emit();
    return data as T;
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  subscribe(cb: () => void) {
    this.listeners.add(cb);
    void this.ensureRealtime();
    return () => void this.listeners.delete(cb);
  }

  private async ensureRealtime() {
    if (this.channel) return;
    const sb = await this.sb();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ping = () => {
      clearTimeout(timer);
      timer = setTimeout(() => this.emit(), 250);
    };
    this.channel = sb.channel("tripmate-changes");
    for (const table of ["trips", "trip_members", "expenses", "payments", "activity", "notifications"])
      this.channel.on("postgres_changes", { event: "*", schema: "public", table }, ping);
    this.channel.subscribe();
  }

  // ---------- auth ----------

  async getSession(): Promise<Session | null> {
    const sb = await this.sb();
    const { data } = await sb.auth.getSession();
    const u = data.session?.user;
    return u ? { userId: u.id, email: u.email ?? "" } : null;
  }

  onAuthChange(cb: (s: Session | null, event?: string) => void) {
    let unsub = () => {};
    void this.sb().then((sb) => {
      const { data } = sb.auth.onAuthStateChange((event: string, session: any) => {
        cb(session?.user ? { userId: session.user.id, email: session.user.email ?? "" } : null, event);
      });
      unsub = () => data.subscription.unsubscribe();
    });
    return () => unsub();
  }

  async signUp(email: string, password: string) {
    const err = emailError(email) ?? passwordError(password);
    if (err) throw new AppError(err, "validation");
    const sb = await this.sb();
    const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${location.origin}/profil-tamamla` } });
    if (error) fail(error);
    // With "Confirm email" enabled Supabase returns no session until the link is clicked.
    return data.session ? { userId: data.user.id, email: data.user.email } : null;
  }

  async signIn(email: string, password: string) {
    const sb = await this.sb();
    const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) fail(error);
    return { userId: data.user.id, email: data.user.email };
  }

  async signInWithGoogle() {
    const sb = await this.sb();
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/app` } });
    if (error) fail(error);
  }

  async signOut() {
    const sb = await this.sb();
    await sb.auth.signOut();
  }

  async requestPasswordReset(email: string) {
    const err = emailError(email);
    if (err) throw new AppError(err, "validation");
    const sb = await this.sb();
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/sifre-yenile` });
    if (error) fail(error);
    return {};
  }

  async resetPassword({ password }: { password: string }) {
    const err = passwordError(password);
    if (err) throw new AppError(err, "validation");
    const sb = await this.sb();
    const { error } = await sb.auth.updateUser({ password });
    if (error) fail(error);
  }

  async changePassword(current: string, next: string) {
    const err = passwordError(next);
    if (err) throw new AppError(err, "validation");
    const sb = await this.sb();
    const { data } = await sb.auth.getSession();
    const email = data.session?.user?.email;
    const check = await sb.auth.signInWithPassword({ email, password: current });
    if (check.error) throw new AppError("Hazırkı şifrə yanlışdır.", "credentials");
    const { error } = await sb.auth.updateUser({ password: next });
    if (error) fail(error);
  }

  async deleteAccount() {
    await this.rpc("delete_my_account", {});
    const sb = await this.sb();
    await sb.auth.signOut();
  }

  // ---------- profile ----------

  async getProfile() {
    const sb = await this.sb();
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return null;
    const { data, error } = await sb.from("profiles").select("*").eq("id", s.session.user.id).maybeSingle();
    if (error) fail(error);
    return data ? toProfile(data) : null;
  }

  async updateProfile(patch: Partial<Omit<Profile, "id" | "email" | "createdAt">>) {
    if (patch.firstName !== undefined) {
      const e = nameError(patch.firstName, "Ad");
      if (e) throw new AppError(e, "validation");
    }
    const id = await this.uid();
    const row: Row = {};
    if (patch.firstName !== undefined) row.first_name = patch.firstName.trim();
    if (patch.lastName !== undefined) row.last_name = patch.lastName.trim();
    if (patch.avatar !== undefined) row.avatar_url = patch.avatar;
    if (patch.currency !== undefined) row.currency = patch.currency;
    if (patch.theme !== undefined) row.theme = patch.theme;
    if (patch.notify !== undefined) row.notify = patch.notify;
    if (patch.completed !== undefined) row.completed = patch.completed;
    const sb = await this.sb();
    const { data, error } = await sb.from("profiles").update(row).eq("id", id).select("*").single();
    if (error) fail(error);
    this.emit();
    return toProfile(data);
  }

  async uploadImage(kind: ImageKind, dataUrl: string) {
    const id = await this.uid();
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${id}/${kind}/${crypto.randomUUID()}.jpg`;
    const sb = await this.sb();
    const { error } = await sb.storage.from("media").upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) fail(error);
    return sb.storage.from("media").getPublicUrl(path).data.publicUrl as string;
  }

  // ---------- trips ----------

  async listTrips(): Promise<TripSummary[]> {
    const id = await this.uid();
    const sb = await this.sb();
    const seats = await sb.from("trip_members").select("trip_id").eq("user_id", id).eq("status", "active");
    if (seats.error) fail(seats.error);
    const ids: string[] = seats.data.map((r: Row) => r.trip_id);
    if (!ids.length) return [];
    const [trips, members, expenses] = await Promise.all([
      sb.from("trips").select("*").in("id", ids),
      sb.from("trip_members").select("id,trip_id,name,avatar_url,status,joined_at").in("trip_id", ids).eq("status", "active").order("joined_at"),
      sb.from("expenses").select("trip_id,amount").in("trip_id", ids),
    ]);
    for (const r of [trips, members, expenses]) if (r.error) fail(r.error);
    return trips.data
      .map((t: Row) => ({
        trip: toTrip(t),
        members: members.data.filter((m: Row) => m.trip_id === t.id).map((m: Row) => ({ id: m.id, name: m.name, avatar: m.avatar_url, status: m.status })),
        total: expenses.data.filter((e: Row) => e.trip_id === t.id).reduce((s: number, e: Row) => s + Number(e.amount), 0),
      }))
      .sort((a: TripSummary, b: TripSummary) => a.trip.startDate.localeCompare(b.trip.startDate));
  }

  async getTrip(tripId: ID): Promise<TripBundle> {
    const sb = await this.sb();
    const [trip, members, expenses, payments, activity] = await Promise.all([
      sb.from("trips").select("*").eq("id", tripId).maybeSingle(),
      sb.from("trip_members").select("*").eq("trip_id", tripId).order("joined_at"),
      sb.from("expenses").select("*, expense_shares(member_id, amount)").eq("trip_id", tripId).order("date", { ascending: false }).order("created_at", { ascending: false }),
      sb.from("payments").select("*").eq("trip_id", tripId).order("created_at", { ascending: false }),
      sb.from("activity").select("*").eq("trip_id", tripId).order("at", { ascending: false }).limit(200),
    ]);
    for (const r of [trip, members, expenses, payments, activity]) if (r.error) fail(r.error);
    // RLS hides trips you are not a member of.
    if (!trip.data) throw new AppError("Bu səfərə girişiniz yoxdur.", "forbidden");
    return {
      trip: toTrip(trip.data),
      members: members.data.map(toMember),
      expenses: expenses.data.map(toExpense),
      payments: payments.data.map(toPayment),
      activity: activity.data.map(toActivity),
    };
  }

  async createTrip(input: TripInput, participants: string[]) {
    assertTrip(input);
    const err = participantNamesError(participants);
    if (err) throw new AppError(err, "validation");
    const row = await this.rpc<Row>("create_trip", {
      p_name: input.name,
      p_destination: input.destination,
      p_start: input.startDate,
      p_end: input.endDate,
      p_currency: input.currency,
      p_budget: input.budget,
      p_cover: input.cover ?? null,
      p_participants: participants.map((p) => p.trim()).filter(Boolean),
    });
    return toTrip(row);
  }

  async updateTrip(tripId: ID, input: TripInput) {
    assertTrip(input);
    await this.rpc("update_trip", {
      p_trip: tripId,
      p_name: input.name,
      p_destination: input.destination,
      p_start: input.startDate,
      p_end: input.endDate,
      p_currency: input.currency,
      p_budget: input.budget,
      p_cover: input.cover ?? null,
    });
  }

  async setArchived(tripId: ID, archived: boolean) {
    await this.rpc("set_trip_archived", { p_trip: tripId, p_archived: archived });
  }

  async previewInvite(code: string) {
    return this.rpc<InvitePreview>("preview_invite", { p_code: code });
  }

  async joinTrip(code: string, claimMemberId: ID | null) {
    return this.rpc<string>("join_trip", { p_code: code, p_claim: claimMemberId });
  }

  async addMember(tripId: ID, name: string, email?: string) {
    const err = nameError(name, "İştirakçının adı") ?? (email ? emailError(email) : null);
    if (err) throw new AppError(err, "validation");
    await this.rpc("add_member", { p_trip: tripId, p_name: name, p_email: email ?? null });
  }

  async removeMember(tripId: ID, memberId: ID) {
    await this.rpc("remove_member", { p_trip: tripId, p_member: memberId });
  }

  // ---------- expenses ----------

  async saveExpense(tripId: ID, input: ExpenseInput, expenseId?: ID) {
    const bundle = await this.getTrip(tripId);
    const existing = expenseId ? bundle.expenses.find((e) => e.id === expenseId) : undefined;
    const { shares, percents } = prepareExpense(input, bundle.members, existing);
    const id = await this.rpc<string>("save_expense", {
      p_trip: tripId,
      p_expense: expenseId ?? null,
      p_title: input.title,
      p_amount: input.amount,
      p_category: input.category,
      p_paid_by: input.paidBy,
      p_method: input.method,
      p_shares: shares,
      p_percents: percents,
      p_date: input.date,
      p_note: input.note ?? null,
      p_receipt: input.receipt ?? null,
    });
    const fresh = await this.getTrip(tripId);
    return fresh.expenses.find((e) => e.id === id)!;
  }

  async deleteExpense(_tripId: ID, expenseId: ID) {
    await this.rpc("delete_expense", { p_expense: expenseId });
  }

  // ---------- payments ----------

  async markPaymentSent(tripId: ID, from: ID, to: ID, amount: number) {
    await this.rpc("mark_payment_sent", { p_trip: tripId, p_from: from, p_to: to, p_amount: amount });
  }

  async resolvePayment(_tripId: ID, paymentId: ID, action: "confirm" | "reject" | "cancel") {
    await this.rpc("resolve_payment", { p_payment: paymentId, p_action: action });
  }

  // ---------- notifications ----------

  async listNotifications(): Promise<AppNotification[]> {
    const sb = await this.sb();
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return [];
    const { data, error } = await sb.from("notifications").select("*").order("at", { ascending: false }).limit(100);
    if (error) fail(error);
    return data.map((r: Row) => ({ id: r.id, userId: r.user_id, tripId: r.trip_id, kind: r.kind, text: r.text, link: r.link, read: r.read, at: ms(r.at) }));
  }

  async markNotificationsRead(ids?: ID[]) {
    const id = await this.uid();
    const sb = await this.sb();
    let q = sb.from("notifications").update({ read: true }).eq("user_id", id).eq("read", false);
    if (ids) q = q.in("id", ids);
    const { error } = await q;
    if (error) fail(error);
    this.emit();
  }
}
