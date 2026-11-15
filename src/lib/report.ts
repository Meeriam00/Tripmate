import { categoryTotals, computeBalances, settlement, tripTotal } from "./balances";
import { CATEGORY } from "./categories";
import { formatRange } from "./dates";
import { formatMoney, toInputValue } from "./money";
import { sharesFor } from "./split";
import type { Trip } from "./types";

/** A few plain-language observations about a trip. Only what's actually true and useful. */
export function insights(trip: Trip): string[] {
  const total = tripTotal(trip);
  if (!total) return [];
  const cur = trip.currency;
  const out: string[] = [];
  const top = categoryTotals(trip)[0];
  if (top) out.push(`Ən çox pul ${CATEGORY[top.category].label.toLocaleLowerCase("az")} xərclərinə gedib: ümumi məbləğin ${Math.round((top.amount / total) * 100)}%-i.`);
  const balances = computeBalances(trip);
  const payer = [...trip.participants].sort((a, b) => balances.get(b.id)!.paid - balances.get(a.id)!.paid)[0];
  if (payer) out.push(`Ən çox ödəyən ${payer.name} olub: ${formatMoney(balances.get(payer.id)!.paid, cur)}.`);
  out.push(`Adambaşı orta xərc ${formatMoney(Math.round(total / trip.participants.length), cur)} təşkil edir.`);
  if (trip.budget) {
    const left = trip.budget - total;
    out.push(left >= 0 ? `Büdcədən ${formatMoney(left, cur)} qənaət olunub.` : `Büdcə ${formatMoney(-left, cur)} aşılıb.`);
  }
  return out;
}

function cell(v: string | number): string {
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Full report as CSV: expenses with each person's share, balances and the
 * settlement plan. Semicolon-separated with a BOM so Excel opens it correctly
 * with Azerbaijani letters and decimal commas.
 */
export function tripCSV(trip: Trip): string {
  const order = trip.participants.map((p) => p.id);
  const name = (id: string) => trip.participants.find((p) => p.id === id)?.name ?? "Silinmiş şəxs";
  const rows: (string | number)[][] = [];
  rows.push([`TRIPMATE — ${trip.name}`]);
  rows.push([[trip.destination, formatRange(trip.startDate, trip.endDate)].filter(Boolean).join(", ")]);
  rows.push([]);
  rows.push(["Tarix", "Xərc", "Kateqoriya", "Ödəyən", `Məbləğ (${trip.currency})`, "Bölgü", "Qeyd", ...trip.participants.map((p) => `${p.name} payı`)]);
  for (const e of [...trip.expenses].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)) {
    const sh = sharesFor(e, order);
    rows.push([
      e.date,
      e.title,
      CATEGORY[e.category].label,
      name(e.paidBy),
      toInputValue(e.amount),
      e.custom ? "Fərdi" : "Bərabər",
      e.note ?? "",
      ...order.map((id) => toInputValue(sh.get(id) ?? 0)),
    ]);
  }
  rows.push(["", "Cəmi", "", "", toInputValue(tripTotal(trip))]);
  rows.push([]);
  rows.push(["Balanslar"]);
  rows.push(["Ad", "Ödədi", "Payı", "Balans", "Vəziyyət"]);
  const balances = computeBalances(trip);
  for (const p of trip.participants) {
    const b = balances.get(p.id)!;
    rows.push([p.name, toInputValue(b.paid), toInputValue(b.share), (b.net < 0 ? "-" : "") + toInputValue(Math.abs(b.net)), b.net > 0 ? "alacaq" : b.net < 0 ? "borclu" : "bərabər"]);
  }
  rows.push([]);
  rows.push(["Hesablaşma"]);
  rows.push(["Ödəyən", "Alan", "Məbləğ", "Vəziyyət"]);
  for (const t of settlement(trip)) rows.push([name(t.from), name(t.to), toInputValue(t.amount), "Ödənilməyib"]);
  for (const p of trip.payments) rows.push([name(p.from), name(p.to), toInputValue(p.amount), "Ödənilib"]);
  return "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** File-name-safe version of a trip name, keeping Azerbaijani letters readable in ASCII. */
export function fileSlug(s: string): string {
  const map: Record<string, string> = { ə: "e", ı: "i", ö: "o", ü: "u", ç: "c", ş: "s", ğ: "g", Ə: "e", İ: "i", I: "i", Ö: "o", Ü: "u", Ç: "c", Ş: "s", Ğ: "g" };
  return (
    s
      .replace(/[əıöüçşğƏİIÖÜÇŞĞ]/g, (c) => map[c])
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "sefer"
  );
}

