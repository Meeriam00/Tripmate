import { useMemo, type ReactNode } from "react";
import { LuCheck, LuChevronRight, LuPencil, LuPlus, LuSettings2, LuTrash2, LuUndo2 } from "react-icons/lu";
import { useExpenseSheet } from "../components/Layout";
import { Button, Panel, PersonTile, cx } from "../components/ui";
import { computeBalances, settlement, tripTotal } from "../lib/balances";
import { CURRENCIES, formatMoney } from "../lib/money";
import { formatRange, timeAgo, tripDays } from "../lib/dates";
import type { Activity, Trip } from "../lib/types";
import { href, tripHref } from "../state/router";

/** Ümumi məlumat: the trip at a glance. Details, recent activity, and where everyone stands. */
export function OverviewTab({ trip }: { trip: Trip }) {
  const openSheet = useExpenseSheet();
  const cur = trip.currency;
  const total = tripTotal(trip);
  const balances = useMemo(() => computeBalances(trip), [trip]);
  const pending = useMemo(() => settlement(trip), [trip]);
  const currency = CURRENCIES.find((c) => c.code === cur);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-8">
      <div className="grid content-start gap-6 lg:gap-8">
        <Panel
          title="Səfər haqqında"
          id="about-h"
          aside={
            <a href={href({ name: "edit", id: trip.id })} className="inline-flex items-center gap-1.5 rounded font-semibold text-ink hover:text-sun-2">
              <LuPencil className="size-3.5" aria-hidden /> Düzəlt
            </a>
          }
        >
          <dl className="divide-y divide-line">
            <Row label="İstiqamət">{trip.destination || <span className="text-ink-3">Göstərilməyib</span>}</Row>
            <Row label="Tarixlər">
              {formatRange(trip.startDate, trip.endDate)}
              <span className="text-ink-3">, {tripDays(trip.startDate, trip.endDate)} gün</span>
            </Row>
            <Row label="Valyuta">{currency ? `${currency.name} (${currency.symbol})` : cur}</Row>
            <Row label="Büdcə">
              {trip.budget ? (
                <div className="w-full max-w-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="tabular">
                      {formatMoney(total, cur)} <span className="text-ink-3">/ {formatMoney(trip.budget, cur)}</span>
                    </span>
                    <span className={cx("text-[0.82rem] font-semibold", total > trip.budget ? "text-owe" : "text-ink-2")}>
                      {total > trip.budget ? `${formatMoney(total - trip.budget, cur)} aşılıb` : `${formatMoney(trip.budget - total, cur)} qalıb`}
                    </span>
                  </div>
                  <div
                    className="mt-2 h-2 overflow-hidden rounded-full bg-mist"
                    role="progressbar"
                    aria-label="Büdcənin istifadəsi"
                    aria-valuenow={Math.min(100, Math.round((total / trip.budget) * 100))}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className={cx("h-full rounded-full", total > trip.budget ? "bg-owe" : "bg-sun")} style={{ width: `${Math.min(100, (total / trip.budget) * 100)}%` }} />
                  </div>
                </div>
              ) : (
                <a href={href({ name: "edit", id: trip.id })} className="rounded font-medium text-sun-2 hover:text-ink">
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
              <a href={tripHref(trip.id, "expenses")} className="flex items-center justify-between text-[0.88rem] font-semibold text-ink hover:text-sun-2">
                Bütün xərclər <LuChevronRight className="size-4" aria-hidden />
              </a>
            )
          }
        >
          {trip.activity.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="font-semibold">Hələ heç nə baş verməyib</p>
              <p className="mt-1 text-[0.9rem] text-ink-2">İlk xərci əlavə edin, burada görünəcək.</p>
              <Button className="mt-5" icon={<LuPlus aria-hidden />} onClick={() => openSheet()}>
                Xərc əlavə et
              </Button>
            </div>
          ) : (
            <ol className="py-2">
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
          <a href={tripHref(trip.id, "settle")} className="flex items-center justify-between gap-3 text-[0.88rem] font-semibold text-ink hover:text-sun-2">
            <span>{trip.expenses.length === 0 ? "Hesablaşma" : pending.length ? `Kim kimə ödəyir: ${pending.length} ödəniş` : "Hamı hesablaşıb"}</span>
            <LuChevronRight className="size-4" aria-hidden />
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
                  <span className="block truncate text-[0.95rem] font-medium">{p.name}</span>
                  <span className="block text-[0.76rem] text-ink-3 tabular">
                    ödədi {formatMoney(b.paid, cur)}, payı {formatMoney(b.share, cur)}
                  </span>
                </span>
                <span
                  className={cx(
                    "rounded-full px-3 py-1 text-[0.8rem] font-semibold whitespace-nowrap tabular",
                    b.outstanding > 0 ? "bg-gain/10 text-gain" : b.outstanding < 0 ? "bg-owe/10 text-owe" : "bg-mist text-ink-3",
                  )}
                  title={b.outstanding > 0 ? "alacaq" : b.outstanding < 0 ? "borcludur" : "hesab bağlıdır"}
                >
                  {b.outstanding === 0 ? "hesab bağlıdır" : `${formatMoney(b.outstanding, cur, { signed: true })} ${b.outstanding > 0 ? "alacaq" : "borclu"}`}
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
    <div className="grid grid-cols-[7.5rem_1fr] items-start gap-4 px-6 py-4 text-[0.94rem] sm:grid-cols-[9rem_1fr]">
      <dt className="text-ink-3">{label}</dt>
      <dd className="min-w-0 font-medium">{children}</dd>
    </div>
  );
}

const ACTIVITY = {
  add: { Icon: LuPlus, text: (t: string) => `«${t}» əlavə edildi` },
  edit: { Icon: LuPencil, text: (t: string) => `«${t}» dəyişdirildi` },
  delete: { Icon: LuTrash2, text: (t: string) => `«${t}» silindi` },
  paid: { Icon: LuCheck, text: (t: string) => `Ödəniş edildi: ${t}` },
  undo: { Icon: LuUndo2, text: (t: string) => `Ödəniş geri alındı: ${t}` },
  trip: { Icon: LuSettings2, text: () => "Səfər məlumatları yeniləndi" },
} as const;

function ActivityRow({ a, cur }: { a: Activity; cur: string }) {
  const { Icon, text } = ACTIVITY[a.kind];
  return (
    <li className="flex items-center gap-3.5 px-6 py-2.5">
      <span
        className={cx(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-full",
          a.kind === "paid" ? "bg-gain/10 text-gain" : a.kind === "delete" || a.kind === "undo" ? "bg-owe/10 text-owe" : "bg-cream-2 text-ink ring-2 ring-sun-soft",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9rem]">{text(a.title)}</span>
        <span className="block text-[0.75rem] text-ink-3">{timeAgo(a.at)}</span>
      </span>
      {a.amount !== undefined && <span className={cx("text-[0.88rem] font-medium tabular", a.kind === "delete" ? "text-ink-3 line-through" : "text-ink-2")}>{formatMoney(a.amount, cur)}</span>}
    </li>
  );
}
