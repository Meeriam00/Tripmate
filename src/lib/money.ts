/** Money helpers. Everything works on integer minor units. */

const decimalsCache = new Map<string, number>();

/** Number of fraction digits a currency uses (EUR 2, JPY 0, KWD 3). */
export function currencyDecimals(currency: string): number {
  const hit = decimalsCache.get(currency);
  if (hit !== undefined) return hit;
  let d = 2;
  try {
    d =
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2;
  } catch {
    d = 2;
  }
  decimalsCache.set(currency, d);
  return d;
}

/**
 * Parse user input ("12", "12.5", "1,234.56", "12,50") into minor units.
 * Returns null for anything that is not a non-negative number, or that has
 * more precision than the currency allows.
 */
export function parseAmount(input: string, currency: string): number | null {
  const decimals = currencyDecimals(currency);
  let s = input.trim().replace(/\s/g, "");
  if (!s) return null;
  // Accept a comma as decimal separator when it is the only separator.
  if (s.includes(",") && !s.includes(".")) {
    const parts = s.split(",");
    // "12,5" / "12,50" read as decimals; "1,234" reads as thousands.
    if (parts.length === 2 && parts[1].length >= 1 && parts[1].length <= 2) s = parts.join(".");
    else s = parts.join("");
  } else {
    s = s.replace(/,/g, "");
  }
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  if (frac.length > decimals) return null;
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const minor = Number(whole || "0") * 10 ** decimals + Number(padded || "0");
  if (!Number.isSafeInteger(minor)) return null;
  return minor;
}

/** Minor units -> plain decimal string for inputs ("12.50"). */
export function toInputValue(minor: number, currency: string): string {
  const d = currencyDecimals(currency);
  if (d === 0) return String(minor);
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 10 ** d);
  const frac = String(abs % 10 ** d).padStart(d, "0");
  return `${sign}${whole}.${frac}`;
}

const fmtCache = new Map<string, Intl.NumberFormat>();

export function formatMoney(
  minor: number,
  currency: string,
  opts: { signed?: boolean; compact?: boolean } = {},
): string {
  const d = currencyDecimals(currency);
  const key = `${currency}|${opts.compact ? 1 : 0}`;
  let f = fmtCache.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency,
        minimumFractionDigits: opts.compact ? 0 : d,
        maximumFractionDigits: opts.compact ? 0 : d,
      });
    } catch {
      f = new Intl.NumberFormat("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
    }
    fmtCache.set(key, f);
  }
  const value = Math.abs(minor) / 10 ** d;
  const body = f.format(opts.compact ? Math.round(value) : value);
  if (minor === 0) return body;
  if (minor < 0) return `−${body}`;
  return opts.signed ? `+${body}` : body;
}

/** Convert an amount between currencies with a user-supplied rate, rounding half-up to minor units. */
export function convert(amountMinor: number, from: string, to: string, rate: number): number {
  const fromD = currencyDecimals(from);
  const toD = currencyDecimals(to);
  const major = amountMinor / 10 ** fromD;
  return Math.round(major * rate * 10 ** toD);
}

export const COMMON_CURRENCIES = [
  "EUR",
  "USD",
  "GBP",
  "AZN",
  "TRY",
  "GEL",
  "AED",
  "CHF",
  "JPY",
  "CZK",
  "PLN",
  "SEK",
  "NOK",
  "DKK",
  "HUF",
  "THB",
  "CAD",
  "AUD",
] as const;
