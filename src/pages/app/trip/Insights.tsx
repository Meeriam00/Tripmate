import { CATEGORY } from "../../../lib/categories";
import { addDays, formatDay, tripDays } from "../../../lib/dates";
import { budgetState, categoryTotals, dailyTotals } from "../../../lib/ledger";
import { CategoryIcon } from "../../../ui/icons";
import { Empty } from "../../../ui/kit";
import { useTripCtx } from "./context";

/** Expense analytics. Every number here comes from the trip's own records. */
export function Insights() {
  const c = useTripCtx();
  const { trip, expenses, members } = c.bundle;

  if (!expenses.length)
    return (
      <div className="insights">
        <h2 className="page-title">Statistika</h2>
        <Empty mood="sleepy" title="Statistika üçün xərc lazımdır" text="Bir neçə xərc yazın — burada kateqoriyalar, günlər və iştirakçılar üzrə bölgünü görəcəksiniz." />
      </div>
    );

  const total = c.total;
  const cats = categoryTotals(expenses);
  const maxCat = Math.max(...cats.map((x) => x.amount));

  // Every day of the trip, plus any day outside it that has expenses (e.g. a deposit paid earlier).
  const daily = dailyTotals(expenses);
  const range: string[] = [];
  const n = Math.min(tripDays(trip.startDate, trip.endDate), 31);
  for (let i = 0; i < n; i++) range.push(addDays(trip.startDate, i));
  const allDays = [...new Set([...daily.map((d) => d.date), ...range])].sort();
  const byDay = new Map(daily.map((d) => [d.date, d.amount]));
  const maxDay = Math.max(1, ...daily.map((d) => d.amount));
  const tripDayCount = Math.max(1, tripDays(trip.startDate, trip.endDate));
  const biggest = [...expenses].sort((a, b) => b.amount - a.amount)[0];

  const people = members
    .map((m) => ({ m, b: c.balances.get(m.id)! }))
    .filter(({ m, b }) => m.status === "active" || b.paid || b.share)
    .sort((a, b) => b.b.paid - a.b.paid);
  const maxPerson = Math.max(1, ...people.map((p) => Math.max(p.b.paid, p.b.share)));

  const budget = budgetState(trip.budget, total);
  const scale = Math.max(budget.budget ?? 0, total) || 1;

  return (
    <div className="insights">
      <div className="page-head">
        <div>
          <h2 className="page-title">Statistika</h2>
          <p className="muted">Pul hara gedir — bir baxışda.</p>
        </div>
      </div>

      <section className="stat-tiles">
        <div className="stat">
          <span>Ümumi xərc</span>
          <b className="num">{c.money(total)}</b>
        </div>
        <div className="stat">
          <span>Gündəlik orta</span>
          <b className="num">{c.money(Math.round(total / tripDayCount))}</b>
        </div>
        <div className="stat">
          <span>Nəfər başına</span>
          <b className="num">{c.money(Math.round(total / Math.max(1, members.filter((m) => m.status === "active").length)))}</b>
        </div>
        <div className="stat">
          <span>Ən böyük xərc</span>
          <b className="num">{c.money(biggest.amount)}</b>
          <small className="faint">{biggest.title}</small>
        </div>
      </section>

      <div className="insights-grid">
        <section className="card">
          <div className="card-title">
            <h2>Büdcə və faktiki xərc</h2>
          </div>
          {budget.budget ? (
            <>
              <div className="bullet" role="img" aria-label={`Büdcə ${c.money(budget.budget)}, xərclənib ${c.money(total)}`}>
                <div className="bullet-track">
                  <span className={`bullet-fill ${budget.level}`} style={{ width: `${(total / scale) * 100}%` }} />
                  <span className="bullet-mark" style={{ left: `${(budget.budget / scale) * 100}%` }} />
                </div>
              </div>
              <div className="bullet-legend">
                <span>
                  <i className={`sw fill ${budget.level}`} /> Xərclənib <b className="num">{c.money(total)}</b>
                </span>
                <span>
                  <i className="sw mark" /> Planlanan büdcə <b className="num">{c.money(budget.budget)}</b>
                </span>
              </div>
              <p className={`bullet-note ${budget.remaining! < 0 ? "neg" : ""}`}>
                {budget.remaining! >= 0 ? (
                  <>
                    Büdcədən <b className="num">{c.money(budget.remaining!)}</b> qalıb ({Math.round(budget.ratio! * 100)}% istifadə olunub).
                  </>
                ) : (
                  <>
                    Büdcə <b className="num">{c.money(-budget.remaining!)}</b> aşılıb.
                  </>
                )}
              </p>
            </>
          ) : (
            <p className="muted">Bu səfər üçün büdcə təyin edilməyib.</p>
          )}
        </section>

        <section className="card">
          <div className="card-title">
            <h2>Kateqoriyalar üzrə</h2>
          </div>
          <div className="hbars">
            {cats.map(({ category, amount }) => (
              <div key={category} className="hbar">
                <div className="hbar-label">
                  <span className="hbar-icon" style={{ color: CATEGORY[category].color }}>
                    <CategoryIcon category={category} />
                  </span>
                  {CATEGORY[category].label}
                </div>
                <div className="hbar-track">
                  <span style={{ width: `${(amount / maxCat) * 100}%`, background: CATEGORY[category].color }} />
                </div>
                <div className="hbar-val num">
                  {c.money(amount)} <span className="faint">{Math.round((amount / total) * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card span-2">
          <div className="card-title">
            <h2>Günlər üzrə</h2>
            <span className="faint small">ən çox: {formatDay(daily.reduce((a, b) => (b.amount > a.amount ? b : a)).date)}</span>
          </div>
          <div className="vbars" role="list">
            {allDays.map((d) => {
              const v = byDay.get(d) ?? 0;
              const outside = d < trip.startDate || d > trip.endDate;
              return (
                <div key={d} className={`vbar ${outside ? "outside" : ""} ${v === maxDay ? "max" : ""}`} role="listitem" title={`${formatDay(d)}: ${c.money(v)}`}>
                  <span className="vbar-val num">{v ? c.money(v).replace(/,00 /, " ") : ""}</span>
                  <div className="vbar-col">
                    <span style={{ height: `${(v / maxDay) * 100}%` }} />
                  </div>
                  <span className="vbar-day">{formatDay(d).replace(" ", " ").split(" ")[0]}</span>
                  <span className="vbar-month faint">{formatDay(d).split(" ")[1]?.slice(0, 3)}</span>
                </div>
              );
            })}
          </div>
          {allDays.some((d) => d < trip.startDate || d > trip.endDate) && <p className="faint small">Solğun sütunlar səfər tarixlərindən kənar günlərdir (məsələn, öncədən ödənişlər).</p>}
        </section>

        <section className="card span-2">
          <div className="card-title">
            <h2>İştirakçılar müqayisəsi</h2>
            <span className="legend-inline small">
              <i className="sw paid" /> Ödəyib <i className="sw share" /> Payı
            </span>
          </div>
          <div className="pbars">
            {people.map(({ m, b }) => (
              <div key={m.id} className="pbar">
                <div className="pbar-name">{c.nameOf(m.id)}</div>
                <div className="pbar-bars">
                  <div className="pbar-track">
                    <span className="paid" style={{ width: `${(b.paid / maxPerson) * 100}%` }} />
                    <em className="num">{c.money(b.paid)}</em>
                  </div>
                  <div className="pbar-track">
                    <span className="share" style={{ width: `${(b.share / maxPerson) * 100}%` }} />
                    <em className="num">{c.money(b.share)}</em>
                  </div>
                </div>
                <div className={`pbar-net num ${b.net > 0 ? "pos" : b.net < 0 ? "neg" : "faint"}`}>{c.money(b.net, { signed: true })}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
