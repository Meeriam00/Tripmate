import { equalShares, percentShares } from "../lib/split";
import type { Activity, Category, Expense, ID, Member, SplitMethod, Trip } from "../lib/types";
import { defaultProfile, inviteCode, makeUser, uid, type LocalDB } from "./local";

/**
 * Demo data for local mode: five friends and two trips, so a visitor can
 * explore TRIPMATE straight away. The Italy trip reproduces the brief's
 * example exactly: €1.250 spent of a €2.000 budget, balances
 * Məryəm +120, Əli −70, Leyla +30, Murad −50, Nigar −30.
 */

export const DEMO_PASSWORD = "demo1234";

const PEOPLE = [
  { key: "maryam", first: "Məryəm", last: "Hüseynova" },
  { key: "ali", first: "Əli", last: "Məmmədov" },
  { key: "leyla", first: "Leyla", last: "Quliyeva" },
  { key: "murad", first: "Murad", last: "Əliyev" },
  { key: "nigar", first: "Nigar", last: "Rəhimova" },
] as const;
type Key = (typeof PEOPLE)[number]["key"];

const at = (iso: string, hour = 12, min = 0) => new Date(`${iso}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`).getTime();

export async function seedDemo(db: LocalDB) {
  const users: Record<Key, ID> = {} as Record<Key, ID>;
  for (const p of PEOPLE) {
    const u = await makeUser(`${p.key}@demo.tripmate.az`, DEMO_PASSWORD);
    users[p.key] = u.id;
    db.users.push(u);
    db.profiles.push({
      ...defaultProfile(u.id, u.email),
      firstName: p.first,
      lastName: p.last,
      currency: p.key === "maryam" ? "EUR" : "AZN",
      completed: true,
      createdAt: at("2026-05-20"),
    });
  }
  const nameOf = (k: Key) => PEOPLE.find((p) => p.key === k)!.first + " " + PEOPLE.find((p) => p.key === k)!.last;

  // ---------- Trip 1: Italy (past, EUR) ----------
  const italy: Trip = {
    id: uid(),
    name: "İtaliya yay səfəri",
    destination: "Roma, İtaliya",
    startDate: "2026-06-15",
    endDate: "2026-06-22",
    currency: "EUR",
    budget: 200_000,
    cover: null,
    inviteCode: inviteCode(),
    createdBy: users.maryam,
    archived: false,
    createdAt: at("2026-05-28", 20),
  };
  db.trips.push(italy);
  const im: Record<Key, Member> = {} as Record<Key, Member>;
  PEOPLE.forEach((p, i) => {
    im[p.key] = { id: uid(), tripId: italy.id, userId: users[p.key], name: nameOf(p.key), role: i === 0 ? "admin" : "member", status: "active", joinedAt: at("2026-05-28", 20, i * 7) };
    db.members.push(im[p.key]);
  });
  const order = PEOPLE.map((p) => im[p.key].id);
  const everyone = order;
  const act = (tripId: ID, kind: Activity["kind"], actor: ID | null, data: Activity["data"], time: number) =>
    db.activity.push({ id: uid(), tripId, kind, actor, data, at: time });

  act(italy.id, "trip_created", im.maryam.id, { title: italy.name }, italy.createdAt);
  for (const p of PEOPLE.slice(1)) act(italy.id, "member_joined", im[p.key].id, { memberId: im[p.key].id }, im[p.key].joinedAt);

  const add = (
    trip: Trip,
    ms: Record<string, Member>,
    ord: ID[],
    title: string,
    euros: number,
    category: Category,
    payer: string,
    date: string,
    hour: number,
    opts: { method?: SplitMethod; ids?: ID[]; custom?: Record<ID, number>; percents?: Record<ID, number>; note?: string } = {},
  ) => {
    const amount = Math.round(euros * 100);
    const method = opts.method ?? "equal";
    const ids = opts.ids ?? ord;
    const shares =
      method === "equal" ? equalShares(amount, ids, ms[payer].id, ord) : method === "percent" ? percentShares(amount, opts.percents!, ms[payer].id, ord) : opts.custom!;
    const t = at(date, hour);
    const e: Expense = {
      id: uid(),
      tripId: trip.id,
      title,
      amount,
      category,
      paidBy: ms[payer].id,
      method,
      shares,
      percents: opts.percents ?? null,
      date,
      note: opts.note ?? null,
      receipt: null,
      createdBy: ms[payer].id,
      createdAt: t,
      updatedAt: t,
    };
    db.expenses.push(e);
    act(trip.id, "expense_added", ms[payer].id, { title, amount, expenseId: e.id, category }, t);
    return e;
  };

  add(italy, im, everyone, "Vatikan muzeyi biletləri", 150, "fun", "murad", "2026-06-16", 10);
  add(italy, im, everyone, "Kolizey turu", 125, "fun", "nigar", "2026-06-16", 15);
  add(italy, im, everyone, "Qatar: Roma – Florensiya", 60, "transport", "ali", "2026-06-17", 9);
  add(italy, im, everyone, "Suvenir və market", 60, "shopping", "leyla", "2026-06-18", 18);
  add(italy, im, everyone, "Kofe və dondurma", 50, "food", "murad", "2026-06-19", 16);
  add(italy, im, everyone, "Tibr çayında qayıq turu", 95, "fun", "nigar", "2026-06-19", 19);
  add(italy, im, everyone, "Trastevere-də şam yeməyi", 185, "food", "leyla", "2026-06-20", 21, { note: "Pasta cacio e pepe hamının xoşuna gəldi." });
  add(italy, im, everyone, "Otel (7 gecə)", 370, "stay", "maryam", "2026-06-21", 11, { note: "Bron Booking-dən, səhər yeməyi daxil." });
  add(italy, im, everyone, "Restoran", 120, "food", "ali", "2026-06-21", 20);
  add(italy, im, everyone, "Taksi hava limanına", 35, "transport", "leyla", "2026-06-22", 7);

  // Əli has reported part of his debt; Məryəm still has to confirm it.
  const paidAt = Date.now() - 3 * 3600_000;
  db.payments.push({ id: uid(), tripId: italy.id, from: im.ali.id, to: im.maryam.id, amount: 4000, status: "pending", createdBy: im.ali.id, createdAt: paidAt });
  act(italy.id, "payment_sent", im.ali.id, { from: im.ali.id, to: im.maryam.id, amount: 4000 }, paidAt);
  db.notifications.push({
    id: uid(),
    userId: users.maryam,
    tripId: italy.id,
    kind: "payment_sent",
    text: "Əli Məmmədov sizə 40,00 € göndərdiyini qeyd etdi. Təsdiq gözləyir.",
    link: `/app/sefer/${italy.id}/hesablasma`,
    read: false,
    at: paidAt,
  });

  // ---------- Trip 2: Qəbələ (upcoming, AZN) ----------
  const gabala: Trip = {
    id: uid(),
    name: "Qəbələdə qış həftəsonu",
    destination: "Qəbələ, Azərbaycan",
    startDate: "2026-12-18",
    endDate: "2026-12-20",
    currency: "AZN",
    budget: 90_000,
    cover: null,
    inviteCode: inviteCode(),
    createdBy: users.maryam,
    archived: false,
    createdAt: at("2026-11-02", 19),
  };
  db.trips.push(gabala);
  const gm: Record<string, Member> = {};
  (["maryam", "leyla", "nigar"] as Key[]).forEach((k, i) => {
    gm[k] = { id: uid(), tripId: gabala.id, userId: users[k], name: nameOf(k), role: i === 0 ? "admin" : "member", status: "active", joinedAt: at("2026-11-02", 19, i * 11) };
    db.members.push(gm[k]);
  });
  gm.kamran = { id: uid(), tripId: gabala.id, userId: null, name: "Kamran", role: "member", status: "active", joinedAt: at("2026-11-02", 19, 40) };
  db.members.push(gm.kamran);
  const gOrder = [gm.maryam.id, gm.leyla.id, gm.nigar.id, gm.kamran.id];
  act(gabala.id, "trip_created", gm.maryam.id, { title: gabala.name }, gabala.createdAt);
  act(gabala.id, "member_joined", gm.leyla.id, { memberId: gm.leyla.id }, gm.leyla.joinedAt);
  act(gabala.id, "member_joined", gm.nigar.id, { memberId: gm.nigar.id }, gm.nigar.joinedAt);
  act(gabala.id, "member_added", gm.maryam.id, { memberId: gm.kamran.id }, gm.kamran.joinedAt);
  add(gabala, gm, gOrder, "Kotecin ön ödənişi", 300, "stay", "maryam", "2026-11-05", 13, { note: "Qalan 300 ₼ yerində ödənəcək." });
  add(gabala, gm, gOrder, "Qatar biletləri (gediş-dönüş)", 96, "transport", "leyla", "2026-11-08", 10, {
    method: "percent",
    percents: { [gm.maryam.id]: 2500, [gm.leyla.id]: 2500, [gm.nigar.id]: 2500, [gm.kamran.id]: 2500 },
  });
  add(gabala, gm, gOrder, "Kanat yolu biletləri", 72, "fun", "nigar", "2026-11-10", 18, {
    method: "custom",
    ids: [gm.nigar.id, gm.leyla.id, gm.maryam.id],
    custom: { [gm.nigar.id]: 2400, [gm.leyla.id]: 2400, [gm.maryam.id]: 2400 },
  });
}
