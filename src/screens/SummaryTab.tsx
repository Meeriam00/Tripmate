import { useMemo } from "react";
import { LuLock, LuLockOpen } from "react-icons/lu";
import { useToast } from "../components/Toast";
import { Avatar, Button, EmptyState, LinkButton, Money, Panel, cx } from "../components/ui";
import { tripTotal } from "../lib/balances";
import { CATEGORY_META } from "../lib/categories";
import { formatRange, formatShort, nights } from "../lib/dates";
import { formatMoney } from "../lib/money";
import { categoryTotals, dailyTotals, personCategoryShares, settlementView } from "../lib/trip";
import { CATEGORIES } from "../lib/types";
import { href } from "../state/router";
import { useStore } from "../state/store";
import type { WorkspaceApi } from "./TripWorkspace";

export function SummaryTab({ trip, openExpense }: WorkspaceApi) {
  const { dispatch } = useStore();
  const toast = useToast();
  const view = useMemo(() => settlementView(trip), [trip]);
  const cats = useMemo(() => categoryTotals(trip), [trip]);
  const perPerson = useMemo(() => personCategoryShares(trip), [trip]);
  const daily = useMemo(() => dailyTotals(trip), [trip]);
  const total = tripTotal(trip);
  const cur = trip.currency;

  if (trip.expenses.length === 0) {
    return (
      <Panel>
        <EmptyState
          title="The story of the trip goes here"
          body="Where the money went, who covered what and how each day added up. Add a few expenses to see it."
          action={<Button variant="primary" onClick={() => openExpense()}>Add an expense</Button>}
        />
      </Panel>
    );
  }

  const biggest = [...trip.expenses].sort((a, b) => b.amount - a.amount)[0];
  const topPayer = [...trip.participants].sort((a, b) => view.ledgers.get(b.id)!.paid - view.ledgers.get(a.id)!.paid)[0];
  const maxShare = Math.max(1, ...trip.participants.map((p) => view.ledgers.get(p.id)!.share));
  const maxDay = Math.max(1, ...daily.map((d) => d.amount));
  const n = trip.participants.length;
  const closed = !!trip.closedAt;

  return (
    <div className="space-y-6">
      {/* Completion: the trip's closing page */}
      <section
        className={cx("overflow-hidden rounded-[1.25rem] shadow-card", view.settled ? "board" : "bg-card ring-1 ring-line/70")}
        aria-labelledby="sum-h"
      >
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <div>
            <p className={cx("text-[0.9rem]", view.settled ? "text-paper/65" : "text-ink-2")}>
              {formatRange(trip.startDate, trip.endDate)}, {nights(trip.startDate, trip.endDate)} nights
            </p>
            <h2 id="sum-h" className={cx("mt-2 font-display text-[clamp(2.2rem,5vw,3.4rem)] leading-[1] font-medium tracking-[-0.025em]", view.settled ? "text-paper" : "text-ink")}>
              {view.settled ? (closed ? `${trip.name}, closed and settled` : `${trip.name} is settled`) : `${trip.name} so far`}
            </h2>
            <p className={cx("mt-3 max-w-lg text-[1rem] leading-relaxed", view.settled ? "text-paper/75" : "text-ink-2")}>
              {n} people shared {formatMoney(total, cur)} across {trip.expenses.length} expenses
              {view.settled
                ? `, and ${trip.payments.length} payment${trip.payments.length === 1 ? "" : "s"} squared everyone up.`
                : `. ${formatMoney(view.outstanding, cur)} still needs to change hands.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {view.settled ? (
              <Button
                variant={closed ? "ghost" : "signal"}
                className={closed ? "text-paper hover:bg-white/10" : ""}
                icon={closed ? <LuLockOpen aria-hidden /> : <LuLock aria-hidden />}
                onClick={() => {
                  dispatch({ type: "trip/close", tripId: trip.id, closed: !closed });
                  toast.show(closed ? "Trip reopened" : "Trip closed. Good trip.");
                }}
              >
                {closed ? "Reopen trip" : "Close the trip"}
              </Button>
            ) : (
              <LinkButton href={href({ name: "trip", id: trip.id, tab: "settle" })} variant="primary">
                Settle up
              </LinkButton>
            )}
          </div>
        </div>
        <dl className={cx("grid grid-cols-2 border-t sm:grid-cols-4", view.settled ? "border-paper/10" : "border-line/70")}>
          <Fact dark={view.settled} label="Per person" value={formatMoney(Math.round(total / n), cur)} />
          <Fact dark={view.settled} label="Per day" value={formatMoney(Math.round(total / Math.max(1, nights(trip.startDate, trip.endDate) + 1)), cur)} />
          <Fact dark={view.settled} label="Biggest expense" value={formatMoney(biggest.amount, cur)} sub={biggest.title} />
          <Fact dark={view.settled} label="Covered the most" value={topPayer.name} sub={formatMoney(view.ledgers.get(topPayer.id)!.paid, cur)} />
        </dl>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-12">
        <Panel className="p-5 sm:p-6 lg:col-span-5">
          <h3 className="font-display text-[1.35rem] font-medium">Where the money went</h3>
          <div className="mt-5 flex h-3.5 overflow-hidden rounded-full" role="img" aria-label={cats.map((c) => `${CATEGORY_META[c.category].label} ${Math.round((c.amount / total) * 100)}%`).join(", ")}>
            {cats.map((c) => (
              <span key={c.category} style={{ width: `${(c.amount / total) * 100}%`, background: CATEGORY_META[c.category].color }} className="h-full border-r-2 border-card last:border-r-0" />
            ))}
          </div>
          <ul className="mt-5 space-y-3">
            {cats.map((c) => (
              <li key={c.category} className="flex items-center gap-3 text-[0.92rem]">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_META[c.category].color }} aria-hidden />
                <span className="flex-1">
                  {CATEGORY_META[c.category].label}
                  <span className="ml-2 text-[0.8rem] text-ink-3">{c.count}</span>
                </span>
                <span className="w-10 text-right text-[0.84rem] text-ink-3 tabular">{Math.round((c.amount / total) * 100)}%</span>
                <Money value={c.amount} currency={cur} className="w-24 text-right font-semibold" />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="p-5 sm:p-6 lg:col-span-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-[1.35rem] font-medium">What each person's trip cost</h3>
            <p className="text-[0.8rem] text-ink-3">their share, by category</p>
          </div>
          <ul className="mt-5 space-y-4">
            {trip.participants.map((p) => {
              const l = view.ledgers.get(p.id)!;
              const m = perPerson.get(p.id)!;
              return (
                <li key={p.id}>
                  <div className="flex items-center gap-2.5">
                    <Avatar person={p} size={26} />
                    <span className="flex-1 text-[0.92rem] font-medium">{p.name}</span>
                    <span className="text-[0.8rem] text-ink-3">paid {formatMoney(l.paid, cur)}</span>
                    <Money value={l.share} currency={cur} className="w-24 text-right font-semibold" />
                  </div>
                  <div className="mt-2 ml-9 flex h-2.5 overflow-hidden rounded-full bg-paper-2" style={{ width: `calc(${(l.share / maxShare) * 100}% - 2.25rem)` }}>
                    {CATEGORIES.filter((c) => m.get(c)).map((c) => (
                      <span key={c} title={`${CATEGORY_META[c].label}: ${formatMoney(m.get(c)!, cur)}`} style={{ width: `${(m.get(c)! / l.share) * 100}%`, background: CATEGORY_META[c].color }} className="h-full" />
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel className="p-5 sm:p-6 lg:col-span-12">
          <h3 className="font-display text-[1.35rem] font-medium">Day by day</h3>
          <div className="mt-6 flex h-44 items-end gap-2 sm:gap-4" role="list">
            {daily.map((d) => (
              <div key={d.date} role="listitem" className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                <span className="text-[0.74rem] font-semibold text-ink-2 tabular">{formatMoney(d.amount, cur, { compact: true })}</span>
                <span className="w-full max-w-16 rounded-t-md bg-forest" style={{ height: `${Math.max(4, (d.amount / maxDay) * 100)}%` }} aria-hidden />
                <span className="text-[0.74rem] whitespace-nowrap text-ink-3">{formatShort(d.date)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Fact({ label, value, sub, dark }: { label: string; value: string; sub?: string; dark?: boolean }) {
  return (
    <div className={cx("p-5 sm:p-6 [&:not(:last-child)]:border-r max-sm:[&:nth-child(2)]:border-r-0 max-sm:[&:nth-child(-n+2)]:border-b", dark ? "border-paper/10" : "border-line/70")}>
      <dt className={cx("text-[0.8rem]", dark ? "text-paper/60" : "text-ink-3")}>{label}</dt>
      <dd className={cx("mt-1 text-[1.15rem] font-semibold tabular", dark ? "text-paper" : "text-ink")}>{value}</dd>
      {sub && <dd className={cx("truncate text-[0.8rem]", dark ? "text-paper/55" : "text-ink-3")}>{sub}</dd>}
    </div>
  );
}
