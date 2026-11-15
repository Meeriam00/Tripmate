import { useMemo, useState } from "react";
import { LuArrowRight, LuUndo2 } from "react-icons/lu";
import { Stamp } from "../components/Art";
import { SectionTitle, useExpenseSheet } from "../components/Layout";
import { useToast } from "../components/Toast";
import { Button, IconButton, Panel, cx } from "../components/ui";
import { computeBalances, settlement } from "../lib/balances";
import { formatMoney } from "../lib/money";
import { downloadText, fileSlug, insights, tripCSV } from "../lib/report";
import { uid } from "../lib/storage";
import type { Trip } from "../lib/types";
import { useStore } from "../state/store";

/** Hesablaşma: who pays whom, how much, and what's already been paid. */
export function SettlePage({ trip }: { trip: Trip }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const openSheet = useExpenseSheet();
  const [justPaid, setJustPaid] = useState<string | null>(null);
  const cur = trip.currency;
  const balances = useMemo(() => computeBalances(trip), [trip]);
  const pending = useMemo(() => settlement(trip), [trip]);
  const notes = useMemo(() => insights(trip), [trip]);
  const name = (id: string) => trip.participants.find((p) => p.id === id)?.name ?? "Silinmiş şəxs";
  const outstanding = pending.reduce((s, t) => s + t.amount, 0);
  const paidTotal = trip.payments.reduce((s, p) => s + p.amount, 0);
  const all = outstanding + paidTotal;
  const done = pending.length === 0;

  const header = (
    <SectionTitle
      title="Hesablaşma"
      sub="Kim kimə nə qədər ödəməlidir. Köçürmələrin sayı mümkün qədər azdır."
      actions={
        trip.expenses.length > 0 && (
          <>
            <Button
              variant="soft"
              onClick={() => {
                downloadText(`tripmate-${fileSlug(trip.name)}.csv`, tripCSV(trip));
                toast.show("Hesabat CSV faylı kimi yükləndi");
              }}
            >
              CSV yüklə
            </Button>
            <Button variant="dark" onClick={() => window.print()}>
              PDF hesabat
            </Button>
          </>
        )
      }
    />
  );

  if (trip.expenses.length === 0) {
    return (
      <>
        {header}
        <Panel>
          <div className="flex flex-col items-center px-8 py-20 text-center">
            <h2 className="font-serif text-[1.6rem] font-semibold">Hesablanacaq heç nə yoxdur</h2>
            <p className="mt-2 max-w-sm text-[0.95rem] text-ink-2">Xərc əlavə edən kimi kimin kimə nə qədər ödəməli olduğu burada görünəcək.</p>
            <Button className="mt-6" onClick={() => openSheet()}>
              Xərc əlavə et
            </Button>
          </div>
        </Panel>
      </>
    );
  }

  return (
    <>
      {header}

      {/* Progress: what's left, what's done */}
      <div className="grain flex flex-wrap items-center gap-x-8 gap-y-3 overflow-hidden rounded-[22px] bg-sun px-6 py-4">
        <p className="text-[0.98rem]">
          {done ? (
            <span className="font-semibold">Bütün ödənişlər edilib</span>
          ) : (
            <>
              Ödənilməli qalıb <b className="ml-1 font-semibold tabular">{formatMoney(outstanding, cur)}</b>
            </>
          )}
          {paidTotal > 0 && <span className="text-ink/70">, artıq ödənilib {formatMoney(paidTotal, cur)}</span>}
        </p>
        <div className="h-2 min-w-[160px] flex-1 overflow-hidden rounded-full bg-ink/15" role="progressbar" aria-label="Hesablaşmanın gedişatı" aria-valuenow={all ? Math.round((paidTotal / all) * 100) : 100} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${all ? (paidTotal / all) * 100 : 100}%` }} />
        </div>
      </div>

      {done && (
        <div className="mt-8 flex flex-wrap items-center gap-6 rounded-[24px] border-2 border-dashed border-gain/40 bg-white px-7 py-6">
          <Stamp tone="gain" className="stamp-in -rotate-6 px-5 py-2 text-[0.95rem]">
            Hamı hesablaşıb
          </Stamp>
          <p className="font-serif text-[1.15rem] text-ink-2 italic">Heç kim heç kimə borclu deyil. Yaxşı səfər idi!</p>
        </div>
      )}

      <Panel title="Kim kimə ödəyir" id="pay-h" aside={done ? "hamısı ödənilib" : `${pending.length} ödəniş gözləyir`} className="mt-8">
        <table className="w-full text-left">
          <thead className="max-md:hidden">
            <tr className="border-b border-line text-[0.76rem] text-ink-3">
              <th scope="col" className="py-3 pl-6 font-medium">Ödəyən</th>
              <th scope="col" className="py-3 font-medium">Alan</th>
              <th scope="col" className="py-3 text-right font-medium">Məbləğ</th>
              <th scope="col" className="py-3 pl-10 font-medium">Vəziyyət</th>
              <th scope="col" className="py-3 pr-6">
                <span className="sr-only">Əməliyyat</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pending.map((t) => (
              <tr key={`p-${t.from}-${t.to}`} className="border-b border-line transition-colors hover:bg-cream-2/60 max-md:grid max-md:grid-cols-[1fr_auto] max-md:items-center max-md:gap-y-2 max-md:px-5 max-md:py-4">
                <td className="py-5 pl-6 text-[1.02rem] font-semibold max-md:p-0">
                  {name(t.from)}
                  <span className="font-normal md:hidden">
                    <LuArrowRight className="mx-2 inline size-4 text-sun-2" aria-label="ödəyir" />
                    {name(t.to)}
                  </span>
                </td>
                <td className="py-5 text-[1.02rem] max-md:hidden">
                  <span className="inline-flex items-center gap-3">
                    <LuArrowRight className="size-4 text-sun-2" aria-hidden />
                    {name(t.to)}
                  </span>
                </td>
                <td className="py-5 text-right text-[1.12rem] font-bold whitespace-nowrap tabular max-md:p-0">{formatMoney(t.amount, cur)}</td>
                <td className="py-5 pl-10 text-[0.86rem] font-medium text-sun-2 max-md:p-0">Ödənilməyib</td>
                <td className="py-5 pr-6 text-right max-md:p-0">
                  <Button
                    className="h-9 px-5 text-[0.86rem]"
                    aria-label={`Ödənildi kimi qeyd et: ${name(t.from)} → ${name(t.to)}, ${formatMoney(t.amount, cur)}`}
                    onClick={() => {
                      const id = uid("o-");
                      dispatch({ type: "payment/add", tripId: trip.id, payment: { id, ...t, createdAt: Date.now() } });
                      setJustPaid(id);
                      toast.show(`${name(t.from)} → ${name(t.to)}: ödənildi`);
                    }}
                  >
                    Ödənildi
                  </Button>
                </td>
              </tr>
            ))}
            {[...trip.payments].reverse().map((p) => (
              <tr key={p.id} className="border-b border-line last:border-b-0 max-md:grid max-md:grid-cols-[1fr_auto] max-md:items-center max-md:gap-y-2 max-md:px-5 max-md:py-4">
                <td className="py-4 pl-6 text-[1.02rem] text-ink-3 max-md:p-0">
                  {name(p.from)}
                  <span className="md:hidden">
                    <LuArrowRight className="mx-2 inline size-4" aria-label="ödəyib" />
                    {name(p.to)}
                  </span>
                </td>
                <td className="py-4 text-[1.02rem] text-ink-3 max-md:hidden">
                  <span className="inline-flex items-center gap-3">
                    <LuArrowRight className="size-4" aria-hidden />
                    {name(p.to)}
                  </span>
                </td>
                <td className="py-4 text-right text-[1.05rem] font-semibold whitespace-nowrap text-ink-3 tabular max-md:p-0">{formatMoney(p.amount, cur)}</td>
                <td className="py-4 pl-10 max-md:p-0">
                  <Stamp tone="gain" className={cx("-rotate-6", justPaid === p.id && "stamp-in")}>
                    Ödənilib
                  </Stamp>
                </td>
                <td className="py-4 pr-6 text-right max-md:p-0">
                  <IconButton
                    label={`${name(p.from)} → ${name(p.to)} ödənişini geri al`}
                    tip="Geri al"
                    className="text-ink-3 hover:text-ink"
                    onClick={() => {
                      dispatch({ type: "payment/remove", tripId: trip.id, id: p.id });
                      toast.show("Ödəniş geri alındı");
                    }}
                  >
                    <LuUndo2 className="size-[18px]" aria-hidden />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="Balanslar" id="bal-h" aside="ödədiyi − payı" className="self-start">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line text-[0.76rem] text-ink-3">
                <th scope="col" className="py-3 pl-6 font-medium">Ad</th>
                <th scope="col" className="py-3 text-right font-medium max-sm:hidden">Ödədi</th>
                <th scope="col" className="py-3 text-right font-medium max-sm:hidden">Payı</th>
                <th scope="col" className="py-3 pr-6 text-right font-medium">Balans</th>
              </tr>
            </thead>
            <tbody>
              {trip.participants.map((p) => {
                const b = balances.get(p.id)!;
                return (
                  <tr key={p.id} className="border-b border-line last:border-b-0">
                    <td className="py-3.5 pl-6 text-[0.95rem] font-medium">{p.name}</td>
                    <td className="py-3.5 text-right text-[0.9rem] text-ink-2 tabular max-sm:hidden">{formatMoney(b.paid, cur)}</td>
                    <td className="py-3.5 text-right text-[0.9rem] text-ink-2 tabular max-sm:hidden">{formatMoney(b.share, cur)}</td>
                    <td className="py-3.5 pr-6 text-right">
                      <span className={cx("block text-[0.98rem] font-semibold tabular", b.outstanding === 0 ? "text-ink-3" : b.net > 0 ? "text-gain" : "text-owe")}>
                        {formatMoney(b.net, cur, { signed: true })}
                      </span>
                      <span className="block text-[0.72rem] text-ink-3">
                        {b.net === 0
                          ? "bərabər"
                          : b.outstanding === 0
                            ? "hesab bağlanıb"
                            : b.outstanding !== b.net
                              ? `${formatMoney(Math.abs(b.outstanding), cur)} ${b.outstanding > 0 ? "alacağı" : "borcu"} qalıb`
                              : b.net > 0
                                ? "alacaq"
                                : "borcludur"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <section aria-labelledby="sum-h" className="grain self-start overflow-hidden rounded-[24px] border border-sun-soft bg-cream px-7 py-7">
          <h2 id="sum-h" className="font-serif text-[1.35rem] font-semibold">
            Səfərin xülasəsi
          </h2>
          <ul className="mt-4 space-y-3.5">
            {notes.map((n) => (
              <li key={n} className="border-l-2 border-sun pl-4 font-serif text-[1.02rem] leading-relaxed text-ink">
                {n}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
