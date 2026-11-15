import { useState } from "react";
import { LuArrowRight, LuCircleCheck, LuCircleX, LuClock, LuUndo2 } from "react-icons/lu";
import { backend } from "../../../backend";
import { genitive } from "../../../lib/az";
import { formatDay, localISO } from "../../../lib/dates";
import type { Payment } from "../../../lib/types";
import { Avatar, Button, Empty, errorText, useToast } from "../../../ui/kit";
import { useTripCtx } from "./context";
import { ConfirmButtons, PaySheet, canPayFor, canResolve } from "./payments";

function clock(ms: number) {
  const d = new Date(ms);
  return `${formatDay(localISO(ms))}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function CancelButton({ p }: { p: Payment }) {
  const c = useTripCtx();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await backend.resolvePayment(c.bundle.trip.id, p.id, "cancel");
          toast.ok("Ödəniş qeydi ləğv edildi.");
        } catch (e) {
          toast.err(errorText(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <LuUndo2 /> Ləğv et
    </Button>
  );
}

export function Settle() {
  const c = useTripCtx();
  const { payments, members, expenses } = c.bundle;
  const [pay, setPay] = useState<{ from: string; to: string; max: number } | null>(null);
  const mine = c.balances.get(c.me.id)!;
  const openTotal = c.plan.reduce((s, t) => s + t.amount, 0);
  const pending = payments.filter((p) => p.status === "pending");
  const history = payments.filter((p) => p.status !== "pending");
  const nonZero = [...c.balances.values()].filter((b) => b.outstanding !== 0).length;
  const shown = members.filter((m) => {
    const b = c.balances.get(m.id)!;
    return m.status === "active" || b.paid || b.share || b.sent || b.received;
  });

  return (
    <div className="settle">
      <div className="page-head">
        <div>
          <h2 className="page-title">Borclar və hesablaşma</h2>
          <p className="muted">Kim kimə nə qədər qaytarmalıdır — ən az köçürmə ilə.</p>
        </div>
      </div>

      <section className="stat-tiles">
        <div className="stat">
          <span>Ümumi xərclər</span>
          <b className="num">{c.money(c.total)}</b>
        </div>
        <div className="stat">
          <span>Sənin ödədiyin</span>
          <b className="num">{c.money(mine.paid)}</b>
        </div>
        <div className="stat">
          <span>Açıq borclar</span>
          <b className="num">{c.money(openTotal)}</b>
        </div>
        <div className={`stat ${mine.outstanding > 0 ? "good" : mine.outstanding < 0 ? "bad" : ""}`}>
          <span>Sənin balansın</span>
          <b className="num">{c.money(mine.outstanding, { signed: true })}</b>
        </div>
      </section>

      <section className="card">
        <div className="card-title">
          <h2>Kim kimə ödəyir?</h2>
          {c.plan.length > 0 && (
            <span className="badge lav">
              {c.plan.length} köçürmə
            </span>
          )}
        </div>
        {c.plan.length === 0 ? (
          expenses.length ? (
            <Empty mood="party" color="mint" size={110} title="Hamı hesablaşıb!" text="Açıq borc yoxdur. Növbəti səfərə qədər!" />
          ) : (
            <Empty mood="calm" size={100} title="Hesablaşacaq heç nə yoxdur" text="Xərc əlavə edin, kimin kimə nə qədər ödəyəcəyini burada görəcəksiniz." />
          )
        ) : (
          <>
            <div className="settle-table" role="table" aria-label="Kim kimə ödəyir">
              <div className="settle-head" role="row">
                <span role="columnheader">Kim ödəyir?</span>
                <span role="columnheader">Kimə ödəyir?</span>
                <span role="columnheader">Məbləğ</span>
                <span role="columnheader">Vəziyyət</span>
                <span role="columnheader" className="sr-only">
                  Əməliyyat
                </span>
              </div>
              {c.plan.map((t) => {
                const from = c.member(t.from)!;
                const to = c.member(t.to)!;
                const pend = pending.filter((p) => p.from === t.from && p.to === t.to);
                const involvesMe = t.from === c.me.id || t.to === c.me.id;
                return (
                  <div key={t.from + t.to} className={`settle-row ${involvesMe ? "mine" : ""}`} role="row">
                    <span role="cell" className="who">
                      <Avatar name={from.name} src={from.avatar} size={36} />
                      <b>{c.nameOf(t.from)}</b>
                    </span>
                    <span role="cell" className="who">
                      <LuArrowRight className="arrow faint" aria-hidden />
                      <Avatar name={to.name} src={to.avatar} size={36} />
                      <b>{c.nameOf(t.to)}</b>
                    </span>
                    <span role="cell" className="amt num">
                      {c.money(t.amount)}
                    </span>
                    <span role="cell">
                      {t.pending > 0 ? (
                        <span className="badge amber">
                          <LuClock /> Təsdiq gözləyir · {c.money(t.pending)}
                        </span>
                      ) : (
                        <span className="badge">Ödənilməyib</span>
                      )}
                    </span>
                    <span role="cell" className="act">
                      {pend.some((p) => canResolve(p, c)) ? (
                        <ConfirmButtons p={pend.find((p) => canResolve(p, c))!} compact />
                      ) : canPayFor(t.from, c) && t.sendable > 0 ? (
                        <Button size="sm" onClick={() => setPay({ from: t.from, to: t.to, max: t.sendable })}>
                          Ödəniş etdim
                        </Button>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="faint small" style={{ marginTop: 12 }}>
              {nonZero} nəfərin açıq balansı {c.plan.length} köçürmə ilə bağlanır. Ödəniş yalnız pulu alan təsdiqləyəndən sonra borcdan çıxılır.
            </p>
          </>
        )}
      </section>

      {pending.length > 0 && (
        <section className="card">
          <div className="card-title">
            <h2>Təsdiq gözləyən ödənişlər</h2>
            <span className="badge amber">{pending.length}</span>
          </div>
          <div className="list">
            {pending.map((p) => (
              <div key={p.id} className="list-row pay-row">
                <span className="act-icon warm">
                  <LuClock />
                </span>
                <div className="grow">
                  <div className="title wrap">
                    {c.nameOf(p.from)} → {c.nameOf(p.to)} · <span className="num">{c.money(p.amount)}</span>
                  </div>
                  <div className="sub">
                    {clock(p.createdAt)} · {p.to === c.me.id ? "pulu aldınsa təsdiqlə" : `${genitive(c.nameOf(p.to))} təsdiqini gözləyir`}
                  </div>
                </div>
                {canResolve(p, c) ? <ConfirmButtons p={p} /> : p.createdBy === c.me.id || p.from === c.me.id ? <CancelButton p={p} /> : null}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-title">
          <h2>Balans cədvəli</h2>
        </div>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>İştirakçı</th>
                <th>Ödəyib</th>
                <th>Payı</th>
                <th>Balans</th>
                <th>Ödənişlər</th>
                <th>Qalıq</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => {
                const b = c.balances.get(m.id)!;
                const settled = b.sent - b.received;
                return (
                  <tr key={m.id} className={m.id === c.me.id ? "mine" : ""}>
                    <td>
                      <span className="who">
                        <Avatar name={m.name} src={m.avatar} size={30} /> {m.name}
                      </span>
                    </td>
                    <td className="num">{c.money(b.paid)}</td>
                    <td className="num">{c.money(b.share)}</td>
                    <td className={`num ${b.net > 0 ? "pos" : b.net < 0 ? "neg" : ""}`}>{c.money(b.net, { signed: true })}</td>
                    <td className="num faint">{settled ? c.money(settled, { signed: true }) : "—"}</td>
                    <td className={`num strong ${b.outstanding > 0 ? "pos" : b.outstanding < 0 ? "neg" : ""}`}>{c.money(b.outstanding, { signed: true })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="faint small" style={{ marginTop: 10 }}>
          Balans = ödədiyi − payı. Qalıq = balans + göndərdiyi − aldığı (yalnız təsdiqlənmiş ödənişlər). Bütün qalıqların cəmi həmişə sıfırdır.
        </p>
      </section>

      {history.length > 0 && (
        <section className="card">
          <div className="card-title">
            <h2>Ödəniş tarixçəsi</h2>
          </div>
          <div className="list">
            {history.map((p) => (
              <div key={p.id} className="list-row">
                <span className={`act-icon ${p.status === "confirmed" ? "mint" : p.status === "rejected" ? "rose" : ""}`}>
                  {p.status === "confirmed" ? <LuCircleCheck /> : p.status === "rejected" ? <LuCircleX /> : <LuUndo2 />}
                </span>
                <div className="grow">
                  <div className="title wrap">
                    {c.nameOf(p.from)} → {c.nameOf(p.to)}
                  </div>
                  <div className="sub wrap">
                    {p.status === "confirmed" ? "Təsdiqlədi" : p.status === "rejected" ? "Rədd etdi" : "Ləğv etdi"}: {p.resolvedBy ? c.nameOf(p.resolvedBy) : "—"}
                    {p.resolvedAt ? ` · ${clock(p.resolvedAt)}` : ""}
                  </div>
                </div>
                <div className={`amount ${p.status === "confirmed" ? "" : "faint strike"}`}>{c.money(p.amount)}</div>
              </div>
            ))}
          </div>
        </section>
      )}
      {pay && <PaySheet {...pay} onClose={() => setPay(null)} />}
    </div>
  );
}
