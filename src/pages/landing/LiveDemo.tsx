import { useMemo, useState, type FormEvent } from "react";
import { LuArrowRight, LuBell, LuHandCoins, LuHouse, LuPlus, LuRotateCcw } from "react-icons/lu";
import { dative } from "../../lib/az";
import { budgetState, computeBalances, settlementPlan, tripTotal } from "../../lib/ledger";
import { formatMoney, parseAmount } from "../../lib/money";
import { tripMood } from "../../lib/mood";
import { equalShares } from "../../lib/split";
import type { Category, Expense, Member } from "../../lib/types";
import { Avatar, CategoryTile, Gauge } from "../../ui/kit";
import { Mascot } from "../../ui/Mascot";

/**
 * The real TRIPMATE engine running inside the phone on the landing page.
 * Visitors add an expense and watch balances, the budget gauge, the mascot
 * and the settlement plan update instantly. Nothing is saved.
 */

const NAMES = ["Məryəm", "Əli", "Leyla", "Murad", "Nigar"];
const MEMBERS: Member[] = NAMES.map((name, i) => ({ id: `m${i}`, tripId: "demo", userId: i === 0 ? "me" : null, name, role: i === 0 ? "admin" : "member", status: "active", joinedAt: i }));
const ORDER = MEMBERS.map((m) => m.id);

