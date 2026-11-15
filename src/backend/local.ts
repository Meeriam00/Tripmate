import { computeBalances, maxSendable, tripTotal } from "../lib/ledger";
import { formatMoney } from "../lib/money";
import type {
  Activity,
  AppNotification,
  Expense,
  ID,
  Member,
  NotificationKind,
  NotifyPrefs,
  Payment,
  Profile,
  Trip,
  TripBundle,
  TripSummary,
} from "../lib/types";
import { assertTrip, emailError, nameError, participantNamesError, passwordError, prepareExpense } from "../lib/validate";
import { seedDemo } from "./seed";
import { AppError, type Backend, type ExpenseInput, type ImageKind, type InvitePreview, type Session, type TripInput } from "./types";


/**
 * LocalBackend — a complete backend that runs inside the browser.
 *
 * It is the "Demo rejimi" of TRIPMATE: used when no Supabase project is
 * configured. Data lives in localStorage on this device, so several demo
 * accounts can share trips on one computer (and across tabs), but nothing is
 * synced between devices and no e-mail is sent. Every rule the Supabase
 * schema enforces (membership, roles, payment confirmation by the receiver,
 * split validation) is enforced here too.
 */

interface UserRow {
  id: ID;
  email: string;
  salt: string;
  hash: string;
}

export interface LocalDB {
  version: 2;
  users: UserRow[];
  profiles: Profile[];
  trips: Trip[];
  members: Member[];
  expenses: Expense[];
  payments: Payment[];
  activity: Activity[];
  notifications: AppNotification[];
  resets: { email: string; code: string; expires: number }[];
}

export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

const DB_KEY = "tripmate:db:v2";
const SESSION_KEY = "tripmate:session";

export const browserStore: KeyValueStore = {
  get: (k) => localStorage.getItem(k),
  set: (k, v) => localStorage.setItem(k, v),
  remove: (k) => localStorage.removeItem(k),
};

export function memoryStore(): KeyValueStore {
  const m = new Map<string, string>();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v), remove: (k) => void m.delete(k) };
}

export function emptyDB(): LocalDB {
  return { version: 2, users: [], profiles: [], trips: [], members: [], expenses: [], payments: [], activity: [], notifications: [], resets: [] };
}

export const uid = () => crypto.randomUUID();

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function inviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => INVITE_ALPHABET[b % INVITE_ALPHABET.length]).join("");
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 60_000 },
    key,
    256,
  );
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function makeUser(email: string, password: string): Promise<UserRow> {
  const salt = uid();
  return { id: uid(), email: email.trim().toLowerCase(), salt, hash: await hashPassword(password, salt) };
}

export function defaultProfile(id: ID, email: string): Profile {
  return {
    id,
    email,
    firstName: "",
    lastName: "",
    avatar: null,
    currency: "AZN",
    language: "az",
    theme: "system",
    notify: { expenses: true, payments: true, members: true },
    completed: false,
    createdAt: Date.now(),
  };
}

export function displayName(p: Pick<Profile, "firstName" | "lastName" | "email">): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email.split("@")[0];
}

const PREF_FOR: Record<NotificationKind, keyof NotifyPrefs | null> = {
  expense_added: "expenses",
  balance_updated: "expenses",
  payment_sent: "payments",
  payment_confirmed: "payments",
  payment_rejected: "payments",
  member_joined: "members",
  trip_invite: null,
};

export class LocalBackend implements Backend {
  readonly mode = "local" as const;
  readonly googleAvailable = false;
  private listeners = new Set<() => void>();
  private authListeners = new Set<(s: Session | null, event?: string) => void>();
  private db: LocalDB;

