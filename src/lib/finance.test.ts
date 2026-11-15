import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { formatDay, formatRange, tripDays } from "./dates";
import { budgetState, computeBalances, maxSendable, reconciles, settlementPlan, tripPhase } from "./ledger";
import { formatMoney, parseAmount } from "./money";
import { minimizeTransfers, type Transfer } from "./settle";
import { computeSplit, equalShares, evenPercents, formatPercent, parsePercent, percentShares } from "./split";
import type { Expense, Payment } from "./types";

const FIVE = ["maryam", "ali", "leyla", "murad", "nigar"];
const members = FIVE.map((id) => ({ id }));
const sum = (r: Record<string, number>) => Object.values(r).reduce((s, v) => s + v, 0);

function exp(amount: number, paidBy: string, shares: Record<string, number>): Pick<Expense, "amount" | "paidBy" | "shares"> {
  return { amount, paidBy, shares };
}
function pay(from: string, to: string, amount: number, status: Payment["status"] = "confirmed") {
  return { from, to, amount, status };
}
function assertSettles(balances: Map<string, number>, transfers: Transfer[]) {
  const b = new Map(balances);
  for (const t of transfers) {
    assert.ok(t.amount > 0);
    assert.notEqual(t.from, t.to);
    b.set(t.from, (b.get(t.from) ?? 0) + t.amount);
    b.set(t.to, (b.get(t.to) ?? 0) - t.amount);
  }
  for (const [id, v] of b) assert.equal(v, 0, `${id} should be square`);
}

describe("pul (money)", () => {
  it("parses input into integer minor units", () => {
    assert.equal(parseAmount("25"), 2500);
    assert.equal(parseAmount("25,5"), 2550);
    assert.equal(parseAmount("25.50"), 2550);
    assert.equal(parseAmount("1.234,56"), 123456);
    assert.equal(parseAmount("1 234,56"), 123456);
    assert.equal(parseAmount("-5"), null);
    assert.equal(parseAmount("abc"), null);
  });
  it("formats in Azerbaijani style", () => {
    assert.equal(formatMoney(125000, "EUR"), "1.250,00 €");
    assert.equal(formatMoney(-7000, "EUR"), "−70,00 €");
    assert.equal(formatMoney(12000, "EUR", { signed: true }), "+120,00 €");
  });
});

describe("bölgü (splits)", () => {
  it("equal split hands leftover cents to the payer first", () => {
    assert.deepEqual(equalShares(1000, ["maryam", "ali", "leyla"], "leyla", FIVE), { leyla: 334, maryam: 333, ali: 333 });
    for (let n = 1; n <= 7; n++) for (const amt of [1, 99, 1000, 12345]) assert.equal(sum(equalShares(amt, FIVE.slice(0, Math.min(n, 5)), "ali", FIVE)), amt);
  });
  it("percent split always adds up exactly (largest remainder)", () => {
    const s = percentShares(10000, { maryam: 3333, ali: 3333, leyla: 3334 }, "maryam", FIVE);
    assert.equal(sum(s), 10000);
    assert.deepEqual(s, { maryam: 3333, ali: 3333, leyla: 3334 });
    for (let i = 0; i < 500; i++) {
      const amount = 1 + Math.floor(Math.random() * 100000);
      const ids = FIVE.slice(0, 1 + Math.floor(Math.random() * 5));
      const bp = evenPercents(ids);
      assert.equal(sum(bp), 10000);
      assert.equal(sum(percentShares(amount, bp, ids[0], FIVE)), amount);
    }
  });
  it("custom split must match the total", () => {
    const base = { amount: 6000, method: "custom" as const, payerId: "nigar", participantIds: ["nigar", "maryam", "leyla"], order: FIVE };
    assert.deepEqual(computeSplit({ ...base, custom: { nigar: 3000, maryam: 2000, leyla: 1000 } }), { ok: true, shares: { nigar: 3000, maryam: 2000, leyla: 1000 }, percents: null });
    const less = computeSplit({ ...base, custom: { nigar: 3000, maryam: 2000 } });
    assert.equal(less.ok, false);
    assert.match((less as { error: string }).error, /azdır/);
    const more = computeSplit({ ...base, custom: { nigar: 3000, maryam: 2000, leyla: 2000 } });
    assert.match((more as { error: string }).error, /çoxdur/);
  });
  it("percent split must total 100%", () => {
    const base = { amount: 9600, method: "percent" as const, payerId: "leyla", participantIds: ["leyla", "ali"], order: FIVE };
    assert.equal(computeSplit({ ...base, percents: { leyla: 6000, ali: 4000 } }).ok, true);
    assert.match((computeSplit({ ...base, percents: { leyla: 6000, ali: 3000 } }) as { error: string }).error, /azdır/);
    assert.match((computeSplit({ ...base, percents: { leyla: 6000, ali: 5000 } }) as { error: string }).error, /çoxdur/);
  });
  it("rejects zero, negative and fractional amounts and empty participant lists", () => {
    const base = { method: "equal" as const, payerId: "ali", participantIds: ["ali"], order: FIVE };
    assert.equal(computeSplit({ ...base, amount: 0 }).ok, false);
    assert.equal(computeSplit({ ...base, amount: -100 }).ok, false);
    assert.equal(computeSplit({ ...base, amount: 10.5 }).ok, false);
    assert.equal(computeSplit({ ...base, amount: 100, participantIds: [] }).ok, false);
  });
  it("parses and formats percentages", () => {
    assert.equal(parsePercent("33,33"), 3333);
    assert.equal(parsePercent("50"), 5000);
    assert.equal(parsePercent("100"), 10000);
    assert.equal(parsePercent("101"), null);
    assert.equal(formatPercent(3333), "33,33");
    assert.equal(formatPercent(2500), "25");
    assert.equal(formatPercent(1250), "12,5");
  });
});

