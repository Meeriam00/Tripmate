import { CATEGORY_META } from "./categories";
import { toInputValue } from "./money";
import { sharesFor } from "./split";
import type { Trip } from "./types";

function cell(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Expenses as CSV: one row per expense with each person's share in its own
 * column, then recorded settlement payments. Opens cleanly in Excel,
 * Numbers and Google Sheets.
 */
export function tripToCSV(trip: Trip): string {
  const order = trip.participants.map((p) => p.id);
  const name = (id: string) => trip.participants.find((p) => p.id === id)?.name ?? "Removed";
  const cur = trip.currency;
  const rows: (string | number)[][] = [];
  rows.push([
    "Date",
    "Expense",
    "Category",
    "Paid by",
    `Amount (${cur})`,
    "Split",
    "Original amount",
    "Note",
    ...trip.participants.map((p) => `${p.name} share`),
  ]);
  const sorted = [...trip.expenses].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  for (const e of sorted) {
    const shares = sharesFor(e, order);
    rows.push([
      e.date,
      e.title,
      CATEGORY_META[e.category].label,
      name(e.paidBy),
      toInputValue(e.amount, cur),
      e.split.mode === "equal" ? "Equal" : e.split.mode === "exact" ? "Exact amounts" : "By shares",
      e.original ? `${toInputValue(e.original.amount, e.original.currency)} ${e.original.currency} @ ${e.original.rate}` : "",
      e.note ?? "",
      ...order.map((id) => toInputValue(shares.get(id) ?? 0, cur)),
    ]);
  }
  if (trip.payments.length) {
    rows.push([]);
    rows.push(["Date", "Settlement", "", "From", `Amount (${cur})`, "To"]);
    for (const p of trip.payments) rows.push([p.date, "Payment", "", name(p.from), toInputValue(p.amount, cur), name(p.to)]);
  }
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "trip";
}