  constructor(
    private store: KeyValueStore = browserStore,
    opts: { seed?: boolean } = {},
  ) {
    this.db = this.load();
    if (opts.seed !== false && this.db.users.length === 0) {
      // Seeding hashes passwords asynchronously; callers await `ready`.
      this.ready = seedDemo(this.db).then(() => this.save());
    }
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key === DB_KEY) {
          this.db = this.load();
          this.emit();
        }
        if (e.key === SESSION_KEY) this.emitAuth();
      });
    }
  }

  ready: Promise<void> = Promise.resolve();

  // ---------- persistence ----------

  private load(): LocalDB {
    try {
      const raw = this.store.get(DB_KEY);
      if (raw) {
        const db = JSON.parse(raw) as LocalDB;
        if (db.version === 2) return { ...emptyDB(), ...db };
      }
    } catch {
      /* fall through to an empty database */
    }
    return emptyDB();
  }

  private save() {
    try {
      this.store.set(DB_KEY, JSON.stringify(this.db));
    } catch {
      throw new AppError("Cihazın yaddaşı doldu. Böyük şəkilləri silib yenidən cəhd edin.", "quota");
    }
    this.emit();
  }

  /** Apply a change atomically: on any error nothing is written. */
  private async tx<T>(fn: (db: LocalDB) => T | Promise<T>): Promise<T> {
    await this.ready;
    const draft = structuredClone(this.db);
    const out = await fn(draft);
    const before = this.db;
    this.db = draft;
    try {
      this.save();
    } catch (e) {
      this.db = before;
      throw e;
    }
    return out;
  }

  private async read<T>(fn: (db: LocalDB) => T): Promise<T> {
    await this.ready;
    return structuredClone(fn(this.db));
  }

  private emit() {
    for (const l of this.listeners) l();
  }
  private emitAuth(event?: string) {
    const s = this.sessionSync();
    for (const l of this.authListeners) l(s, event);
  }

  subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => void this.listeners.delete(cb);
  }

  /** Demo tools (Ayarlar → Demo məlumatları). */
  async resetDemo() {
    this.db = emptyDB();
    await seedDemo(this.db);
    this.save();
    this.store.remove(SESSION_KEY);
    this.emitAuth("SIGNED_OUT");
  }

  // ---------- auth ----------

  private sessionSync(): Session | null {
    try {
      const raw = this.store.get(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as Session;
      return this.db.users.some((u) => u.id === s.userId) ? s : null;
    } catch {
      return null;
    }
  }

  private me(): Session {
    const s = this.sessionSync();
    if (!s) throw new AppError("Sessiya bitib. Yenidən daxil olun.", "auth");
    return s;
  }

  async getSession() {
    await this.ready;
    return this.sessionSync();
  }

  onAuthChange(cb: (s: Session | null, event?: string) => void) {
    this.authListeners.add(cb);
    return () => void this.authListeners.delete(cb);
  }

  private setSession(s: Session | null, event: string) {
    if (s) this.store.set(SESSION_KEY, JSON.stringify(s));
    else this.store.remove(SESSION_KEY);
    this.emitAuth(event);
  }

  async signUp(email: string, password: string) {
    const err = emailError(email) ?? passwordError(password);
    if (err) throw new AppError(err, "validation");
    const user = await makeUser(email, password);
    await this.tx((db) => {
      if (db.users.some((u) => u.email === user.email)) throw new AppError("Bu e-poçt artıq qeydiyyatdan keçib. Daxil olun.", "exists");
      db.users.push(user);
      db.profiles.push(defaultProfile(user.id, user.email));
    });
    const s = { userId: user.id, email: user.email };
    this.setSession(s, "SIGNED_IN");
    return s;
  }

  async signIn(email: string, password: string) {
    await this.ready;
    const user = this.db.users.find((u) => u.email === email.trim().toLowerCase());
    if (!user || (await hashPassword(password, user.salt)) !== user.hash)
      throw new AppError("E-poçt və ya şifrə yanlışdır.", "credentials");
    const s = { userId: user.id, email: user.email };
    this.setSession(s, "SIGNED_IN");
    return s;
  }

  async signInWithGoogle(): Promise<void> {
    throw new AppError("Google ilə giriş Supabase qoşulduqdan sonra aktiv olacaq.", "not_configured");
  }

  async signOut() {
    this.setSession(null, "SIGNED_OUT");
  }

  async requestPasswordReset(email: string) {
    const err = emailError(email);
    if (err) throw new AppError(err, "validation");
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
    const known = await this.tx((db) => {
      const e = email.trim().toLowerCase();
      if (!db.users.some((u) => u.email === e)) return false;
      db.resets = db.resets.filter((r) => r.email !== e && r.expires > Date.now());
      db.resets.push({ email: e, code, expires: Date.now() + 15 * 60_000 });
      return true;
    });
    // Like a real service, don't reveal whether the address exists.
    return known ? { localCode: code } : {};
  }

  async resetPassword({ email = "", code = "", password }: { email?: string; code?: string; password: string }) {
    const err = passwordError(password);
    if (err) throw new AppError(err, "validation");
    const e = email.trim().toLowerCase();
    const reset = this.db.resets.find((r) => r.email === e && r.code === code.trim() && r.expires > Date.now());
    if (!reset) throw new AppError("Kod yanlışdır və ya vaxtı bitib.", "code");
    const fresh = await makeUser(e, password);
    await this.tx((db) => {
      const u = db.users.find((x) => x.email === e)!;
      u.salt = fresh.salt;
      u.hash = fresh.hash;
      db.resets = db.resets.filter((r) => r.email !== e);
    });
  }

  async changePassword(current: string, next: string) {
    const s = this.me();
    const user = this.db.users.find((u) => u.id === s.userId)!;
    if ((await hashPassword(current, user.salt)) !== user.hash) throw new AppError("Hazırkı şifrə yanlışdır.", "credentials");
    const err = passwordError(next);
    if (err) throw new AppError(err, "validation");
    const fresh = await makeUser(user.email, next);
    await this.tx((db) => {
      const u = db.users.find((x) => x.id === s.userId)!;
      u.salt = fresh.salt;
      u.hash = fresh.hash;
    });
  }

  async deleteAccount() {
    const s = this.me();
    await this.tx((db) => {
      // Financial records stay intact: the person's seats become name-only seats.
      for (const m of db.members) if (m.userId === s.userId) m.userId = null;
      db.users = db.users.filter((u) => u.id !== s.userId);
      db.profiles = db.profiles.filter((p) => p.id !== s.userId);
      db.notifications = db.notifications.filter((n) => n.userId !== s.userId);
    });
    this.setSession(null, "SIGNED_OUT");
  }

  // ---------- profile ----------

  async getProfile() {
    const s = this.sessionSync();
    if (!s) return null;
    return this.read((db) => db.profiles.find((p) => p.id === s.userId) ?? null);
  }

  async updateProfile(patch: Partial<Omit<Profile, "id" | "email" | "createdAt">>) {
    const s = this.me();
    if (patch.firstName !== undefined) {
      const e = nameError(patch.firstName, "Ad");
      if (e) throw new AppError(e, "validation");
    }
    if (patch.lastName !== undefined && patch.lastName.trim().length > 40)
      throw new AppError("Soyad 40 simvoldan uzun ola bilməz.", "validation");
    return this.tx((db) => {
      const p = db.profiles.find((x) => x.id === s.userId)!;
      Object.assign(p, patch, {
        firstName: patch.firstName?.trim() ?? p.firstName,
        lastName: patch.lastName?.trim() ?? p.lastName,
      });
      // Keep the person's name and photo in sync on their trip seats.
      for (const m of db.members)
        if (m.userId === s.userId) {
          if (patch.firstName !== undefined || patch.lastName !== undefined) m.name = displayName(p);
          if (patch.avatar !== undefined) m.avatar = p.avatar;
        }
      return p;
    });
  }

  async uploadImage(_kind: ImageKind, dataUrl: string) {
    // Local mode keeps the (already compressed) image inline.
    return dataUrl;
  }

  // ---------- helpers ----------

  private member(db: LocalDB, tripId: ID, userId: ID): Member {
    const m = db.members.find((x) => x.tripId === tripId && x.userId === userId && x.status === "active");
    if (!m) throw new AppError("Bu səfərə girişiniz yoxdur.", "forbidden");
    return m;
  }

  private trip(db: LocalDB, tripId: ID): Trip {
    const t = db.trips.find((x) => x.id === tripId);
    if (!t) throw new AppError("Səfər tapılmadı.", "not_found");
    return t;
  }

  private writable(t: Trip) {
    if (t.archived) throw new AppError("Səfər arxivdədir. Dəyişiklik üçün əvvəlcə arxivdən çıxarın.", "archived");
  }

  private log(db: LocalDB, tripId: ID, kind: Activity["kind"], actor: ID | null, data: Activity["data"] = {}) {
    db.activity.push({ id: uid(), tripId, kind, actor, data, at: Date.now() });
  }

  private notify(db: LocalDB, userIds: (ID | null | undefined)[], tripId: ID | null, kind: NotificationKind, text: string, link: string, except?: ID) {
    const pref = PREF_FOR[kind];
    for (const userId of new Set(userIds)) {
      if (!userId || userId === except) continue;
      const profile = db.profiles.find((p) => p.id === userId);
      if (!profile) continue;
      if (pref && !profile.notify[pref]) continue;
      db.notifications.push({ id: uid(), userId, tripId, kind, text, link, read: false, at: Date.now() });
    }
  }

  private bundle(db: LocalDB, tripId: ID): TripBundle {
    return {
      trip: this.trip(db, tripId),
      members: db.members.filter((m) => m.tripId === tripId).sort((a, b) => a.joinedAt - b.joinedAt),
      expenses: db.expenses.filter((e) => e.tripId === tripId).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
      payments: db.payments.filter((p) => p.tripId === tripId).sort((a, b) => b.createdAt - a.createdAt),
      activity: db.activity.filter((a) => a.tripId === tripId).sort((a, b) => b.at - a.at),
    };
  }

  // ---------- trips ----------

  async listTrips(): Promise<TripSummary[]> {
    const s = this.me();
    return this.read((db) =>
      db.members
        .filter((m) => m.userId === s.userId && m.status === "active")
        .map((m) => {
          const trip = this.trip(db, m.tripId);
          return {
            trip,
            members: db.members.filter((x) => x.tripId === trip.id && x.status === "active").map(({ id, name, avatar, status }) => ({ id, name, avatar, status })),
            total: tripTotal(db.expenses.filter((e) => e.tripId === trip.id)),
          };
        })
        .sort((a, b) => a.trip.startDate.localeCompare(b.trip.startDate)),
    );
  }

  async getTrip(tripId: ID) {
    const s = this.me();
    return this.read((db) => {
      this.trip(db, tripId);
      this.member(db, tripId, s.userId);
      return this.bundle(db, tripId);
    });
  }

  async createTrip(input: TripInput, participants: string[]) {
    const s = this.me();
    assertTrip(input);
    const err = participantNamesError(participants);
    if (err) throw new AppError(err, "validation");
    return this.tx((db) => {
      const profile = db.profiles.find((p) => p.id === s.userId)!;
      const now = Date.now();
      const trip: Trip = {
        id: uid(),
        name: input.name.trim(),
        destination: input.destination.trim(),
        startDate: input.startDate,
        endDate: input.endDate,
        currency: input.currency,
        budget: input.budget,
        cover: input.cover ?? null,
        inviteCode: inviteCode(),
        createdBy: s.userId,
        archived: false,
        createdAt: now,
      };
      db.trips.push(trip);
      const me: Member = { id: uid(), tripId: trip.id, userId: s.userId, name: displayName(profile), avatar: profile.avatar, role: "admin", status: "active", joinedAt: now };
      db.members.push(me);
      const myName = me.name.toLocaleLowerCase("az");
      participants
        .map((n) => n.trim())
        .filter((n) => n && n.toLocaleLowerCase("az") !== myName)
        .forEach((name, i) => db.members.push({ id: uid(), tripId: trip.id, userId: null, name, role: "member", status: "active", joinedAt: now + i + 1 }));
      this.log(db, trip.id, "trip_created", me.id, { title: trip.name });
      return trip;
    });
  }

  async updateTrip(tripId: ID, input: TripInput) {
    const s = this.me();
    assertTrip(input);
    await this.tx((db) => {
      const t = this.trip(db, tripId);
      const me = this.member(db, tripId, s.userId);
      if (me.role !== "admin") throw new AppError("Səfəri yalnız admin dəyişə bilər.", "forbidden");
      this.writable(t);
      if (input.currency !== t.currency && db.expenses.some((e) => e.tripId === tripId))
        throw new AppError("Xərclər yazılmış səfərin valyutasını dəyişmək olmaz.", "validation");
      Object.assign(t, {
        name: input.name.trim(),
        destination: input.destination.trim(),
        startDate: input.startDate,
        endDate: input.endDate,
        currency: input.currency,
        budget: input.budget,
        cover: input.cover === undefined ? t.cover : input.cover,
      });
      this.log(db, tripId, "trip_updated", me.id, { title: t.name });
    });
  }

  async setArchived(tripId: ID, archived: boolean) {
    const s = this.me();
    await this.tx((db) => {
      const t = this.trip(db, tripId);
      const me = this.member(db, tripId, s.userId);
      if (me.role !== "admin") throw new AppError("Səfəri yalnız admin arxivləyə bilər.", "forbidden");
      t.archived = archived;
      this.log(db, tripId, archived ? "trip_archived" : "trip_unarchived", me.id, { title: t.name });
    });
  }

  async previewInvite(code: string): Promise<InvitePreview> {
    const s = this.me();
    return this.read((db) => {
      const t = db.trips.find((x) => x.inviteCode === code.trim().toUpperCase());
      if (!t) throw new AppError("Dəvət kodu tapılmadı. Kodu yoxlayın.", "not_found");
      const members = db.members.filter((m) => m.tripId === t.id && m.status === "active");
      return {
        tripId: t.id,
        name: t.name,
        destination: t.destination,
        startDate: t.startDate,
        endDate: t.endDate,
        memberCount: members.length,
        openSeats: members.filter((m) => !m.userId).map((m) => ({ id: m.id, name: m.name })),
        alreadyMember: members.some((m) => m.userId === s.userId),
      };
    });
  }

  async joinTrip(code: string, claimMemberId: ID | null) {
    const s = this.me();
    return this.tx((db) => {
      const t = db.trips.find((x) => x.inviteCode === code.trim().toUpperCase());
      if (!t) throw new AppError("Dəvət kodu tapılmadı. Kodu yoxlayın.", "not_found");
      if (t.archived) throw new AppError("Bu səfər arxivlənib, ona qoşulmaq olmur.", "archived");
      if (db.members.some((m) => m.tripId === t.id && m.userId === s.userId && m.status === "active")) return t.id;
      const profile = db.profiles.find((p) => p.id === s.userId)!;
      let seat: Member;
      if (claimMemberId) {
        const m = db.members.find((x) => x.id === claimMemberId && x.tripId === t.id && x.status === "active");
        if (!m || m.userId) throw new AppError("Bu yer artıq tutulub. Yeni iştirakçı kimi qoşulun.", "taken");
        m.userId = s.userId;
        m.avatar = profile.avatar;
        seat = m;
      } else {
        seat = { id: uid(), tripId: t.id, userId: s.userId, name: displayName(profile), avatar: profile.avatar, role: "member", status: "active", joinedAt: Date.now() };
        db.members.push(seat);
      }
      this.log(db, t.id, "member_joined", seat.id, { memberId: seat.id });
      const others = db.members.filter((m) => m.tripId === t.id && m.status === "active").map((m) => m.userId);
      this.notify(db, others, t.id, "member_joined", `${seat.name} «${t.name}» səfərinə qoşuldu.`, `/app/sefer/${t.id}/istirakcilar`, s.userId);
      return t.id;
    });
  }

  async addMember(tripId: ID, name: string, email?: string) {
    const s = this.me();
    const err = nameError(name, "İştirakçının adı");
    if (err) throw new AppError(err, "validation");
    if (email && emailError(email)) throw new AppError(emailError(email)!, "validation");
    await this.tx((db) => {
      const t = this.trip(db, tripId);
      const me = this.member(db, tripId, s.userId);
      if (me.role !== "admin") throw new AppError("İştirakçını yalnız admin əlavə edə bilər.", "forbidden");
      this.writable(t);
      const active = db.members.filter((m) => m.tripId === tripId && m.status === "active");
      if (active.some((m) => m.name.toLocaleLowerCase("az") === name.trim().toLocaleLowerCase("az")))
        throw new AppError("Bu adda iştirakçı artıq var.", "validation");
      if (active.length >= 30) throw new AppError("Bir səfərdə ən çox 30 iştirakçı ola bilər.", "validation");
      const m: Member = { id: uid(), tripId, userId: null, name: name.trim(), role: "member", status: "active", joinedAt: Date.now() };
      db.members.push(m);
      this.log(db, tripId, "member_added", me.id, { memberId: m.id });
      if (email) {
        const invited = db.users.find((u) => u.email === email.trim().toLowerCase());
        if (invited)
          this.notify(db, [invited.id], tripId, "trip_invite", `${me.name} sizi «${t.name}» səfərinə dəvət etdi.`, `/qosul/${t.inviteCode}`);
      }
    });
  }

  async removeMember(tripId: ID, memberId: ID) {
    const s = this.me();
    await this.tx((db) => {
      const t = this.trip(db, tripId);
      const me = this.member(db, tripId, s.userId);
      if (me.role !== "admin") throw new AppError("İştirakçını yalnız admin çıxara bilər.", "forbidden");
      this.writable(t);
      const m = db.members.find((x) => x.id === memberId && x.tripId === tripId && x.status === "active");
      if (!m) throw new AppError("İştirakçı tapılmadı.", "not_found");
      if (m.id === me.id || m.userId === t.createdBy) throw new AppError("Səfərin yaradıcısını çıxarmaq olmaz.", "forbidden");
      const b = this.bundle(db, tripId);
      const bal = computeBalances(b.members, b.expenses, b.payments).get(m.id)!;
      if (bal.outstanding !== 0) throw new AppError(`${m.name} hələ hesablaşmayıb. Əvvəlcə borclar bağlanmalıdır.`, "has_balance");
      if (bal.pendingIn || bal.pendingOut) throw new AppError(`${m.name} üçün təsdiq gözləyən ödəniş var.`, "has_pending");
      // Kept (status "removed") so past expenses and payments still show who was involved.
      m.status = "removed";
      this.log(db, tripId, "member_removed", me.id, { memberId: m.id });
    });
  }

  // ---------- expenses ----------

  async saveExpense(tripId: ID, input: ExpenseInput, expenseId?: ID) {
    const s = this.me();
    return this.tx((db) => {
      const t = this.trip(db, tripId);
      const me = this.member(db, tripId, s.userId);
      this.writable(t);
      const members = db.members.filter((m) => m.tripId === tripId);
      const existing = expenseId ? db.expenses.find((e) => e.id === expenseId && e.tripId === tripId) : undefined;
      if (expenseId && !existing) throw new AppError("Xərc tapılmadı.", "not_found");
      if (existing && me.role !== "admin" && existing.createdBy !== me.id)
        throw new AppError("Yalnız öz yazdığınız xərcləri dəyişə bilərsiniz.", "forbidden");
      const { shares, percents } = prepareExpense(input, members, existing);
      const now = Date.now();
      const exp: Expense = {
        id: existing?.id ?? uid(),
        tripId,
        title: input.title.trim(),
        amount: input.amount,
        category: input.category,
        paidBy: input.paidBy,
        method: input.method,
        shares,
        percents,
        date: input.date,
        note: input.note?.trim() || null,
        receipt: input.receipt ?? null,
        createdBy: existing?.createdBy ?? me.id,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      const userOf = (id: ID) => members.find((m) => m.id === id)?.userId;
      const money = formatMoney(exp.amount, t.currency);
      if (existing) {
        Object.assign(existing, exp);
        this.log(db, tripId, "expense_updated", me.id, { title: exp.title, amount: exp.amount, expenseId: exp.id, category: exp.category });
        const affected = [...Object.keys(shares), ...Object.keys(existing.shares), exp.paidBy].map(userOf);
        this.notify(db, affected, tripId, "balance_updated", `${me.name} «${exp.title}» xərcini dəyişdi — balansınız yeniləndi.`, `/app/sefer/${tripId}/xercler/${exp.id}`, s.userId);
      } else {
        db.expenses.push(exp);
        this.log(db, tripId, "expense_added", me.id, { title: exp.title, amount: exp.amount, expenseId: exp.id, category: exp.category });
        const affected = [...Object.keys(shares), exp.paidBy].map(userOf);
        this.notify(db, affected, tripId, "expense_added", `${me.name} «${exp.title}» xərcini əlavə etdi — ${money}.`, `/app/sefer/${tripId}/xercler/${exp.id}`, s.userId);
      }
      return exp;
    });
  }

  async deleteExpense(tripId: ID, expenseId: ID) {
    const s = this.me();
    await this.tx((db) => {
      const t = this.trip(db, tripId);
      const me = this.member(db, tripId, s.userId);
      this.writable(t);
      const e = db.expenses.find((x) => x.id === expenseId && x.tripId === tripId);
      if (!e) throw new AppError("Xərc tapılmadı.", "not_found");
      if (me.role !== "admin" && e.createdBy !== me.id) throw new AppError("Yalnız öz yazdığınız xərcləri silə bilərsiniz.", "forbidden");
      db.expenses = db.expenses.filter((x) => x.id !== expenseId);
      this.log(db, tripId, "expense_deleted", me.id, { title: e.title, amount: e.amount, category: e.category });
      const members = db.members.filter((m) => m.tripId === tripId);
      const affected = [...Object.keys(e.shares), e.paidBy].map((id) => members.find((m) => m.id === id)?.userId);
      this.notify(db, affected, tripId, "balance_updated", `${me.name} «${e.title}» xərcini sildi — balansınız yeniləndi.`, `/app/sefer/${tripId}/hesablasma`, s.userId);
    });
  }

  // ---------- payments ----------

  async markPaymentSent(tripId: ID, from: ID, to: ID, amount: number) {
    const s = this.me();
    await this.tx((db) => {
      const t = this.trip(db, tripId);
      const me = this.member(db, tripId, s.userId);
      this.writable(t);
      const debtor = db.members.find((m) => m.id === from && m.tripId === tripId);
      const receiver = db.members.find((m) => m.id === to && m.tripId === tripId);
      if (!debtor || !receiver) throw new AppError("İştirakçı tapılmadı.", "not_found");
      // The debtor reports their own payment; an admin may do it for a name-only seat.
      const allowed = debtor.id === me.id || (!debtor.userId && me.role === "admin");
      if (!allowed) throw new AppError("Ödənişi yalnız borclu özü qeyd edə bilər.", "forbidden");
      if (!Number.isSafeInteger(amount) || amount <= 0) throw new AppError("Məbləğ sıfırdan böyük olmalıdır.", "validation");
      const max = maxSendable(this.bundle(db, tripId), from, to);
      if (max === 0) throw new AppError("Bu istiqamətdə açıq borc yoxdur və ya hamısı təsdiq gözləyir.", "nothing_open");
      if (amount > max) throw new AppError(`Ən çox ${formatMoney(max, t.currency)} qeyd edə bilərsiniz.`, "too_much");
      const p: Payment = { id: uid(), tripId, from, to, amount, status: "pending", createdBy: me.id, createdAt: Date.now() };
      db.payments.push(p);
      this.log(db, tripId, "payment_sent", me.id, { from, to, amount });
      const money = formatMoney(amount, t.currency);
      const admins = db.members.filter((m) => m.tripId === tripId && m.role === "admin" && m.status === "active").map((m) => m.userId);
      this.notify(db, receiver.userId ? [receiver.userId] : admins, tripId, "payment_sent", `${debtor.name} ${receiver.userId ? "sizə" : receiver.name + " üçün"} ${money} göndərdiyini qeyd etdi. Təsdiq gözləyir.`, `/app/sefer/${tripId}/hesablasma`, s.userId);
    });
  }

  async resolvePayment(tripId: ID, paymentId: ID, action: "confirm" | "reject" | "cancel") {
    const s = this.me();
    await this.tx((db) => {
      const t = this.trip(db, tripId);
      const me = this.member(db, tripId, s.userId);
      this.writable(t);
      const p = db.payments.find((x) => x.id === paymentId && x.tripId === tripId);
      if (!p) throw new AppError("Ödəniş tapılmadı.", "not_found");
      if (p.status !== "pending")
        throw new AppError(p.status === "confirmed" ? "Bu ödəniş artıq təsdiqlənib." : "Bu ödəniş artıq bağlanıb.", "already_resolved");
      const receiver = db.members.find((m) => m.id === p.to)!;
      const debtor = db.members.find((m) => m.id === p.from)!;
      if (action === "cancel") {
        const canCancel = p.createdBy === me.id || p.from === me.id;
        if (!canCancel) throw new AppError("Ödənişi yalnız onu qeyd edən ləğv edə bilər.", "forbidden");
      } else {
        // Only the receiver confirms; an admin may act for a name-only receiver.
        const isReceiver = receiver.id === me.id || (!receiver.userId && me.role === "admin");
        if (!isReceiver) throw new AppError("Ödənişi yalnız pulu alan şəxs təsdiqləyə bilər.", "forbidden");
      }
      p.status = action === "confirm" ? "confirmed" : action === "reject" ? "rejected" : "cancelled";
      p.resolvedBy = me.id;
      p.resolvedAt = Date.now();
      this.log(db, tripId, action === "confirm" ? "payment_confirmed" : action === "reject" ? "payment_rejected" : "payment_cancelled", me.id, { from: p.from, to: p.to, amount: p.amount });
      const money = formatMoney(p.amount, t.currency);
      const creator = db.members.find((m) => m.id === p.createdBy);
      const notifyUsers = [debtor.userId ?? creator?.userId];
      if (action === "confirm")
        this.notify(db, notifyUsers, tripId, "payment_confirmed", `${receiver.name} ${money} ödənişinizi aldığını təsdiqlədi.`, `/app/sefer/${tripId}/hesablasma`, s.userId);
      if (action === "reject")
        this.notify(db, notifyUsers, tripId, "payment_rejected", `${receiver.name} ${money} ödənişin çatmadığını bildirdi. Borc dəyişmədi.`, `/app/sefer/${tripId}/hesablasma`, s.userId);
    });
  }

  // ---------- notifications ----------

  async listNotifications() {
    const s = this.sessionSync();
    if (!s) return [];
    return this.read((db) => db.notifications.filter((n) => n.userId === s.userId).sort((a, b) => b.at - a.at).slice(0, 100));
  }

  async markNotificationsRead(ids?: ID[]) {
    const s = this.me();
    await this.tx((db) => {
      for (const n of db.notifications) if (n.userId === s.userId && (!ids || ids.includes(n.id))) n.read = true;
    });
  }

  // ---------- demo helpers ----------

  /** Demo accounts available on the login screen (local mode only). */
  demoAccounts(): { email: string; name: string }[] {
    return this.db.profiles.filter((p) => p.email.endsWith("@demo.tripmate.az")).map((p) => ({ email: p.email, name: displayName(p) }));
  }
}
