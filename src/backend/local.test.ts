import { strict as assert } from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { computeBalances, reconciles, settlementPlan, tripTotal } from "../lib/ledger";
import { LocalBackend, memoryStore } from "./local";
import { DEMO_PASSWORD } from "./seed";
import type { ExpenseInput } from "./types";

/** End-to-end rules of the local backend: auth, roles, invitations, expenses, two-sided payment confirmation. */

let be: LocalBackend;
const login = (who: string) => be.signIn(`${who}@demo.tripmate.az`, DEMO_PASSWORD);

async function italy() {
  const trips = await be.listTrips();
  return trips.find((t) => t.trip.currency === "EUR")!.trip;
}
async function memberId(tripId: string, first: string) {
  const b = await be.getTrip(tripId);
  return b.members.find((m) => m.name.startsWith(first))!.id;
}
async function rejects(p: Promise<unknown>, re: RegExp) {
  await assert.rejects(p, (e: Error) => {
    assert.match(e.message, re);
    return true;
  });
}

beforeEach(async () => {
  be = new LocalBackend(memoryStore());
  await be.ready;
});

describe("demo məlumatları (seed)", () => {
  it("reproduces the brief's Italy trip exactly", async () => {
    await login("maryam");
    const t = await italy();
    const b = await be.getTrip(t.id);
    assert.equal(tripTotal(b.expenses), 125000);
    assert.equal(t.budget, 200000);
    const bal = computeBalances(b.members, b.expenses, b.payments);
    const net = (n: string) => bal.get(b.members.find((m) => m.name.startsWith(n))!.id)!.net;
    assert.deepEqual([net("Məryəm"), net("Əli"), net("Leyla"), net("Murad"), net("Nigar")], [12000, -7000, 3000, -5000, -3000]);
    assert.ok(reconciles(bal));
    const plan = settlementPlan(b);
    assert.equal(plan.length, 3);
  });
});

describe("autentifikasiya (auth)", () => {
  it("registers, logs out, logs in, rejects a wrong password", async () => {
    const s = await be.signUp("yeni@example.com", "parol1234");
    assert.ok(s);
    assert.equal((await be.getProfile())!.completed, false);
    await be.updateProfile({ firstName: "Aysel", lastName: "Kərimova", currency: "USD", completed: true });
    assert.equal((await be.getProfile())!.firstName, "Aysel");
    await be.signOut();
    assert.equal(await be.getSession(), null);
    await rejects(be.signIn("yeni@example.com", "yanlis1234"), /yanlışdır/);
    await be.signIn("YENI@example.com", "parol1234");
    assert.ok(await be.getSession());
  });
  it("validates e-mail, password strength and duplicates", async () => {
    await rejects(be.signUp("not-an-email", "parol1234"), /düzgün deyil/);
    await rejects(be.signUp("a@b.az", "short1"), /8 simvol/);
    await rejects(be.signUp("a@b.az", "onlyletters"), /rəqəm/);
    await rejects(be.signUp("maryam@demo.tripmate.az", "parol1234"), /artıq qeydiyyatdan/);
  });
  it("password recovery with a one-time code", async () => {
    const r = await be.requestPasswordReset("ali@demo.tripmate.az");
    assert.ok(r.localCode);
    await rejects(be.resetPassword({ email: "ali@demo.tripmate.az", code: "000000x", password: "yeniParol9" }), /Kod/);
    await be.resetPassword({ email: "ali@demo.tripmate.az", code: r.localCode!, password: "yeniParol9" });
    await rejects(login("ali"), /yanlışdır/);
    await be.signIn("ali@demo.tripmate.az", "yeniParol9");
    // Codes are single-use.
    await rejects(be.resetPassword({ email: "ali@demo.tripmate.az", code: r.localCode!, password: "baskaParol9" }), /Kod/);
    // Unknown addresses look the same to the caller.
    assert.deepEqual(await be.requestPasswordReset("nobody@x.az"), {});
  });
  it("change password and delete account keep trip records", async () => {
    await login("murad");
    await rejects(be.changePassword("wrong", "yeniParol9"), /Hazırkı/);
    await be.changePassword(DEMO_PASSWORD, "yeniParol9");
    await be.deleteAccount();
    assert.equal(await be.getSession(), null);
    await login("maryam");
    const b = await be.getTrip((await italy()).id);
    const murad = b.members.find((m) => m.name.startsWith("Murad"))!;
    assert.equal(murad.userId, null, "seat stays, detached from the deleted account");
    assert.equal(tripTotal(b.expenses), 125000);
  });
});

