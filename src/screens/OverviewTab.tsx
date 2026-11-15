import { useMemo, type ReactNode } from "react";
import { LuPlane } from "react-icons/lu";
import { RouteLine } from "../components/Art";
import { useExpenseSheet } from "../components/Layout";
import { Button, Panel, PersonTile, cx } from "../components/ui";
import { computeBalances, settlement, tripTotal } from "../lib/balances";
import { formatRange, timeAgo, tripDays } from "../lib/dates";
import { CURRENCIES, formatMoney } from "../lib/money";
import type { Activity, Trip } from "../lib/types";
import { href, tripHref } from "../state/router";

/** Ümumi məlumat: the trip at a glance. Details, where everyone stands, and what happened lately. */
export function OverviewTab({ trip }: { trip: Trip }) {
  const openSheet = useExpenseSheet();
  const cur = trip.currency;
  const total = tripTotal(trip);
  const balances = useMemo(() => computeBalances(trip), [trip]);
  const pending = useMemo(() => settlement(trip), [trip]);
  const currency = CURRENCIES.find((c) => c.code === cur);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-10">
      <div className="grid content-start gap-8 lg:gap-10">
        <Panel
          title="Səfər haqqında"
          id="about-h"
        >
          <dl className="divide-y divide-line">
            <Row label="İstiqamət">{trip.destination || <span className="text-ink-3">Göstərilməyib</span>}</Row>
            <Row label="Tarixlər">
              {formatRange(trip.startDate, trip.endDate)}
              <span className="text-ink-3">, {tripDays(trip.startDate, trip.endDate)} gün</span>
            </Row>
            <Row label="Valyuta">{currency ? `${currency.name}, ${currency.symbol}` : cur}</Row>
            <Row label="Büdcə">
              {trip.budget ? <Budget spent={total} budget={trip.budget} cur={cur} /> : (
                <a href={href({ name: "edit", id: trip.id })} className="rounded font-medium text-sun-2 underline-offset-4 hover:underline">
                  Büdcə təyin et
                </a>
              )}
            </Row>
          </dl>
        </Panel>

        <Panel
          title="Son fəaliyyət"
          id="act-h"
          footer={
            trip.expenses.length > 0 && (
              <a href={tripHref(trip.id, "expenses")} className="text-[0.88rem] font-semibold text-ink underline-offset-4 hover:underline">
                Bütün xərclərə bax
              </a>
            )
          }
        >
          {trip.activity.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="font-serif text-[1.25rem] font-semibold">Hələ heç nə baş verməyib</p>
              <p className="mt-1 text-[0.92rem] text-ink-2">İlk xərci əlavə edin, burada görünəcək.</p>
              <Button className="mt-5" onClick={() => openSheet()}>
                Xərc əlavə et
              </Button>
            </div>
          ) : (
            <ol className="relative px-6 py-4 before:absolute before:top-7 before:bottom-7 before:left-[31px] before:border-l-2 before:border-dotted before:border-sun-soft">
              {trip.activity.slice(0, 7).map((a) => (
                <ActivityRow key={a.id} a={a} cur={cur} />
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <Panel
        title="İştirakçılar"
        id="people-h"
        aside={`${trip.participants.length} nəfər`}
        className="self-start"
        footer={
          <a href={tripHref(trip.id, "settle")} className="flex items-center justify-between gap-3 text-[0.88rem] font-semibold text-ink">
            <span className="underline-offset-4 hover:underline">
              {trip.expenses.length === 0 ? "Hesablaşmaya keç" : pending.length ? `Kim kimə ödəyir: ${pending.length} ödəniş` : "Hamı hesablaşıb"}
            </span>
          </a>
        }
      >
        <ul className="py-2">
          {trip.participants.map((p) => {
            const b = balances.get(p.id)!;
            return (
              <li key={p.id} className="flex items-center gap-3.5 px-6 py-3">
                <PersonTile name={p.name} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.98rem] font-medium">{p.name}</span>
                  <span className="block text-[0.76rem] text-ink-3 tabular">
                    ödədi {formatMoney(b.paid, cur)}, payı {formatMoney(b.share, cur)}
                  </span>
                </span>
                <span className="text-right">
                  <span className={cx("block text-[0.98rem] font-semibold tabular", b.outstanding > 0 ? "text-gain" : b.outstanding < 0 ? "text-owe" : "text-ink-3")}>
                    {b.outstanding === 0 ? "—" : formatMoney(b.outstanding, cur, { signed: true })}
                  </span>
                  <span className="block text-[0.72rem] text-ink-3">{b.outstanding > 0 ? "alacaq" : b.outstanding < 0 ? "borcludur" : "hesab bağlıdır"}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] items-start gap-4 px-6 py-4 text-[0.95rem] sm:grid-cols-[9rem_1fr]">
      <dt className="text-ink-3">{label}</dt>
      <dd className="min-w-0 font-medium">{children}</dd>
    </div>
  );
}

/** Budget as a route: the plane moves along as money is spent. */
function Budget({ spent, budget, cur }: { spent: number; budget: number; cur: string }) {
  const p = spent / budget;
  const over = spent > budget;
  return (
    <div className="w-full max-w-md">
      <div className="flex items-baseline justify-between gap-3">
        <span className="tabular">
          {formatMoney(spent, cur)} <span className="font-normal text-ink-3">/ {formatMoney(budget, cur)}</span>
        </span>
        <span className={cx("text-[0.84rem] font-semibold", over ? "text-owe" : "text-ink-2")}>
          {over ? `${formatMoney(spent - budget, cur)} aşılıb` : `${formatMoney(budget - spent, cur)} qalıb`}
        </span>
      </div>
      <div
        className="relative mt-3 h-9"
        role="progressbar"
        aria-label="Büdcənin istifadəsi"
        aria-valuenow={Math.min(100, Math.round(p * 100))}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <RouteLine progress={Math.min(1, p)} className="h-9 text-ink/30" />
        <LuPlane
          aria-hidden
          className={cx("absolute top-[-2px] size-5 -translate-x-1/2 rotate-[12deg] transition-[left] duration-700", over ? "text-owe" : "text-ink")}
          style={{ left: `${Math.min(97, Math.max(3, p * 100))}%` }}
        />
      </div>
    </div>
  );
}

const ACTIVITY: Record<Activity["kind"], (t: string) => string> = {
  add: (t) => `«${t}» əlavə edildi`,
  edit: (t) => `«${t}» dəyişdirildi`,
  delete: (t) => `«${t}» silindi`,
  paid: (t) => `Ödəniş edildi: ${t}`,
  undo: (t) => `Ödəniş geri alındı: ${t}`,
  trip: () => "Səfər məlumatları yeniləndi",
};

function ActivityRow({ a, cur }: { a: Activity; cur: string }) {
  const dot = a.kind === "paid" ? "bg-gain" : a.kind === "delete" || a.kind === "undo" ? "bg-owe" : a.kind === "trip" ? "bg-ink" : "bg-sun";
  return (
    <li className="relative flex items-start gap-4 py-2.5">
      <span className={cx("relative z-10 mt-1.5 size-3 shrink-0 rounded-full ring-4 ring-white", dot)} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-[0.93rem] leading-snug">{ACTIVITY[a.kind](a.title)}</span>
        <span className="block text-[0.76rem] text-ink-3">{timeAgo(a.at)}</span>
      </span>
      {a.amount !== undefined && (
        <span className={cx("pt-0.5 text-[0.9rem] font-medium tabular", a.kind === "delete" ? "text-ink-3 line-through" : "text-ink-2")}>{formatMoney(a.amount, cur)}</span>
      )}
    </li>
  );
}
