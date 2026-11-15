import { useState } from "react";
import { LuChevronRight, LuHandCoins, LuPlus, LuReceipt } from "react-icons/lu";
import { dative } from "../../../lib/az";
import { timeAgo } from "../../../lib/dates";
import { budgetState } from "../../../lib/ledger";
import { tripMood } from "../../../lib/mood";
import { Link, navigate } from "../../../state/router";
import { Avatar, Button, Gauge } from "../../../ui/kit";
import { Mascot } from "../../../ui/Mascot";
import { ActivityIcon, activityText } from "./activityText";
import { useTripCtx } from "./context";
import { ConfirmButtons, PaySheet, canResolve } from "./payments";

export function Overview() {
  const c = useTripCtx();
  const { trip, members, payments, activity, expenses } = c.bundle;
  const [pay, setPay] = useState<{ from: string; to: string; max: number } | null>(null);
  const budget = budgetState(trip.budget, c.total);
  const mine = c.balances.get(c.me.id)!;
  const toConfirm = payments.filter((p) => canResolve(p, c));
  const myTransfers = c.plan.filter((t) => t.from === c.me.id);
  const owedToMe = c.plan.filter((t) => t.to === c.me.id);
  const everyoneSettled = expenses.length > 0 && c.plan.length === 0;
  const mood = tripMood({
    firstName: c.me.name.split(" ")[0],
    currency: trip.currency,
    budget,
    hasExpenses: expenses.length > 0,
    myOutstanding: mine.outstanding,
    awaitingMyConfirmation: toConfirm.reduce((s, p) => s + p.amount, 0),
    everyoneSettled,
  });
  const shown = members.filter((m) => m.status === "active" || (c.balances.get(m.id)?.paid ?? 0) + (c.balances.get(m.id)?.share ?? 0) > 0);
  const recent = activity.slice(0, 6);
  const expenseIds = new Set(expenses.map((e) => e.id));

  return (
    <div className="overview">
      <div className="ov-left">
      <section className={`budget-hero ${mood.color} rise`} aria-label="Büdcə">
        <div className="budget-hero-stage">
          <div className="bubble" key={mood.line}>
            {mood.line}
          </div>
          <div className="gauge-wrap">
            <Gauge ratio={budget.ratio} tone={budget.level === "over" ? "rose" : budget.level === "watch" ? "peach" : "lilac"} size={280} />
            <div className="gauge-mascot">
              <Mascot mood={mood.mood} color={mood.color} size={150} />
            </div>
          </div>
        </div>
        <div className="budget-figures">
          {budget.budget ? (
            <>
              <div>
                <span>Büdcə</span>
                <b className="num">{c.money(budget.budget)}</b>
              </div>
              <div>
                <span>Xərclənib</span>
                <b className="num">{c.money(budget.spent)}</b>
              </div>
              <div>
                <span>{budget.remaining! < 0 ? "Aşılıb" : "Qalıb"}</span>
                <b className={`num ${budget.remaining! < 0 ? "neg" : ""}`}>{c.money(Math.abs(budget.remaining!))}</b>
              </div>
            </>
          ) : (
            <>
              <div>
                <span>Ümumi xərc</span>
                <b className="num">{c.money(c.total)}</b>
              </div>
              <div>
                <span>Büdcə</span>
                {c.isAdmin && !c.readOnly ? (
                  <Link className="link" to={`${c.base}/duzelt`}>
                    Təyin et
                  </Link>
                ) : (
                  <b className="faint">Yoxdur</b>
                )}
              </div>
            </>
          )}
        </div>
        {budget.ratio !== null && (
          <p className="budget-pct">
            Büdcənin <b className="num">{Math.round(budget.ratio * 100)}%</b>-i istifadə olunub
          </p>
        )}
      </section>

      <section className="quick" aria-label="Tez əməliyyatlar">
        <button className="quick-btn" onClick={() => c.openExpense()} disabled={c.readOnly}>
          <span className="ring lav">
            <LuPlus />
          </span>
          <span>Xərc əlavə et</span>
        </button>
        <button className="quick-btn" onClick={() => navigate(`${c.base}/xercler`)}>
          <span className="ring">
            <LuReceipt />
          </span>
          <span>Xərclərə bax</span>
          <small className="faint num">{expenses.length}</small>
        </button>
        <button className="quick-btn" onClick={() => navigate(`${c.base}/hesablasma`)}>
          <span className="ring warm">
            <LuHandCoins />
          </span>
          <span>Borcları hesabla</span>
          <small className="faint num">{c.plan.length ? `${c.plan.length} köçürmə` : "hazır"}</small>
        </button>
      </section>
      </div>

      <div className="overview-grid">
        <div className="col">
          {toConfirm.length > 0 && (
            <section className="card status-card warm rise">
              <p className="eyebrow warm">Təsdiq gözləyir</p>
              {toConfirm.map((p) => (
                <div key={p.id} className="confirm-row">
                  <Avatar name={c.member(p.from)!.name} size={40} />
                  <p>
                    <b>{c.nameOf(p.from)}</b> {p.to === c.me.id ? "sənə" : `${c.nameOf(p.to)} üçün`} <b className="hl num">{c.money(p.amount)}</b> göndərdiyini qeyd edib. Pul çatıb?
                  </p>
                  <ConfirmButtons p={p} />
                </div>
              ))}
            </section>
          )}

          <section className="card status-card rise">
            <p className="eyebrow">Sənin vəziyyətin</p>
            {expenses.length === 0 ? (
              <p className="status-text">Hələ xərc yoxdur. İlk xərci yazan kimi kimin nə qədər payı olduğunu burada görəcəksən.</p>
            ) : mine.outstanding < 0 ? (
              <>
                <p className="status-text">
                  Sənin <span className="hl num">{c.money(-mine.outstanding)}</span> borcun var
                  {myTransfers.length === 1 ? (
                    <>
                      {" "}— <b>{dative(c.nameOf(myTransfers[0].to))}</b> qaytarmalısan.
                    </>
                  ) : (
                    "."
                  )}
                  {mine.pendingOut > 0 && (
                    <>
                      {" "}
                      <span className="hl-lav num">{c.money(mine.pendingOut)}</span> təsdiq gözləyir.
                    </>
                  )}
                </p>
                <div className="status-actions">
                  {myTransfers.map((t) =>
                    t.sendable > 0 ? (
                      <Button key={t.to} variant="primary" size="sm" onClick={() => setPay({ from: t.from, to: t.to, max: t.sendable })} disabled={c.readOnly}>
                        {dative(c.nameOf(t.to))} ödəniş etdim
                      </Button>
                    ) : (
                      <span key={t.to} className="badge amber">
                        {c.nameOf(t.to)}: təsdiq gözləyir
                      </span>
                    ),
                  )}
                </div>
              </>
            ) : mine.outstanding > 0 ? (
              <p className="status-text">
                Sənə <span className="pos num">{c.money(mine.outstanding)}</span> qaytarılmalıdır
                {owedToMe.length ? ` — ${owedToMe.map((t) => c.nameOf(t.from)).join(", ")} ödəyəcək.` : "."}
              </p>
            ) : (
              <p className="status-text">Sən tam hesablaşmısan. Rahat gəz!</p>
            )}
            <div className="status-split num">
              <span>
                Ödədiyin <b>{c.money(mine.paid)}</b>
              </span>
              <span>
                Payın <b>{c.money(mine.share)}</b>
              </span>
            </div>
          </section>

          <section className="card rise">
            <div className="card-title">
              <h2>Qrup balansı</h2>
              <Link className="link" to={`${c.base}/hesablasma`}>
                Hesablaşma
              </Link>
            </div>
            <div className="list">
              {shown.map((m) => {
                const b = c.balances.get(m.id)!;
                const v = b.outstanding;
                return (
                  <div key={m.id} className="list-row">
                    <Avatar name={m.name} src={m.avatar} size={40} />
                    <div className="grow">
                      <div className="title">
                        {m.name}
                        {m.id === c.me.id && <span className="faint"> (sən)</span>}
                      </div>
                      <div className="sub">{v > 0 ? "alacaq" : v < 0 ? "borcludur" : "hesablaşıb"}</div>
                    </div>
                    <div className={`amount ${v > 0 ? "pos" : v < 0 ? "neg" : "faint"}`}>{c.money(v, { signed: true })}</div>
                  </div>
                );
              })}
            </div>
            <p className="legend faint">+ pul almalıdır · − pul ödəməlidir</p>
          </section>
        </div>

        <div className="col">
          <section className="card rise">
            <div className="card-title">
              <h2>Son fəaliyyət</h2>
              <Link className="link" to={`${c.base}/tarixce`}>
                Hamısı
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="muted">Hələ heç nə olmayıb.</p>
            ) : (
              <div className="list">
                {recent.map((a) => {
                  const clickable = a.data.expenseId && expenseIds.has(a.data.expenseId);
                  const body = (
                    <>
                      <ActivityIcon a={a} />
                      <div className="grow">
                        <div className="title wrap">{activityText(a, c)}</div>
                        <div className="sub">{timeAgo(a.at)}</div>
                      </div>
                      {a.data.amount ? <div className="amount">{c.money(a.data.amount)}</div> : null}
                      {clickable && <LuChevronRight className="faint" aria-hidden />}
                    </>
                  );
                  return clickable ? (
                    <Link key={a.id} to={`${c.base}/xercler/${a.data.expenseId}`} className="list-row">
                      {body}
                    </Link>
                  ) : (
                    <div key={a.id} className="list-row">
                      {body}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
      {pay && <PaySheet {...pay} onClose={() => setPay(null)} />}
    </div>
  );
}
