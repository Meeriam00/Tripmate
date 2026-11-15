import { settlement } from "./balances";
import type { Category, Expense, Trip } from "./types";

export const SAMPLE_TRIP_ID = "numune-qebele";

const M = "p-maryam";
const A = "p-ali";
const L = "p-leyla";
const MU = "p-murad";
const AY = "p-aysel";
const ALL = [M, A, L, MU, AY];

/**
 * A realistic five-friend long weekend in Qabala, shown on first visit.
 * One settlement is already marked as paid so both statuses are visible.
 */
export function sampleTrip(): Trip {
  let n = 0;
  const e = (
    title: string,
    amount: number,
    paidBy: string,
    category: Category,
    date: string,
    extra: Partial<Expense> = {},
  ): Expense => ({
    id: `numune-x${++n}`,
    title,
    amount,
    paidBy,
    participantIds: ALL,
    category,
    date,
    createdAt: Date.parse(`${date}T09:00:00Z`) + n * 3_600_000,
    ...extra,
  });
  const trip: Trip = {
    id: SAMPLE_TRIP_ID,
    name: "Qəbələ həftəsonu",
    destination: "Qəbələ, Azərbaycan",
    startDate: "2026-07-10",
    endDate: "2026-07-13",
    currency: "AZN",
    budget: 150000,
    participants: [
      { id: M, name: "Məryəm" },
      { id: A, name: "Əli" },
      { id: L, name: "Leyla" },
      { id: MU, name: "Murad" },
      { id: AY, name: "Aysel" },
    ],
    expenses: [
      e("Benzin", 9000, A, "transport", "2026-07-10"),
      e("Ev kirayəsi, 3 gecə", 54000, M, "stay", "2026-07-10", { note: "Tufandağ yaxınlığında, iki otaqlı ev." }),
      e("Bazarlıq", 12750, AY, "food", "2026-07-10"),
      e("Kanat yolu biletləri", 10000, MU, "fun", "2026-07-11", { participantIds: [M, A, L, MU], note: "Aysel kanat yoluna qalxmadı." }),
      e("Şam yeməyi, «Qəbələ» restoranı", 18500, L, "food", "2026-07-11"),
      e("Atçılıq", 7500, A, "fun", "2026-07-12", { participantIds: [A, L, MU] }),
      e("Suvenirlər", 6000, AY, "shopping", "2026-07-12", {
        participantIds: [AY, M, L],
        custom: { [AY]: 3000, [M]: 2000, [L]: 1000 },
        note: "Hərə özü seçdiyinin pulunu verir.",
      }),
      e("Səhər yeməyi", 6300, M, "food", "2026-07-13"),
      e("Yol pulu və dayanacaq", 2400, MU, "transport", "2026-07-13"),
    ],
    payments: [],
    activity: [],
    createdAt: Date.UTC(2026, 6, 1),
    updatedAt: Date.UTC(2026, 6, 13),
  };
  // Mark the smallest suggested transfer as already paid.
  const smallest = settlement(trip).at(-1);
  if (smallest) trip.payments.push({ id: "numune-odenis", ...smallest, createdAt: Date.UTC(2026, 6, 13, 18) });
  // Activity history to match: every expense added, then the payment.
  const name = (id: string) => trip.participants.find((p) => p.id === id)!.name;
  trip.activity = [
    ...trip.payments.map((p) => ({ id: `a-${p.id}`, kind: "paid" as const, title: `${name(p.from)} → ${name(p.to)}`, amount: p.amount, at: p.createdAt })),
    ...[...trip.expenses].reverse().map((e) => ({ id: `a-${e.id}`, kind: "add" as const, title: e.title, amount: e.amount, at: e.createdAt })),
  ];
  return trip;
}
