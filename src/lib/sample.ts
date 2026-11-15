import type { Expense, Trip } from "./types";

export const SAMPLE_TRIP_ID = "numune-qebele";

const M = "p-maryam";
const A = "p-ali";
const L = "p-leyla";
const MU = "p-murad";
const AY = "p-aysel";
const ALL = [M, A, L, MU, AY];

/** A realistic five-friend weekend in Qabala, shown on first visit. */
export function sampleTrip(): Trip {
  let n = 0;
  const e = (title: string, amount: number, paidBy: string, participantIds = ALL): Expense => ({
    id: `numune-x${++n}`,
    title,
    amount,
    paidBy,
    participantIds,
    createdAt: Date.UTC(2026, 6, 10) + n * 60_000,
  });
  return {
    id: SAMPLE_TRIP_ID,
    name: "Qəbələ həftəsonu",
    destination: "Qəbələ, Azərbaycan",
    currency: "AZN",
    participants: [
      { id: M, name: "Məryəm" },
      { id: A, name: "Əli" },
      { id: L, name: "Leyla" },
      { id: MU, name: "Murad" },
      { id: AY, name: "Aysel" },
    ],
    expenses: [
      e("Benzin", 9000, A),
      e("Ev kirayəsi, 2 gecə", 40000, M),
      e("Bazarlıq", 12750, AY),
      e("Kanat yolu biletləri", 10000, MU, [M, A, L, MU]),
      e("Şam yeməyi", 18500, L),
      e("Səhər yeməyi", 6300, M),
      e("Atçılıq", 7500, A, [A, L, MU]),
    ],
    createdAt: Date.UTC(2026, 6, 10),
    updatedAt: Date.UTC(2026, 6, 12),
  };
}