describe("səfərlər və dəvət (trips and invitations)", () => {
  it("creates a trip with validation and joins via invite code, claiming a seat", async () => {
    await login("leyla");
    await rejects(
      be.createTrip({ name: "", destination: "Bakı", startDate: "2026-12-01", endDate: "2026-12-03", currency: "AZN", budget: null }, []),
      /adını/,
    );
    await rejects(
      be.createTrip({ name: "Şəki", destination: "Şəki", startDate: "2026-12-05", endDate: "2026-12-03", currency: "AZN", budget: null }, []),
      /əvvəl ola bilməz/,
    );
    await rejects(
      be.createTrip({ name: "Şəki", destination: "Şəki", startDate: "2026-12-01", endDate: "2026-12-03", currency: "AZN", budget: null }, ["Tural", "tural"]),
      /Eyni adlı/,
    );
    const trip = await be.createTrip({ name: "Şəki", destination: "Şəki, Azərbaycan", startDate: "2026-12-01", endDate: "2026-12-03", currency: "AZN", budget: 50000 }, ["Tural", "Səbinə"]);
    assert.match(trip.inviteCode, /^[A-Z2-9]{6}$/);
    let b = await be.getTrip(trip.id);
    assert.equal(b.members.length, 3);
    assert.equal(b.members[0].role, "admin");

    await be.signOut();
    await login("murad");
    await rejects(be.getTrip(trip.id), /girişiniz yoxdur/);
    const preview = await be.previewInvite(trip.inviteCode.toLowerCase());
    assert.equal(preview.openSeats.length, 2);
    const tural = preview.openSeats.find((s) => s.name === "Tural")!;
    await be.joinTrip(trip.inviteCode, tural.id);
    b = await be.getTrip(trip.id);
    assert.equal(b.members.find((m) => m.id === tural.id)!.userId !== null, true);
    assert.equal(b.members.length, 3, "claimed, not duplicated");
    // Joining twice is harmless.
    await be.joinTrip(trip.inviteCode, null);
    assert.equal((await be.getTrip(trip.id)).members.length, 3);
    await be.signOut();
    await login("leyla");
    const notes = await be.listNotifications();
    assert.ok(notes.some((n) => n.kind === "member_joined"));
  });
  it("a new member is not part of previously recorded expenses", async () => {
    await login("maryam");
    const t = await italy();
    const before = await be.getTrip(t.id);
    await be.addMember(t.id, "Kamal");
    const after = await be.getTrip(t.id);
    const kamal = after.members.find((m) => m.name === "Kamal")!;
    const bal = computeBalances(after.members, after.expenses, after.payments).get(kamal.id)!;
    assert.equal(bal.share, 0);
    assert.equal(bal.net, 0);
    assert.deepEqual(settlementPlan(after), settlementPlan(before));
  });
  it("only the admin edits, archives and manages members; removal protects records", async () => {
    await login("ali");
    const t = await italy();
    const input = { name: t.name, destination: t.destination, startDate: t.startDate, endDate: t.endDate, currency: t.currency, budget: t.budget };
    await rejects(be.updateTrip(t.id, input), /yalnız admin/);
    await rejects(be.addMember(t.id, "X"), /yalnız admin/);
    await rejects(be.setArchived(t.id, true), /yalnız admin/);
    await be.signOut();
    await login("maryam");
    await rejects(be.updateTrip(t.id, { ...input, currency: "USD" }), /valyutasını/);
    await rejects(be.removeMember(t.id, await memberId(t.id, "Əli")), /hesablaşmayıb/);
    await rejects(be.removeMember(t.id, await memberId(t.id, "Məryəm")), /yaradıcısını/);
    await be.addMember(t.id, "Kamal");
    await be.removeMember(t.id, await memberId(t.id, "Kamal"));
    const b = await be.getTrip(t.id);
    assert.equal(b.members.find((m) => m.name === "Kamal")!.status, "removed");
    await be.setArchived(t.id, true);
    await rejects(be.addMember(t.id, "Y"), /arxivdədir/);
    await be.setArchived(t.id, false);
  });
});

