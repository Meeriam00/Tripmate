/** Money helpers. All amounts are integers in minor units (2 decimals). */

export const CURRENCIES = [
  { code: "AZN", symbol: "₼", name: "Azərbaycan manatı" },
  { code: "EUR", symbol: "€", name: "Avro" },
  { code: "USD", symbol: "$", name: "ABŞ dolları" },
  { code: "TRY", symbol: "₺", name: "Türk lirəsi" },
  { code: "GBP", symbol: "£", name: "İngilis funtu" },
  { code: "GEL", symbol: "₾", name: "Gürcü larisi" },
] as const;

export function currencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

/**
 * 123450 → "1.234,50 ₼" (Azerbaijani number format). Done by hand rather
 * than with Intl, because not every browser ships Azerbaijani locale data.
 */
export function formatMoney(minor: number, currency: string, opts: { signed?: boolean } = {}): string {
  const abs = Math.abs(minor);
  const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const body = `${whole},${String(abs % 100).padStart(2, "0")} ${currencySymbol(currency)}`;
  if (minor < 0) return `−${body}`;
  if (minor > 0 && opts.signed) return `+${body}`;
  return body;
}

/**
 * Parse what a person types ("25", "25,5", "25.50", "1 234,50", "1.234,50")
 * into minor units. Returns null for anything that isn't a positive-or-zero
 * amount with at most two decimals.
 */
export function parseAmount(input: string): number | null {
  const s = input.trim().replace(/[\s ]/g, "");
  if (!s || !/^[\d.,]+$/.test(s)) return null;
  // The decimal separator is the last "," or "." if followed by 1–2 digits.
  const m = s.match(/^(.*?)(?:[.,](\d{1,2}))?$/)!;
  let whole = m[1];
  const frac = m[2] ?? "";
  if (whole === "" && !frac) return null;
  // Whatever is left may use "." or "," (not both) as a thousands separator,
  // and then every group after the first must be exactly three digits.
  if (/[.,]/.test(whole)) {
    if (!/^\d{1,3}([.,])\d{3}(\1\d{3})*$/.test(whole)) return null;
    whole = whole.replace(/[.,]/g, "");
  }
  const minor = Number(whole || "0") * 100 + Number((frac + "00").slice(0, 2));
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Minor units → value for an input field ("25,50"). */
export function toInputValue(minor: number): string {
  const whole = Math.floor(minor / 100);
  const frac = String(minor % 100).padStart(2, "0");
  return frac === "00" ? String(whole) : `${whole},${frac}`;
}