function exp(id: string, title: string, euros: number, payer: number, category: Category): Expense {
  const amount = euros * 100;
  return {
    id,
    tripId: "demo",
    title,
    amount,
    category,
    paidBy: `m${payer}`,
    method: "equal",
    shares: equalShares(amount, ORDER, `m${payer}`, ORDER),
    date: "2026-06-16",
    createdBy: `m${payer}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

const START: Expense[] = [
  exp("e1", "Otel", 400, 0, "stay"),
  exp("e2", "Restoran", 120, 1, "food"),
  exp("e3", "Taksi", 35, 2, "transport"),
  exp("e4", "Vatikan muzeyi", 150, 3, "fun"),
];

const PRESETS: { title: string; euros: number; payer: number; category: Category }[] = [
  { title: "Pizza", euros: 60, payer: 4, category: "food" },
  { title: "Qayıq turu", euros: 95, payer: 3, category: "fun" },
  { title: "Qatar", euros: 80, payer: 1, category: "transport" },
];

const BUDGET = 200_000;
const eur = (v: number, signed = false) => formatMoney(v, "EUR", { signed }).replace(",00 ", " ");

export function LiveDemo() {
  const [expenses, setExpenses] = useState<Expense[]>(START);
  const [tab, setTab] = useState<"home" | "settle">("home");
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("");
  const [payer, setPayer] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);

  const balances = useMemo(() => computeBalances(MEMBERS, expenses, []), [expenses]);
  const plan = useMemo(() => settlementPlan({ members: MEMBERS, expenses, payments: [] }), [expenses]);
  const total = tripTotal(expenses);
  const budget = budgetState(BUDGET, total);
  const me = balances.get("m0")!;
  const mood = tripMood({ firstName: "Məryəm", currency: "EUR", budget, hasExpenses: true, myOutstanding: me.outstanding, awaitingMyConfirmation: 0, everyoneSettled: false });

  function add(title: string, euros: number, p: number, category: Category) {
    const e = exp(`e${Date.now()}`, title, euros, p, category);
    setExpenses((xs) => [e, ...xs]);
    setFlash(`${NAMES[p]} · ${title} · ${eur(e.amount)}`);
    setTimeout(() => setFlash(null), 2200);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const v = parseAmount(amount);
    if (!v || v <= 0 || v > 1_000_000) return;
    add("Yeni xərc", Math.round(v / 100), payer, "other");
    setAmount("");
    setAdding(false);
  }

  return (
    <div className={`demo ${mood.color}`}>
      <div className="demo-status" aria-hidden>
        <span>9:41</span>
        <span className="demo-island" />
        <span>●●● ▮</span>
      </div>
      <div className="demo-top">
        <div>
          <small className="faint">Səfər</small>
          <b>İtaliya yayı</b>
        </div>
        <span className="pill">
          <LuBell /> {plan.length}
        </span>
      </div>

      <div className="demo-scroll">
        {tab === "home" ? (
          <>
            <div className="demo-stage">
              <div className="bubble small" key={mood.line}>
                {mood.line}
              </div>
              <div className="gauge-wrap">
                <Gauge ratio={budget.ratio} tone={budget.level === "over" ? "rose" : budget.level === "watch" ? "peach" : "lilac"} size={210} />
                <div className="gauge-mascot">
                  <Mascot mood={mood.mood} color={mood.color} size={112} />
                </div>
              </div>
              <div className="demo-figs">
                <div>
                  <span>Büdcə</span>
                  <b className="num">{eur(BUDGET)}</b>
                </div>
                <div>
                  <span>Xərclənib</span>
                  <b className="num">{eur(total)}</b>
                </div>
                <div>
                  <span>{budget.remaining! < 0 ? "Aşılıb" : "Qalıb"}</span>
                  <b className="num">{eur(Math.abs(budget.remaining!))}</b>
                </div>
              </div>
            </div>

            <div className="demo-quick">
              {PRESETS.map((p) => (
                <button key={p.title} onClick={() => add(p.title, p.euros, p.payer, p.category)}>
                  <span className="ring">
                    <LuPlus />
                  </span>
                  <span>{p.title}</span>
                  <small className="num">{eur(p.euros * 100)}</small>
                </button>
              ))}
              <button onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
                <span className="ring lav">
                  <LuPlus />
                </span>
                <span>Öz xərcin</span>
                <small>yaz</small>
              </button>
            </div>

            {adding && (
              <form className="demo-add" onSubmit={submit}>
                <input className="input" inputMode="decimal" placeholder="Məbləğ, €" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Məbləğ" autoFocus />
                <div className="demo-payers" role="radiogroup" aria-label="Kim ödədi?">
                  {NAMES.map((n, i) => (
                    <button type="button" key={n} role="radio" aria-checked={payer === i} className={payer === i ? "on" : ""} onClick={() => setPayer(i)}>
                      <Avatar name={n} size={28} />
                    </button>
                  ))}
                </div>
                <button className="btn btn-primary btn-sm" type="submit">
                  Əlavə et
                </button>
              </form>
            )}

            <div className="demo-card">
              <div className="eyebrow">Qrup balansı</div>
              {MEMBERS.map((m) => {
                const v = balances.get(m.id)!.outstanding;
                return (
                  <div key={m.id} className="demo-row">
                    <Avatar name={m.name} size={30} />
                    <span>{m.name}</span>
                    <b className={`num ${v > 0 ? "pos" : v < 0 ? "neg" : "faint"}`}>{eur(v, true)}</b>
                  </div>
                );
              })}
            </div>

            <div className="demo-card">
              <div className="eyebrow warm">Son xərclər</div>
              {expenses.slice(0, 3).map((e) => (
                <div key={e.id} className="demo-row">
                  <CategoryTile category={e.category} size={30} />
                  <span>
                    {NAMES[Number(e.paidBy.slice(1))]} · {e.title}
                  </span>
                  <b className="num">{eur(e.amount)}</b>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="demo-settle">
            <h3>Kim kimə ödəyir?</h3>
            <p className="faint small">{plan.length} köçürmə ilə hamı hesablaşır</p>
            {plan.map((t) => (
              <div key={t.from + t.to} className="demo-transfer rise">
                <Avatar name={NAMES[Number(t.from.slice(1))]} size={34} />
                <LuArrowRight className="faint" />
                <Avatar name={NAMES[Number(t.to.slice(1))]} size={34} />
                <span>
                  {NAMES[Number(t.from.slice(1))]} → {dative(NAMES[Number(t.to.slice(1))])}
                </span>
                <b className="num">{eur(t.amount)}</b>
              </div>
            ))}
            <div className="demo-note">Borcu olan «Ödəniş etdim» deyir, pulu alan təsdiqləyir — yalnız sonra borc bağlanır.</div>
          </div>
        )}
      </div>

      {flash && (
        <div className="demo-flash" role="status">
          + {flash}
        </div>
      )}

      <nav className="demo-nav">
        <button className={tab === "home" ? "on" : ""} onClick={() => setTab("home")}>
          <LuHouse />
          <span>Ümumi</span>
        </button>
        <button className="demo-fab" onClick={() => (setTab("home"), setAdding(true))} aria-label="Xərc əlavə et">
          <LuPlus />
        </button>
        <button className={tab === "settle" ? "on" : ""} onClick={() => setTab("settle")}>
          <LuHandCoins />
          <span>Borclar</span>
        </button>
      </nav>
      {expenses.length !== START.length && (
        <button className="demo-reset" onClick={() => (setExpenses(START), setTab("home"))} aria-label="Demonu sıfırla">
          <LuRotateCcw />
        </button>
      )}
    </div>
  );
}
