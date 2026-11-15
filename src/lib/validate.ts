import { AppError, type ExpenseInput, type TripInput } from "../backend/types";
import { isISO } from "./dates";
import { CURRENCIES } from "./money";
import { computeSplit } from "./split";
import { CATEGORIES, type ID, type Member } from "./types";

/** Shared validation, used by the forms (for inline messages) and by every backend (as the rule). */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function emailError(email: string): string | null {
  if (!email.trim()) return "E-poçt ünvanını yazın.";
  if (!EMAIL_RE.test(email.trim())) return "E-poçt ünvanı düzgün deyil.";
  return null;
}

export function passwordError(pw: string): string | null {
  if (pw.length < 8) return "Şifrə ən azı 8 simvol olmalıdır.";
  if (!/[A-Za-zƏəÖöÜüĞğİıŞşÇç]/.test(pw) || !/\d/.test(pw)) return "Şifrədə ən azı bir hərf və bir rəqəm olsun.";
  return null;
}

export function nameError(name: string, label = "Ad"): string | null {
  const n = name.trim();
  if (!n) return `${label} boş ola bilməz.`;
  if (n.length > 40) return `${label} 40 simvoldan uzun ola bilməz.`;
  return null;
}

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export function tripErrors(t: TripInput): FieldErrors<keyof TripInput> {
  const e: FieldErrors<keyof TripInput> = {};
  const name = t.name.trim();
  if (!name) e.name = "Səfərin adını yazın.";
  else if (name.length > 60) e.name = "Ad 60 simvoldan uzun ola bilməz.";
  if (!t.destination.trim()) e.destination = "Hara gedirsiniz? Şəhər və ya ölkə yazın.";
  else if (t.destination.trim().length > 80) e.destination = "Məkan adı çox uzundur.";
  if (!isISO(t.startDate)) e.startDate = "Başlanğıc tarixini seçin.";
  if (!isISO(t.endDate)) e.endDate = "Bitmə tarixini seçin.";
  else if (isISO(t.startDate) && t.endDate < t.startDate) e.endDate = "Bitmə tarixi başlanğıcdan əvvəl ola bilməz.";
  if (!CURRENCIES.some((c) => c.code === t.currency)) e.currency = "Valyutanı seçin.";
  if (t.budget !== null && (!Number.isSafeInteger(t.budget) || t.budget <= 0)) e.budget = "Büdcə müsbət məbləğ olmalıdır.";
  return e;
}

export function assertTrip(t: TripInput) {
  const errs = Object.values(tripErrors(t));
  if (errs.length) throw new AppError(errs[0]!, "validation");
}

export function participantNamesError(names: string[]): string | null {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  for (const n of clean) {
    const err = nameError(n, "İştirakçının adı");
    if (err) return err;
  }
  const lower = clean.map((n) => n.toLocaleLowerCase("az"));
  if (new Set(lower).size !== lower.length) return "Eyni adlı iki iştirakçı var — fərqləndirin (məs. Əli M.).";
  if (clean.length > 30) return "Bir səfərdə ən çox 30 iştirakçı ola bilər.";
  return null;
}

/**
 * Validate an expense against the trip's members and compute its final shares.
 * `existing` is the expense being edited: members it already included may
 * stay on it even if they have since been removed from the trip.
 */
export function prepareExpense(
  input: ExpenseInput,
  members: Member[],
  existing?: { shares: Record<ID, number>; paidBy: ID },
): { shares: Record<ID, number>; percents: Record<ID, number> | null } {
  const title = input.title.trim();
  if (!title) throw new AppError("Xərcin adını yazın.", "validation");
  if (title.length > 80) throw new AppError("Xərcin adı 80 simvoldan uzun ola bilməz.", "validation");
  if (!CATEGORIES.includes(input.category)) throw new AppError("Kateqoriya seçin.", "validation");
  if (!isISO(input.date)) throw new AppError("Tarixi seçin.", "validation");
  if ((input.note ?? "").length > 300) throw new AppError("Qeyd 300 simvoldan uzun ola bilməz.", "validation");

  const allowed = new Set(members.filter((m) => m.status === "active").map((m) => m.id));
  if (existing) for (const id of [...Object.keys(existing.shares), existing.paidBy]) allowed.add(id);
  if (!allowed.has(input.paidBy)) throw new AppError("Ödəyən şəxs bu səfərin iştirakçısı deyil.", "validation");
  for (const id of input.participantIds)
    if (!allowed.has(id)) throw new AppError("Seçilən iştirakçılardan biri bu səfərdə deyil.", "validation");

  const res = computeSplit({
    amount: input.amount,
    method: input.method,
    payerId: input.paidBy,
    participantIds: input.participantIds,
    custom: input.custom,
    percents: input.percents,
    order: members.map((m) => m.id),
  });
  if (!res.ok) throw new AppError(res.error, "validation");
  return { shares: res.shares, percents: res.percents };
}
