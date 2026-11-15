import { useMemo, useState } from "react";
import { LuPencil, LuPlus, LuSearch, LuTrash2 } from "react-icons/lu";
import { backend } from "../../../backend";
import { CATEGORY, CATEGORY_ORDER } from "../../../lib/categories";
import { formatDay, formatDayLong, timeAgo } from "../../../lib/dates";
import { formatPercent } from "../../../lib/split";
import type { Category, Expense } from "../../../lib/types";
import { navigate } from "../../../state/router";
import { CategoryIcon } from "../../../ui/icons";
import { Avatar, AvatarStack, Button, CategoryTile, ConfirmDialog, Empty, Field, Sheet, errorText, useToast } from "../../../ui/kit";
import { useTripCtx } from "./context";

const METHOD = { equal: "Bərabər", custom: "Məbləğlə", percent: "Faizlə" } as const;

function ExpenseDetail({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const c = useTripCtx();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const payer = c.member(expense.paidBy);
  const creator = c.member(expense.createdBy);
  const editable = c.canEdit(expense);
  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title="Xərcin təfərrüatı"
        footer={
          editable ? (
            <>
              <Button variant="danger" onClick={() => setConfirm(true)}>
                <LuTrash2 /> Sil
              </Button>
              <Button
                onClick={() => {
                  onClose();
                  c.openExpense(expense);
                }}
              >
                <LuPencil /> Düzəlt
              </Button>
            </>
          ) : undefined
        }
      >
        <div className="detail">
          <div className="detail-top">
            <CategoryTile category={expense.category} size={56} />
            <div>
              <h3>{expense.title}</h3>
              <p className="faint">
                {CATEGORY[expense.category].label} · {formatDayLong(expense.date)}
              </p>
            </div>
          </div>
          <div className="detail-amount num">{c.money(expense.amount)}</div>
          <div className="detail-payer">
            <Avatar name={payer?.name ?? "?"} src={payer?.avatar} size={36} />
            <span>
              <b>{c.nameOf(expense.paidBy)}</b> ödəyib
            </span>
            <span className="badge lav" style={{ marginLeft: "auto" }}>
              {METHOD[expense.method]} bölgü
            </span>
          </div>
          <div className="label" style={{ margin: "18px 0 6px" }}>
            Paylar
          </div>
          <div className="list">
            {Object.entries(expense.shares).map(([id, v]) => {
              const m = c.member(id);
              return (
                <div key={id} className="list-row">
                  <Avatar name={m?.name ?? "?"} src={m?.avatar} size={34} />
                  <div className="grow">
                    <div className="title">{m?.name ?? "—"}</div>
                    {expense.method === "percent" && expense.percents?.[id] ? <div className="sub">{formatPercent(expense.percents[id])}%</div> : null}
                  </div>
                  <div className="amount">{c.money(v)}</div>
                </div>
              );
            })}
          </div>
          {expense.note && (
            <div className="detail-note">
              <div className="label">Qeyd</div>
              <p>{expense.note}</p>
            </div>
          )}
          {expense.receipt && (
            <a className="detail-receipt" href={expense.receipt} target="_blank" rel="noreferrer">
              <img src={expense.receipt} alt="Çekin şəkli" />
            </a>
          )}
          <p className="faint small" style={{ marginTop: 14 }}>
            {creator ? `${creator.name} yazıb` : "Yazılıb"} · {timeAgo(expense.createdAt)}
            {expense.updatedAt > expense.createdAt + 1000 ? ` · dəyişdirilib ${timeAgo(expense.updatedAt)}` : ""}
          </p>
          {!editable && !c.readOnly && <p className="faint small">Bu xərci yalnız onu yazan və ya admin dəyişə bilər.</p>}
        </div>
      </Sheet>
      <ConfirmDialog
        open={confirm}
        title="Xərc silinsin?"
        text={
          <>
            «{expense.title}» ({c.money(expense.amount)}) silinəcək və bütün balanslar yenidən hesablanacaq.
          </>
        }
        confirmLabel="Bəli, sil"
        danger
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          try {
            await backend.deleteExpense(c.bundle.trip.id, expense.id);
            toast.ok("Xərc silindi, balanslar yeniləndi.");
            onClose();
          } catch (e) {
            toast.err(errorText(e));
          }
        }}
      />
    </>
  );
}