describe("xərclər (expenses)", () => {
  const base = (b: Awaited<ReturnType<LocalBackend["getTrip"]>>, payer: string): ExpenseInput => ({
    title: "Pizza",
    amount: 10000,
    category: "food",
    paidBy: b.members.find((m) => m.name.startsWith(payer))!.id,
    method: "equal",
    participantIds: b.members.map((m) => m.id),
    date: "2026-06-20",
  });

  it("equal, custom and percent expenses recalculate balances; edit and delete too", async () => {
    await login("leyla");
    const t = await italy();
    let b = await be.getTrip(t.id);
    const leyla = await memberId(t.id, "Leyla");
    const ali = await memberId(t.id, "Əli");
    const net0 = computeBalances(b.members, b.expenses, b.payments).get(leyla)!.net;

    const e1 = await be.saveExpense(t.id, base(b, "Leyla"));
    b = await be.getTrip(t.id);
    assert.equal(computeBalances(b.members, b.expenses, b.payments).get(leyla)!.net, net0 + 8000);

    await rejects(be.saveExpense(t.id, { ...base(b, "Leyla"), method: "custom", participantIds: [leyla, ali], custom: { [leyla]: 5000, [ali]: 4000 } }), /azdır/);
    const e2 = await be.saveExpense(t.id, { ...base(b, "Leyla"), method: "custom", participantIds: [leyla, ali], custom: { [leyla]: 6000, [ali]: 4000 } });
    assert.deepEqual(e2.shares, { [leyla]: 6000, [ali]: 4000 });

    await rejects(be.saveExpense(t.id, { ...base(b, "Leyla"), method: "percent", participantIds: [leyla, ali], percents: { [leyla]: 7000, [ali]: 2000 } }), /100%/);
    const e3 = await be.saveExpense(t.id, { ...base(b, "Leyla"), amount: 1000, method: "percent", participantIds: [leyla, ali], percents: { [leyla]: 3333, [ali]: 6667 } });
    assert.equal(e3.shares[leyla] + e3.shares[ali], 1000);

    await rejects(be.saveExpense(t.id, { ...base(b, "Leyla"), amount: -500 }), /sıfırdan böyük/);
    await rejects(be.saveExpense(t.id, { ...base(b, "Leyla"), amount: 0 }), /sıfırdan böyük/);
    await rejects(be.saveExpense(t.id, { ...base(b, "Leyla"), title: "  " }), /adını/);

    await be.saveExpense(t.id, { ...base(b, "Leyla"), amount: 20000 }, e1.id);
    await be.deleteExpense(t.id, e2.id);
    await be.deleteExpense(t.id, e3.id);
    b = await be.getTrip(t.id);
    assert.equal(computeBalances(b.members, b.expenses, b.payments).get(leyla)!.net, net0 + 16000);
    assert.ok(reconciles(computeBalances(b.members, b.expenses, b.payments)));

    // A member may not edit someone else's expense; the admin may.
    await be.signOut();
    await login("ali");
    await rejects(be.deleteExpense(t.id, e1.id), /öz yazdığınız/);
    await be.signOut();
    await login("maryam");
    await be.deleteExpense(t.id, e1.id);
    const notes = await be.listNotifications();
    assert.ok(notes.some((n) => n.kind === "balance_updated"));
  });
});

