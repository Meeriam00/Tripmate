import type { Category, Expense, Split, Trip } from "./types";

export const SAMPLE_TRIP_ID = "sample-lisbon";

const P = {
  maryam: "p-maryam",
  ali: "p-ali",
  leyla: "p-leyla",
  murad: "p-murad",
  aysel: "p-aysel",
};
const ALL = Object.values(P);

const eq = (...ids: string[]): Split => ({ mode: "equal", participantIds: ids.length ? ids : ALL });

let n = 0;
function e(
  title: string,
  amount: number,
  paidBy: string,
  category: Category,
  date: string,
  split: Split = eq(),
  note?: string,
): Expense {
  n++;
  return { id: `sample-e${n}`, title, amount, paidBy, category, date, split, note, createdAt: Date.UTC(2026, 4, 14) + n * 60000 };
}

/** A realistic five-person long weekend in Lisbon, used for the demo and first run. */
export function sampleTrip(): Trip {
  n = 0;
  const expenses: Expense[] = [
    e("Alfama apartment, deposit", 56000, P.maryam, "accommodation", "2026-05-14", eq(), "Booked in March. Two bedrooms and a sofa bed."),
    e("Alfama apartment, balance", 56000, P.leyla, "accommodation", "2026-05-14", eq(), "Paid to the host on arrival."),
    e("Airport taxi", 3840, P.ali, "transport", "2026-05-14"),
    e("Groceries at Pingo Doce", 6327, P.aysel, "food", "2026-05-14", eq(), "Breakfast things, wine, coffee."),
    e("Time Out Market dinner", 14250, P.leyla, "food", "2026-05-14"),
    e("Tram 28 day passes", 3200, P.leyla, "transport", "2026-05-15"),
    e("Pastéis de Belém", 1750, P.aysel, "food", "2026-05-15"),
    e(
      "Fado night at Clube de Fado",
      21000,
      P.maryam,
      "activities",
      "2026-05-15",
      { mode: "exact", amounts: { [P.maryam]: 4500, [P.ali]: 4000, [P.leyla]: 4500, [P.murad]: 4000, [P.aysel]: 4000 } },
      "Cover is €35 each, the rest is what everyone drank.",
    ),
    e("Train to Sintra", 2400, P.murad, "transport", "2026-05-16"),
    e("Pena Palace tickets", 8000, P.murad, "activities", "2026-05-16", eq(P.maryam, P.ali, P.leyla, P.murad), "Aysel stayed in town."),
    e("Seafood lunch at Ramiro", 18760, P.murad, "food", "2026-05-16"),
    e("Surf lesson, Costa da Caparica", 13500, P.ali, "activities", "2026-05-17", eq(P.ali, P.leyla, P.murad)),
    e("Car hire for Cascais", 7400, P.ali, "transport", "2026-05-17"),
    e("Gift for our host", 3000, P.aysel, "shopping", "2026-05-17"),
    e("Late-night pizza", 4100, P.leyla, "food", "2026-05-17", eq(P.ali, P.leyla, P.murad)),
  ];
  return {
    id: SAMPLE_TRIP_ID,
    name: "Lisbon long weekend",
    destination: "Lisbon, Portugal",
    startDate: "2026-05-14",
    endDate: "2026-05-18",
    currency: "EUR",
    participants: [
      { id: P.maryam, name: "Maryam", color: 0 },
      { id: P.ali, name: "Ali", color: 1 },
      { id: P.leyla, name: "Leyla", color: 2 },
      { id: P.murad, name: "Murad", color: 3 },
      { id: P.aysel, name: "Aysel", color: 5 },
    ],
    expenses,
    payments: [],
    createdAt: Date.UTC(2026, 4, 1),
    updatedAt: Date.UTC(2026, 4, 18),
  };
}