export function Expenses({ detailId }: { detailId?: string }) {
  const c = useTripCtx();
  const { expenses, members } = c.bundle;
  const [cat, setCat] = useState<Category | "all">("all");
  const [who, setWho] = useState<string>("all");
  const [day, setDay] = useState<string>("all");
  const [q, setQ] = useState("");

  const days = useMemo(() => [...new Set(expenses.map((e) => e.date))].sort().reverse(), [expenses]);
  const catTotals = useMemo(() => {
    const m = new Map<Category, number>();
    for (const e of expenses) m.set(e.category, (m.get(e.category) ?? 0) + 1);
    return m;
  }, [expenses]);

  const filtered = expenses.filter(
    (e) =>
      (cat === "all" || e.category === cat) &&
      (who === "all" || e.paidBy === who || e.shares[who] !== undefined) &&
      (day === "all" || e.date === day) &&
      (!q.trim() || e.title.toLocaleLowerCase("az").includes(q.trim().toLocaleLowerCase("az"))),
  );
  const groups = useMemo(() => {
    const g = new Map<string, Expense[]>();
    for (const e of filtered) g.set(e.date, [...(g.get(e.date) ?? []), e]);
    return [...g];
  }, [filtered]);
  const filteredTotal = filtered.reduce((s, e) => s + e.amount, 0);
  const detail = detailId ? expenses.find((e) => e.id === detailId) : undefined;
  const active = cat !== "all" || who !== "all" || day !== "all" || q.trim();

  return (
    <div className="expenses">
      <div className="page-head">
        <div>
          <h2 className="page-title">Xərclər</h2>
          <p className="muted">
            {expenses.length} xərc · cəmi <b className="num">{c.money(c.total)}</b>
          </p>
        </div>
        {!c.readOnly && (
          <Button onClick={() => c.openExpense()} className="hide-sm">
            <LuPlus /> Xərc əlavə et
          </Button>
        )}
      </div>

      {expenses.length > 0 && (
        <div className="filters card flat">
          <div className="chips" role="group" aria-label="Kateqoriya üzrə filtr">
            <button className={`chip ${cat === "all" ? "on" : ""}`} aria-pressed={cat === "all"} onClick={() => setCat("all")}>
              Hamısı <span className="count">{expenses.length}</span>
            </button>
            {CATEGORY_ORDER.filter((k) => catTotals.has(k)).map((k) => (
              <button key={k} className={`chip ${cat === k ? "on" : ""}`} aria-pressed={cat === k} onClick={() => setCat(k)}>
                <CategoryIcon category={k} /> {CATEGORY[k].short} <span className="count">{catTotals.get(k)}</span>
              </button>
            ))}
          </div>
          <div className="filter-row">
            <div className="input-wrap search">
              <LuSearch className="search-icon" aria-hidden />
              <input className="input" placeholder="Axtar..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Xərc axtar" />
            </div>
            <Field>
              <select className="input" value={who} onChange={(e) => setWho(e.target.value)} aria-label="İştirakçı üzrə filtr">
                <option value="all">Bütün iştirakçılar</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <select className="input" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Tarix üzrə filtr">
                <option value="all">Bütün günlər</option>
                {days.map((d) => (
                  <option key={d} value={d}>
                    {formatDay(d)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {active && (
            <div className="filter-sum">
              <span className="muted">
                {filtered.length} nəticə · <b className="num">{c.money(filteredTotal)}</b>
              </span>
              <button
                className="link"
                onClick={() => {
                  setCat("all");
                  setWho("all");
                  setDay("all");
                  setQ("");
                }}
              >
                Filtrləri təmizlə
              </button>
            </div>
          )}
        </div>
      )}

      {expenses.length === 0 ? (
        <Empty
          mood="happy"
          title="Hələ xərc yoxdur"
          text="Kim nə ödədisə yaz — Tripo hər kəsin payını özü hesablayacaq."
          action={
            !c.readOnly && (
              <Button onClick={() => c.openExpense()}>
                <LuPlus /> İlk xərci əlavə et
              </Button>
            )
          }
        />
      ) : filtered.length === 0 ? (
        <Empty mood="worried" color="peach" size={100} title="Heç nə tapılmadı" text="Filtrləri dəyişib yenidən yoxlayın." />
      ) : (
        groups.map(([date, list]) => (
          <section key={date} className="day-group">
            <h3 className="day-title">
              <span>{formatDayLong(date)}</span>
              <span className="faint num">{c.money(list.reduce((s, e) => s + e.amount, 0))}</span>
            </h3>
            <div className="card list expense-list">
              {list.map((e) => {
                const sharers = Object.keys(e.shares).map((id) => c.member(id)).filter(Boolean) as typeof members;
                const myShare = e.shares[c.me.id];
                return (
                  <button key={e.id} className="list-row expense-row" onClick={() => navigate(`${c.base}/xercler/${e.id}`, { keepScroll: true })}>
                    <CategoryTile category={e.category} />
                    <div className="grow">
                      <div className="title">{e.title}</div>
                      <div className="sub">
                        <b>{c.nameOf(e.paidBy)}</b> ödəyib · {CATEGORY[e.category].short}
                        {e.method !== "equal" ? ` · ${METHOD[e.method].toLowerCase()}` : ""}
                      </div>
                    </div>
                    <div className="expense-right">
                      <div className="amount">{c.money(e.amount)}</div>
                      <div className="expense-sharers">
                        <AvatarStack people={sharers} size={22} max={4} />
                      </div>
                      {myShare !== undefined && <div className="sub num">payın {c.money(myShare)}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}
      {detail && <ExpenseDetail expense={detail} onClose={() => navigate(`${c.base}/xercler`, { replace: true, keepScroll: true })} />}
      {detailId && !detail && (
        <Sheet open onClose={() => navigate(`${c.base}/xercler`, { replace: true })} title="Xərc tapılmadı">
          <p className="muted">Bu xərc silinib və ya mövcud deyil.</p>
        </Sheet>
      )}
    </div>
  );
}
