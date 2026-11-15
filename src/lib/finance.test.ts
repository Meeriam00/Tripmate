import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { computeLedgers, outstandingBalances, totalOutstanding } from "./balances";
import { convert, formatMoney, parseAmount } from "./money";
import { minimizeTransfers } from "./settle";
import { allocate, computeShares, validateSplit } from "./split";
import type { Expense, Trip } from "./types";

const FIVE = ["maryam", "ali", "leyla", "murad", "aysel"];

function trip(expenses: Partial<Expense>[], payments: Trip["payments"] = []): Trip {
  return {
    id: "t",
    name: "Test",
    destination: "Lisbon",
    startDate: "2026-05-01",
    endDate: "2026-05-05",
    currency: "EUR",
    participants: FIVE.map((id, i) => ({ id, name: id, color: i })),
    expenses: expenses.map((e, i) => ({
      id: `e${i}`,
      title: "x",
      amount: 0,
      paidBy: "maryam",
      category: "other",
      date: "2026-05-01",
      split: { mode: "equal", participantIds: FIVE },
      createdAt: i,
      ...e,
    })) as Expense[],
    payments,
    createdAt: 0,
    updatedAt: 0,
  };
}

const sum = (m: Map<string, number>) => [...m.values()].reduce((s, v) => s + v, 0);

/** Apply transfers to balances and assert everyone ends at zero. */
function assertSettles(balances: Map<string, number>, transfers: ReturnType<typeof minimizeTransfers>) {
  const b = new Map(balances);
  for (const t of transfers) {
    assert.ok(t.amount > 0, "transfer amounts are positive");
    assert.notEqual(t.from, t.to);
    b.set(t.from, (b.get(t.from) ?? 0) + t.amount);
    b.set(t.to, (b.get(t.to) ?? 0) - t.amount);
  }
  for (const [id, v] of b) assert.equal(v, 0, `${id} should be square`);
}

describe("money", () => {
  it("parses amounts into minor units", () => {
    assert.equal(parseAmount("100", "EUR"), 10000);
    assert.equal(parseAmount("12.5", "EUR"), 1250);
    assert.equal(parseAmount("12,50", "EUR"), 1250);
    assert.equal(parseAmount("1,234.56", "EUR"), 123456);
    assert.equal(parseAmount(".99", "EUR"), 99);
    assert.equal(parseAmount("1500", "JPY"), 1500);
  });
  it("rejects invalid or over-precise input", () => {
    assert.equal(parseAmount("", "EUR"), null);
    assert.equal(parseAmount("abc", "EUR"), null);
    assert.equal(parseAmount("-5", "EUR"), null);
    assert.equal(parseAmount("1.234", "EUR"), null);
    assert.equal(parseAmount("10.5", "JPY"), null);
  });
  it("formats with a true minus sign and optional plus", () => {
    assert.equal(formatMoney(10000, "EUR"), "€100.00");
    assert.equal(formatMoney(-5000, "EUR"), "−€50.00");
    assert.equal(formatMoney(5000, "EUR", { signed: true }), "+€50.00");
    assert.equal(formatMoney(0, "EUR", { signed: true }), "€0.00");
  });
  it("converts between currencies with different minor units", () => {
    assert.equal(convert(10000, "USD", "EUR", 0.92), 9200);
    assert.equal(convert(1000, "JPY", "EUR", 0.0061), 610);
  });
});

