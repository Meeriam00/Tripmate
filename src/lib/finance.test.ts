import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { computeBalances, settlement, tripTotal } from "./balances";
import { formatMoney, parseAmount, toInputValue } from "./money";
import { sampleTrip } from "./sample";
import { minimizeTransfers, type Transfer } from "./settle";
import { equalShares } from "./split";
import type { Expense, Trip } from "./types";

const FIVE = ["maryam", "ali", "leyla", "murad", "aysel"];

function trip(expenses: Partial<Expense>[]): Trip {
  return {
    id: "t",
    name: "Test",
    destination: "",
    currency: "EUR",
    participants: FIVE.map((id) => ({ id, name: id })),
    expenses: expenses.map((e, i) => ({
      id: `e${i}`,
      title: "x",
      amount: 0,
      paidBy: "maryam",
      participantIds: FIVE,
      createdAt: i,
      ...e,
    })),
    createdAt: 0,
    updatedAt: 0,
  };
}

const sum = (m: Map<string, number>) => [...m.values()].reduce((s, v) => s + v, 0);
const nets = (t: Trip) => Object.fromEntries([...computeBalances(t)].map(([id, b]) => [id, b.net]));

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
  it("parses Azerbaijani and international input into qəpik", () => {
    assert.equal(parseAmount("25"), 2500);
    assert.equal(parseAmount("25,5"), 2550);
    assert.equal(parseAmount("25,50"), 2550);
    assert.equal(parseAmount("25.50"), 2550);
    assert.equal(parseAmount("1.234,56"), 123456);
    assert.equal(parseAmount("1,234.56"), 123456);
    assert.equal(parseAmount("1 234,56"), 123456);
    assert.equal(parseAmount("1.234"), 123400);
  });
  it("rejects invalid input", () => {
    for (const bad of ["", "abc", "-5", "1,234,5x", "1.2.3,456", "12,5,5"]) assert.equal(parseAmount(bad), null, bad);
    assert.equal(parseAmount("12,555"), 1255500); // a 3-digit group is thousands, not decimals
  });
  it("formats in Azerbaijani style", () => {
    assert.equal(formatMoney(123450, "AZN"), "1.234,50 ₼");
    assert.equal(formatMoney(-2500, "EUR"), "−25,00 €");
    assert.equal(formatMoney(2500, "AZN", { signed: true }), "+25,00 ₼");
    assert.equal(formatMoney(0, "AZN", { signed: true }), "0,00 ₼");
    assert.equal(toInputValue(2550), "25,50");
    assert.equal(toInputValue(2500), "25");
  });
});

describe("bərabər bölgü (equal split)", () => {
  it("€100 dinner for five is €20 each", () => {
    const s = equalShares(10000, FIVE, "maryam", FIVE);
    assert.deepEqual([...s.values()], [2000, 2000, 2000, 2000, 2000]);
  });
  it("€100 / 3 sums exactly and the payer takes the extra cent", () => {
    const s = equalShares(10000, ["ali", "leyla", "murad"], "leyla", FIVE);
    assert.equal(sum(s), 10000);
    assert.deepEqual(Object.fromEntries(s), { leyla: 3334, ali: 3333, murad: 3333 });
  });
  it("leftover cents go to the payer first, then in trip order", () => {
    const s = equalShares(7, FIVE, "aysel", FIVE);
    assert.deepEqual(Object.fromEntries(s), { aysel: 2, maryam: 2, ali: 1, leyla: 1, murad: 1 });
  });
  it("never loses or creates a cent (fuzz)", () => {
    for (let i = 0; i < 3000; i++) {
      const amount = Math.floor(Math.random() * 1_000_000);
      const ids = FIVE.filter(() => Math.random() > 0.4);
      if (!ids.length) continue;
      assert.equal(sum(equalShares(amount, ids, FIVE[i % 5], FIVE)), amount);
    }
  });
});

describe("balanslar (balances)", () => {
  it("Maryam pays €100 for five: the other four owe her €20 each", () => {
    assert.deepEqual(nets(trip([{ amount: 10000, paidBy: "maryam" }])), {
      maryam: 8000, ali: -2000, leyla: -2000, murad: -2000, aysel: -2000,
    });
  });
  it("matches the brief's worked example", () => {
    const t = trip([
      { amount: 20000, paidBy: "maryam" },
      { amount: 5000, paidBy: "ali" },
      { amount: 15000, paidBy: "murad" },
      { amount: 10000, paidBy: "aysel" },
    ]);
    assert.deepEqual(nets(t), { maryam: 10000, ali: -5000, leyla: -10000, murad: 5000, aysel: 0 });
  });
  it("only selected participants share; a payer can pay without sharing", () => {
    const t = trip([{ amount: 9000, paidBy: "aysel", participantIds: ["ali", "leyla", "murad"] }]);
    assert.deepEqual(nets(t), { maryam: 0, ali: -3000, leyla: -3000, murad: -3000, aysel: 9000 });
  });
  it("editing and deleting an expense recalculates from scratch", () => {
    const base = trip([{ amount: 10000, paidBy: "maryam" }, { amount: 5000, paidBy: "ali" }]);
    const edited = { ...base, expenses: base.expenses.map((e) => (e.id === "e0" ? { ...e, amount: 5000 } : e)) };
    assert.equal(nets(edited).maryam, 3000);
    const deleted = { ...base, expenses: base.expenses.filter((e) => e.id !== "e0") };
    assert.equal(nets(deleted).maryam, -1000);
  });
  it("balances always sum to zero and owed equals receivable", () => {
    const t = trip([
      { amount: 12345, paidBy: "maryam" },
      { amount: 999, paidBy: "leyla", participantIds: ["ali", "leyla", "murad"] },
      { amount: 7001, paidBy: "aysel", participantIds: ["maryam", "aysel"] },
    ]);
    const v = Object.values(nets(t));
    assert.equal(v.reduce((a, b) => a + b, 0), 0);
    assert.equal(-v.filter((x) => x < 0).reduce((a, b) => a + b, 0), v.filter((x) => x > 0).reduce((a, b) => a + b, 0));
  });
  it("sample trip settles completely", () => {
    const t = sampleTrip();
    const b = new Map(Object.entries(nets(t)));
    assertSettles(b, settlement(t));
    assert.equal(tripTotal(t), 104050);
  });
});

describe("hesablaşma (minimum transfers)", () => {
  it("settles the brief's example in two transfers (brief suggested three)", () => {
    const b = new Map(Object.entries({ maryam: 10000, ali: -5000, leyla: -10000, murad: 5000, aysel: 0 }));
    const t = minimizeTransfers(b, FIVE);
    assert.deepEqual(t, [
      { from: "leyla", to: "maryam", amount: 10000 },
      { from: "ali", to: "murad", amount: 5000 },
    ]);
  });
  it("beats greedy where greedy is suboptimal", () => {
    const b = new Map(Object.entries({ a: -2000, b: 4000, c: -2000, d: -3000, e: 3000 }));
    const t = minimizeTransfers(b);
    assert.equal(t.length, 3);
    assertSettles(b, t);
  });
  it("people with zero balance never appear; nothing to do when square", () => {
    assert.deepEqual(minimizeTransfers(new Map(Object.entries({ a: 0, b: 500, c: -500 }))), [{ from: "c", to: "b", amount: 500 }]);
    assert.deepEqual(minimizeTransfers(new Map([["a", 0]])), []);
  });
  it("throws if balances do not sum to zero", () => {
    assert.throws(() => minimizeTransfers(new Map([["a", 1]])));
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
  it("works for 2, 10 and 25 people", () => {
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