describe("balans (balances)", () => {
  it("brief example: A paid 300, B 200, five people share 500 equally", () => {
    const e = [exp(30000, "maryam", equalShares(30000, FIVE, "maryam", FIVE)), exp(20000, "ali", equalShares(20000, FIVE, "ali", FIVE))];
    const b = computeBalances(members, e, []);
    assert.deepEqual(
      FIVE.map((id) => [b.get(id)!.paid, b.get(id)!.share, b.get(id)!.net]),
      [
        [30000, 10000, 20000],
        [20000, 10000, 10000],
        [0, 10000, -10000],
        [0, 10000, -10000],
        [0, 10000, -10000],
      ],
    );
    const plan = settlementPlan({ members, expenses: e, payments: [] } as never);
    assert.equal(plan.length, 3);
    assertSettles(new Map(FIVE.map((id) => [id, b.get(id)!.net])), plan);
    assert.equal(plan.filter((t) => t.to === "maryam").reduce((s, t) => s + t.amount, 0), 20000);
    assert.equal(plan.filter((t) => t.to === "ali").reduce((s, t) => s + t.amount, 0), 10000);
  });
  it("expenses shared by a subset only affect that subset", () => {
    const e = [exp(9000, "leyla", { leyla: 3000, nigar: 3000, murad: 3000 })];
    const b = computeBalances(members, e, []);
    assert.equal(b.get("maryam")!.net, 0);
    assert.equal(b.get("ali")!.net, 0);
    assert.equal(b.get("leyla")!.net, 6000);
    assert.ok(reconciles(b));
  });
  it("only confirmed payments reduce debt; pending and rejected do not", () => {
    const e = [exp(10000, "maryam", equalShares(10000, ["maryam", "ali"], "maryam", FIVE))];
    for (const status of ["pending", "rejected", "cancelled"] as const) {
      const b = computeBalances(members, e, [pay("ali", "maryam", 3000, status)]);
      assert.equal(b.get("ali")!.outstanding, -5000, status);
    }
    const b = computeBalances(members, e, [pay("ali", "maryam", 3000, "pending")]);
    assert.equal(b.get("ali")!.pendingOut, 3000);
    assert.equal(b.get("maryam")!.pendingIn, 3000);
  });
  it("partial payment: Əli owes 70, sends 40, Məryəm confirms → 30 left", () => {
    const e = [exp(7000, "maryam", { ali: 7000 })];
    const pending = { members, expenses: e, payments: [pay("ali", "maryam", 4000, "pending")] } as never;
    assert.equal(maxSendable(pending, "ali", "maryam"), 3000, "only the unreported part can be sent again");
    const plan = settlementPlan(pending);
    assert.deepEqual(plan, [{ from: "ali", to: "maryam", amount: 7000, pending: 4000, sendable: 3000 }]);
    const confirmed = { members, expenses: e, payments: [pay("ali", "maryam", 4000)] } as never;
    assert.deepEqual(settlementPlan(confirmed), [{ from: "ali", to: "maryam", amount: 3000, pending: 0, sendable: 3000 }]);
    const done = { members, expenses: e, payments: [pay("ali", "maryam", 4000), pay("ali", "maryam", 3000)] } as never;
    assert.deepEqual(settlementPlan(done), []);
  });
  it("editing or deleting an expense after payments re-plans only what is open", () => {
    const e1 = exp(15000, "maryam", equalShares(15000, ["maryam", "ali", "leyla"], "maryam", FIVE));
    const payments = [pay("ali", "maryam", 5000), pay("leyla", "maryam", 5000)];
    assert.deepEqual(settlementPlan({ members, expenses: [e1], payments } as never), []);
    // Expense deleted after everyone paid → Məryəm now owes the money back.
    const plan = settlementPlan({ members, expenses: [], payments } as never);
    assert.equal(plan.length, 2);
    assert.ok(plan.every((t) => t.from === "maryam" && t.amount === 5000));
    const b = computeBalances(members, [], payments);
    assert.ok(reconciles(b));
  });
  it("brief's group balance: +120, −70, +30, −50, −30 settles in 3 transfers", () => {
    const bal = new Map(Object.entries({ maryam: 12000, ali: -7000, leyla: 3000, murad: -5000, nigar: -3000 }));
    const t = minimizeTransfers(bal, FIVE);
    assertSettles(bal, t);
    assert.equal(t.length, 3);
    assert.deepEqual(t, [
      { from: "ali", to: "maryam", amount: 7000 },
      { from: "murad", to: "maryam", amount: 5000 },
      { from: "nigar", to: "leyla", amount: 3000 },
    ]);
  });
});