describe("splitting", () => {
  it("€100 shared by five is €20 each", () => {
    const s = computeShares(10000, { mode: "equal", participantIds: FIVE }, "maryam", FIVE);
    assert.deepEqual([...s.values()], [2000, 2000, 2000, 2000, 2000]);
  });

  it("uneven cents: €100 / 3 sums exactly, payer takes the extra cent", () => {
    const s = computeShares(10000, { mode: "equal", participantIds: ["ali", "leyla", "murad"] }, "leyla", FIVE);
    assert.equal(sum(s), 10000);
    assert.equal(s.get("leyla"), 3334);
    assert.equal(s.get("ali"), 3333);
    assert.equal(s.get("murad"), 3333);
  });

  it("uneven cents: €0.07 / 5 hands out 2 extra cents deterministically", () => {
    const s = computeShares(7, { mode: "equal", participantIds: FIVE }, "aysel", FIVE);
    assert.equal(sum(s), 7);
    assert.equal(s.get("aysel"), 2); // payer first
    assert.equal(s.get("maryam"), 2); // then trip order
    assert.equal(s.get("ali"), 1);
  });

  it("payer who does not share pays but owes nothing for it", () => {
    const t = trip([{ amount: 9000, paidBy: "aysel", split: { mode: "equal", participantIds: ["ali", "leyla", "murad"] } }]);
    const l = computeLedgers(t);
    assert.equal(l.get("aysel")!.share, 0);
    assert.equal(l.get("aysel")!.net, 9000);
    assert.equal(l.get("ali")!.net, -3000);
    assert.equal(l.get("maryam")!.net, 0);
  });

  it("only selected participants share an expense", () => {
    const s = computeShares(6000, { mode: "equal", participantIds: ["ali", "murad"] }, "maryam", FIVE);
    assert.deepEqual(Object.fromEntries(s), { ali: 3000, murad: 3000 });
  });

  it("exact split is used as-is and validated against the total", () => {
    const split = { mode: "exact" as const, amounts: { maryam: 5000, ali: 3000, leyla: 2000 } };
    assert.equal(validateSplit(10000, split), null);
    assert.deepEqual(validateSplit(9000, split), { code: "exact-mismatch", difference: -1000 });
    assert.deepEqual(validateSplit(11000, split), { code: "exact-mismatch", difference: 1000 });
    assert.deepEqual(Object.fromEntries(computeShares(10000, split, "maryam", FIVE)), split.amounts);
  });

  it("weighted shares (nights stayed) use largest remainder and sum exactly", () => {
    const s = computeShares(10000, { mode: "shares", shares: { maryam: 3, ali: 3, leyla: 1 } }, "ali", FIVE);
    assert.equal(sum(s), 10000);
    // 4285.71…, 4285.71…, 1428.57… → floors 4285+4285+1428 = 9998, two cents left
    assert.equal(s.get("ali"), 4286);
    assert.equal(s.get("maryam"), 4286);
    assert.equal(s.get("leyla"), 1428);
  });

  it("rejects empty splits", () => {
    assert.deepEqual(validateSplit(100, { mode: "equal", participantIds: [] }), { code: "no-participants" });
    assert.deepEqual(validateSplit(100, { mode: "shares", shares: { a: 0 } }), { code: "no-participants" });
  });

  it("allocate never loses or creates a minor unit (fuzz)", () => {
    for (let i = 0; i < 2000; i++) {
      const amount = Math.floor(Math.random() * 1_000_000);
      const w = new Map<string, number>();
      const n = 1 + Math.floor(Math.random() * 9);
      for (let j = 0; j < n; j++) w.set(`p${j}`, 1 + Math.floor(Math.random() * 5));
      assert.equal(sum(allocate(amount, w, "p0")), amount);
    }
  });
});

describe("balances", () => {
  it("matches the brief's worked example", () => {
    // Paid: Maryam 200, Ali 50, Leyla 0, Murad 150, Aysel 100 — total 500, share 100 each.
    const t = trip([
      { amount: 20000, paidBy: "maryam" },
      { amount: 5000, paidBy: "ali" },
      { amount: 15000, paidBy: "murad" },
      { amount: 10000, paidBy: "aysel" },
    ]);
    const b = outstandingBalances(t);
    assert.deepEqual(Object.fromEntries(b), { maryam: 10000, ali: -5000, leyla: -10000, murad: 5000, aysel: 0 });
    assert.equal(sum(b), 0);
  });

  it("Maryam pays €100 dinner for five: the other four owe her €20 each", () => {
    const b = outstandingBalances(trip([{ amount: 10000, paidBy: "maryam" }]));
    assert.deepEqual(Object.fromEntries(b), { maryam: 8000, ali: -2000, leyla: -2000, murad: -2000, aysel: -2000 });
  });

  it("editing and deleting expenses recalculates from scratch", () => {
    const base = trip([{ amount: 10000, paidBy: "maryam" }, { amount: 5000, paidBy: "ali" }]);
    const edited = { ...base, expenses: base.expenses.map((e) => (e.id === "e0" ? { ...e, amount: 5000 } : e)) };
    assert.equal(outstandingBalances(edited).get("maryam"), 3000);
    const deleted = { ...base, expenses: base.expenses.filter((e) => e.id !== "e0") };
    assert.equal(outstandingBalances(deleted).get("maryam"), -1000);
  });

  it("recorded payments reduce outstanding balances without touching expenses", () => {
    const t = trip([{ amount: 10000, paidBy: "maryam" }], [
      { id: "p", from: "ali", to: "maryam", amount: 2000, date: "2026-05-06", createdAt: 0 },
    ]);
    const l = computeLedgers(t);
    assert.equal(l.get("ali")!.outstanding, 0);
    assert.equal(l.get("maryam")!.outstanding, 6000);
    assert.equal(l.get("maryam")!.net, 8000, "net from expenses is unchanged");
    const transfers = minimizeTransfers(outstandingBalances(t), FIVE);
    assert.equal(transfers.length, 3);
    assert.ok(transfers.every((x) => x.from !== "ali"), "Ali is not asked to pay twice");
  });

  it("total owed equals total receivable", () => {
    const t = trip([
      { amount: 12345, paidBy: "maryam" },
      { amount: 999, paidBy: "leyla", split: { mode: "equal", participantIds: ["ali", "leyla", "murad"] } },
      { amount: 7001, paidBy: "aysel", split: { mode: "shares", shares: { maryam: 2, aysel: 1 } } },
    ]);
    const b = outstandingBalances(t);
    let receivable = 0;
    for (const v of b.values()) if (v > 0) receivable += v;
    assert.equal(totalOutstanding(b), receivable);
    assert.equal(sum(b), 0);
  });
});