describe("ödəniş təsdiqi (two-sided payment confirmation)", () => {
  it("debtor marks sent → receiver confirms; partial payments; rejection keeps the debt; no duplicates", async () => {
    await login("murad");
    const t = await italy();
    const murad = await memberId(t.id, "Murad");
    const maryam = await memberId(t.id, "Məryəm");
    const ali = await memberId(t.id, "Əli");

    // Murad owes Məryəm 50 €. He cannot report more than that, nor pay on Əli's behalf.
    await rejects(be.markPaymentSent(t.id, murad, maryam, 6000), /Ən çox 50,00 €/);
    await rejects(be.markPaymentSent(t.id, ali, maryam, 1000), /borclu özü/);
    await be.markPaymentSent(t.id, murad, maryam, 2000);
    let b = await be.getTrip(t.id);
    const p1 = b.payments.find((p) => p.from === murad)!;
    assert.equal(p1.status, "pending");
    assert.equal(computeBalances(b.members, b.expenses, b.payments).get(murad)!.outstanding, -5000, "pending does not reduce debt");
    // The debtor cannot confirm his own payment.
    await rejects(be.resolvePayment(t.id, p1.id, "confirm"), /pulu alan/);

    await be.signOut();
    await login("maryam");
    const notes = await be.listNotifications();
    assert.ok(notes.some((n) => n.kind === "payment_sent" && n.text.includes("20,00 €")));
    await be.resolvePayment(t.id, p1.id, "confirm");
    await rejects(be.resolvePayment(t.id, p1.id, "confirm"), /artıq təsdiqlənib/);
    b = await be.getTrip(t.id);
    const confirmed = b.payments.find((p) => p.id === p1.id)!;
    assert.equal(confirmed.status, "confirmed");
    assert.equal(confirmed.resolvedBy, maryam);
    assert.ok(confirmed.resolvedAt);
    assert.equal(computeBalances(b.members, b.expenses, b.payments).get(murad)!.outstanding, -3000);

    // Əli's seeded 40 € (pending): Məryəm rejects → his debt stays 70 €.
    const aliPending = b.payments.find((p) => p.from === ali && p.status === "pending")!;
    await be.resolvePayment(t.id, aliPending.id, "reject");
    b = await be.getTrip(t.id);
    assert.equal(computeBalances(b.members, b.expenses, b.payments).get(ali)!.outstanding, -7000);

    await be.signOut();
    await login("ali");
    assert.ok((await be.listNotifications()).some((n) => n.kind === "payment_rejected"));
    // Brief's example: Əli sends 40, Məryəm confirms, 30 remain.
    await be.markPaymentSent(t.id, ali, maryam, 4000);
    await rejects(be.markPaymentSent(t.id, ali, maryam, 4000), /Ən çox 30,00 €/);
    await be.signOut();
    await login("maryam");
    b = await be.getTrip(t.id);
    await be.resolvePayment(t.id, b.payments.find((p) => p.from === ali && p.status === "pending")!.id, "confirm");
    b = await be.getTrip(t.id);
    assert.equal(settlementPlan(b).find((x) => x.from === ali)!.amount, 3000);

    // Settle everything → plan empty, all reconciled.
    for (const tr of settlementPlan(b)) {
      const debtor = b.members.find((m) => m.id === tr.from)!;
      await be.signOut();
      await be.signIn(`${debtor.name.startsWith("Əli") ? "ali" : debtor.name.startsWith("Murad") ? "murad" : "nigar"}@demo.tripmate.az`, DEMO_PASSWORD);
      await be.markPaymentSent(t.id, tr.from, tr.to, tr.amount);
    }
    for (const who of ["maryam", "leyla"]) {
      await be.signOut();
      await login(who);
      const bb = await be.getTrip(t.id);
      const me = bb.members.find((m) => m.userId === (bb.members.find((x) => x.name.toLowerCase().includes(who === "maryam" ? "məryəm" : "leyla"))!.userId))!;
      for (const p of bb.payments.filter((p) => p.status === "pending" && p.to === me.id)) await be.resolvePayment(t.id, p.id, "confirm");
    }
    b = await be.getTrip(t.id);
    assert.deepEqual(settlementPlan(b), []);
    for (const bal of computeBalances(b.members, b.expenses, b.payments).values()) assert.equal(bal.outstanding, 0);
  });
  it("the sender can cancel a pending payment; others cannot", async () => {
    await login("nigar");
    const t = await italy();
    const nigar = await memberId(t.id, "Nigar");
    const leyla = await memberId(t.id, "Leyla");
    await be.markPaymentSent(t.id, nigar, leyla, 3000);
    const p = (await be.getTrip(t.id)).payments.find((x) => x.from === nigar)!;
    await be.signOut();
    await login("murad");
    await rejects(be.resolvePayment(t.id, p.id, "cancel"), /ləğv/);
    await be.signOut();
    await login("nigar");
    await be.resolvePayment(t.id, p.id, "cancel");
    assert.equal((await be.getTrip(t.id)).payments.find((x) => x.id === p.id)!.status, "cancelled");
  });
});
