import { useMemo } from "react";
import { LuArrowRight, LuCircleCheck, LuPlus } from "react-icons/lu";
import { CategoryIcon } from "../components/CategoryIcon";
import { Avatar, Button, EmptyState, Money, Panel, cx } from "../components/ui";
import { tripTotal } from "../lib/balances";
import { formatShort, nights } from "../lib/dates";
import { formatMoney } from "../lib/money";
import { settlementView } from "../lib/trip";
import { href } from "../state/router";
import type { WorkspaceApi } from "./TripWorkspace";

export function OverviewTab({ trip, openExpense }: WorkspaceApi) {
  const view = useMemo(() => settlementView(trip), [trip]);
  const total = tripTotal(trip);
  const days = Math.max(1, nights(trip.startDate, trip.endDate) + 1);
  const cur = trip.currency;
  const byId = new Map(trip.participants.map((p) => [p.id, p]));
  const recent = [...trip.expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 5);
  const maxAbs = Math.max(1, ...[...view.ledgers.values()].map((l) => Math.abs(l.outstanding)));

  if (trip.expenses.length === 0) {
    return (
      <Panel>
        <EmptyState
          art={
            <div className="mb-6 flex -space-x-2">
              {trip.participants.slice(0, 5).map((p) => (
                <Avatar key={p.id} person={p} size={44} ring />
              ))}
            </div>
          }
          title="Nothing logged yet"
          body={`When someone pays for something, add it here. Tripmate keeps a running balance for all ${trip.participants.length} of you.`}
          action={
            <Button variant="primary" size="lg" icon={<LuPlus aria-hidden />} onClick={() => openExpense()}>
              Add the first expense
            </Button>
          }
        />
      </Panel>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-12">
      <Panel className="lg:col-span-12">
        <dl className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-[1.6fr_repeat(4,1fr)]">
          <div className="col-span-2 border-b border-line/70 p-5 sm:col-span-4 sm:p-6 lg:col-span-1 lg:border-r lg:border-b-0">
            <dt className="text-[0.86rem] text-ink-2">Spent together</dt>
            <dd className="mt-1 font-display text-[clamp(2.4rem,5vw,3.2rem)] leading-none font-medium tracking-[-0.02em] text-forest tabular">
              {formatMoney(total, cur)}
            </dd>
          </div>
          <Stat label="People" value={String(trip.participants.length)} />
          <Stat label="Expenses" value={String(trip.expenses.length)} />
          <Stat label="Per person, per day" value={formatMoney(Math.round(total / trip.participants.length / days), cur)} />
          <Stat
            label="Still to settle"
            value={view.settled ? "All square" : formatMoney(view.outstanding, cur)}
            tone={view.settled ? "gain" : "owe"}
            last
          />
        </dl>
      </Panel>

      <Panel className="self-start lg:col-span-7">
        <div className="flex items-baseline justify-between px-5 pt-5 sm:px-6 sm:pt-6">
          <h2 className="font-display text-[1.55rem] leading-tight font-medium">Balances</h2>
          <p className="text-[0.8rem] text-ink-3">paid minus share{trip.payments.length ? ", after payments" : ""}</p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[0.92rem]">
            <thead>
              <tr className="text-left text-[0.78rem] text-ink-3">
                <th scope="col" className="py-2 pl-5 font-medium sm:pl-6">Person</th>
                <th scope="col" className="hidden py-2 text-right font-medium sm:table-cell">Paid</th>
                <th scope="col" className="hidden py-2 text-right font-medium sm:table-cell">Share</th>
                <th scope="col" className="w-[38%] py-2 pr-5 text-right font-medium sm:pr-6">Balance</th>
              </tr>
            </thead>
            <tbody>
              {trip.participants.map((p) => {
                const l = view.ledgers.get(p.id)!;
                const b = l.outstanding;
                return (
                  <tr key={p.id} className="border-t border-line/60">
                    <th scope="row" className="py-3 pl-5 text-left font-medium sm:pl-6">
                      <span className="flex items-center gap-2.5">
                        <Avatar person={p} size={30} />
                        {p.name}
                      </span>
                    </th>
                    <td className="hidden py-3 text-right text-ink-2 tabular sm:table-cell">{formatMoney(l.paid, cur)}</td>
                    <td className="hidden py-3 text-right text-ink-2 tabular sm:table-cell">{formatMoney(l.share, cur)}</td>
                    <td className="py-3 pr-5 sm:pr-6">
                      <div className="flex items-center justify-end gap-3">
                        <span className="relative hidden h-2 w-20 sm:block" aria-hidden>
                          <span className="absolute inset-y-[-3px] left-1/2 w-px bg-line" />
                          {b !== 0 && (
                            <span
                              className={cx("absolute inset-y-0 rounded-full", b > 0 ? "left-1/2 bg-gain" : "right-1/2 bg-owe")}
                              style={{ width: `${(Math.abs(b) / maxAbs) * 50}%` }}
                            />
                          )}
                        </span>
                        <span className="min-w-[6.5rem] text-right">
                          <Money value={b} currency={cur} signed tone="auto" className="font-semibold" />
                          <span className="block text-[0.74rem] text-ink-3">{b > 0 ? "gets back" : b < 0 ? "owes" : "square"}</span>
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-6 lg:col-span-5">
        <section className="board overflow-hidden rounded-2xl shadow-card" aria-labelledby="ov-settle">
          <div className="flex items-baseline justify-between px-5 pt-5 sm:px-6">
            <h2 id="ov-settle" className="font-display text-[1.35rem] font-medium">
              {view.settled ? "Everyone is square" : "To settle up"}
            </h2>
            {!view.settled && (
              <span className="text-[0.8rem] text-paper/60">
                {view.transfers.length} payment{view.transfers.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          {view.settled ? (
            <p className="flex items-center gap-2 px-5 pt-2 pb-6 text-[0.92rem] text-paper/75 sm:px-6">
              <LuCircleCheck className="text-signal" aria-hidden /> No one owes anything.
            </p>
          ) : (
            <ol className="mt-2 px-5 sm:px-6">
              {view.transfers.slice(0, 4).map((t, i) => (
                <li key={i} className="board-row flex items-center gap-3 py-2.5 text-[0.92rem]">
                  <span className="w-16 truncate font-medium">{byId.get(t.from)?.name}</span>
                  <LuArrowRight className="size-4 shrink-0 text-paper/45" aria-label="pays" />
                  <span className="flex-1 truncate font-medium">{byId.get(t.to)?.name}</span>
                  <span className="flap font-semibold tabular">{formatMoney(t.amount, cur)}</span>
                </li>
              ))}
            </ol>
          )}
          <a
            href={href({ name: "trip", id: trip.id, tab: "settle" })}
            className="mt-2 flex items-center justify-between border-t border-paper/10 px-5 py-3.5 text-[0.88rem] font-semibold text-signal hover:bg-white/5 sm:px-6"
          >
            {view.settled ? "See payment history" : view.transfers.length > 4 ? `See all ${view.transfers.length} and mark paid` : "Mark payments as paid"}
            <LuArrowRight aria-hidden />
          </a>
        </section>

        <Panel>
          <div className="flex items-baseline justify-between px-5 pt-5 sm:px-6">
            <h2 className="font-display text-[1.35rem] font-medium">Recent</h2>
            <a href={href({ name: "trip", id: trip.id, tab: "expenses" })} className="rounded text-[0.86rem] font-semibold text-forest hover:underline">
              All {trip.expenses.length}
            </a>
          </div>
          <ul className="mt-2 pb-2">
            {recent.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => openExpense(e)}
                  className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-paper-2/50 sm:px-6"
                >
                  <CategoryIcon category={e.category} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.92rem] font-medium">{e.title}</span>
                    <span className="block text-[0.8rem] text-ink-3">
                      {byId.get(e.paidBy)?.name ?? "Removed"} paid, {formatShort(e.date)}
                    </span>
                  </span>
                  <Money value={e.amount} currency={cur} className="text-[0.92rem] font-semibold" />
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value, tone, last }: { label: string; value: string; tone?: "gain" | "owe"; last?: boolean }) {
  return (
    <div className={cx("border-line/70 p-5 sm:p-6 [&:nth-child(2)]:border-r [&:nth-child(4)]:border-r sm:[&:nth-child(3)]:border-r", !last && "lg:border-r", "max-sm:[&:nth-child(-n+3)]:border-b")}>
      <dt className="text-[0.82rem] text-ink-2">{label}</dt>
      <dd className={cx("mt-1.5 text-[1.3rem] font-semibold tracking-[-0.01em] tabular", tone === "gain" ? "text-gain" : tone === "owe" ? "text-owe" : "text-ink")}>
        {value}
      </dd>
    </div>
  );
}