describe("minimum-transfer settlement", () => {
  it("settles the brief's example in two transfers (brief suggested three)", () => {
    const b = new Map(Object.entries({ maryam: 10000, ali: -5000, leyla: -10000, murad: 5000, aysel: 0 }));
    const t = minimizeTransfers(b, FIVE);
    assert.equal(t.length, 2);
    assertSettles(b, t);
    assert.deepEqual(t, [
      { from: "leyla", to: "maryam", amount: 10000 },
      { from: "ali", to: "murad", amount: 5000 },
    ]);
  });

  it("beats the naive greedy approach where greedy is suboptimal", () => {
    // Greedy (largest debtor → largest creditor) needs 4 transfers here; optimum is 3:
    // {Dan −30, Eve +30} and {Ann −20, Cat −20, Bob +40}.
    const b = new Map(Object.entries({ ann: -2000, bob: 4000, cat: -2000, dan: -3000, eve: 3000 }));
    const t = minimizeTransfers(b);
    assert.equal(t.length, 3);
    assertSettles(b, t);
  });

  it("people with zero balance never appear", () => {
    const b = new Map(Object.entries({ a: 0, b: 500, c: -500, d: 0 }));
    const t = minimizeTransfers(b);
    assert.deepEqual(t, [{ from: "c", to: "b", amount: 500 }]);
  });

  it("returns nothing when everyone is square", () => {
    assert.deepEqual(minimizeTransfers(new Map([["a", 0], ["b", 0]])), []);
  });

  it("throws if balances do not sum to zero", () => {
    assert.throws(() => minimizeTransfers(new Map([["a", 1]])));
  });

  it("one creditor, many debtors: n − 1 transfers", () => {
    const b = new Map(Object.entries({ a: 8000, b: -2000, c: -2000, d: -2000, e: -2000 }));
    const t = minimizeTransfers(b);
    assert.equal(t.length, 4);
    assertSettles(b, t);
  });

  it("is optimal against brute force on random small groups", () => {
    for (let round = 0; round < 300; round++) {
      const n = 2 + Math.floor(Math.random() * 6);
      const vals = Array.from({ length: n - 1 }, () => Math.floor(Math.random() * 7 - 3) * 500);
      vals.push(0 - vals.reduce((s, v) => s + v, 0) || 0);
      const b = new Map(vals.map((v, i) => [`p${i}`, v]));
      const t = minimizeTransfers(b);
      assertSettles(b, t);
      const nonZero = vals.filter((v) => v !== 0);
      assert.equal(t.length, nonZero.length - maxZeroGroups(nonZero), `balances ${vals}`);
    }
  });

  it("works for 2, 10 and 25 participants", () => {
    for (const n of [2, 10, 25]) {
      const vals = Array.from({ length: n - 1 }, () => Math.floor(Math.random() * 20000 - 10000));
      vals.push(0 - vals.reduce((s, v) => s + v, 0) || 0);
      const b = new Map(vals.map((v, i) => [`p${i}`, v]));
      const t = minimizeTransfers(b);
      assertSettles(b, t);
      assert.ok(t.length <= vals.filter((v) => v !== 0).length - 1);
    }
  });
});

/** Reference brute force: max number of disjoint zero-sum groups. */
function maxZeroGroups(vals: number[]): number {
  const n = vals.length;
  let best = 0;
  const assign = new Array(n).fill(0);
  const rec = (i: number, groups: number) => {
    if (i === n) {
      const sums = new Array(groups).fill(0);
      assign.forEach((g, j) => (sums[g] += vals[j]));
      if (sums.every((s) => s === 0)) best = Math.max(best, groups);
      return;
    }
    for (let g = 0; g <= groups && g < n; g++) {
      assign[i] = g;
      rec(i + 1, Math.max(groups, g + 1));
    }
  };
  rec(0, 0);
  return best;
}