describe("hesablaşma (settlement optimiser)", () => {
  it("beats the greedy heuristic", () => {
    const b = new Map(Object.entries({ a: -2000, b: 4000, c: -2000, d: -3000, e: 3000 }));
    const t = minimizeTransfers(b);
    assert.equal(t.length, 3);
    assertSettles(b, t);
  });
  it("is optimal against brute force on random groups", () => {
    for (let round = 0; round < 300; round++) {
      const n = 2 + Math.floor(Math.random() * 6);
      const vals = Array.from({ length: n - 1 }, () => Math.floor(Math.random() * 7 - 3) * 500);
      vals.push(0 - vals.reduce((s, v) => s + v, 0) || 0);
      const b = new Map(vals.map((v, i) => [`p${i}`, v]));
      const t = minimizeTransfers(b);
      assertSettles(b, t);
      const nz = vals.filter((v) => v !== 0);
      assert.equal(t.length, nz.length - maxZeroGroups(nz), `balances ${vals}`);
    }
  });
  it("handles 25 people with a fallback and never exceeds n − 1", () => {
    const vals = Array.from({ length: 24 }, () => Math.floor(Math.random() * 20000 - 10000));
    vals.push(-vals.reduce((s, v) => s + v, 0));
    const b = new Map(vals.map((v, i) => [`p${i}`, v]));
    const t = minimizeTransfers(b);
    assertSettles(b, t);
    assert.ok(t.length <= vals.filter((v) => v !== 0).length - 1);
  });
  it("throws if balances do not reconcile", () => {
    assert.throws(() => minimizeTransfers(new Map([["a", 1]])));
  });
});

describe("tarix və büdcə (dates, phase, budget)", () => {
  it("formats dates in Azerbaijani", () => {
    assert.equal(formatDay("2026-06-15"), "15 iyun");
    assert.equal(formatRange("2026-06-15", "2026-06-22"), "15–22 iyun 2026");
    assert.equal(formatRange("2026-12-30", "2027-01-02"), "30 dekabr 2026 – 2 yanvar 2027");
    assert.equal(tripDays("2026-06-15", "2026-06-22"), 8);
  });
  it("classifies trips", () => {
    const t = { startDate: "2026-06-15", endDate: "2026-06-22", archived: false };
    assert.equal(tripPhase(t, "2026-06-01"), "upcoming");
    assert.equal(tripPhase(t, "2026-06-15"), "active");
    assert.equal(tripPhase(t, "2026-06-22"), "active");
    assert.equal(tripPhase(t, "2026-06-23"), "past");
    assert.equal(tripPhase({ ...t, archived: true }, "2026-06-16"), "past");
  });
  it("budget levels", () => {
    assert.deepEqual(budgetState(200000, 125000), { budget: 200000, spent: 125000, remaining: 75000, ratio: 0.625, level: "calm" });
    assert.equal(budgetState(200000, 170000).level, "watch");
    assert.equal(budgetState(200000, 210000).level, "over");
    assert.equal(budgetState(null, 5).level, "none");
  });
});

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
