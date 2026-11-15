import { useMemo } from "react";
import { LuArrowRight, LuCheck, LuDownload, LuPartyPopper, LuPlus, LuPrinter, LuUndo2 } from "react-icons/lu";
import { SectionTitle, useExpenseSheet } from "../components/Layout";
import { useToast } from "../components/Toast";
import { Button, Panel, PersonTile, StatusPill, Tile, cx } from "../components/ui";
import { computeBalances, settlement } from "../lib/balances";
import { formatMoney } from "../lib/money";
import { downloadText, fileSlug, insights, tripCSV } from "../lib/report";
import { uid } from "../lib/storage";
import type { Trip } from "../lib/types";
import { useStore } from "../state/store";

export function SettlePage({ trip }: { trip: Trip }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const openSheet = useExpenseSheet();
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
      sub="Kim kimə nə qədər ödəməlidir. Köçürmələrin sayı mümkün qədər azaldılıb."
      actions={
        trip.expenses.length > 0 && (
          <>
            <Button
              variant="soft"
              icon={<LuDownload className="size-4" aria-hidden />}
              onClick={() => {
                downloadText(`tripmate-${fileSlug(trip.name)}.csv`, tripCSV(trip));
                toast.show("Hesabat CSV faylı kimi yükləndi");
              }}
            >
              CSV yüklə
            </Button>
            <Button variant="dark" icon={<LuPrinter className="size-4" aria-hidden />} onClick={() => window.print()}>
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
            <Tile size={64}>
              <LuArrowRight className="size-7" />
            </Tile>
            <h2 className="mt-5 text-[1.15rem] font-semibold">Hesablanacaq heç nə yoxdur</h2>
            <p className="mt-1.5 max-w-sm text-[0.92rem] text-ink-2">Xərc əlavə edən kimi kimin kimə nə qədər ödəməli olduğu burada görünəcək.</p>
            <Button className="mt-6" icon={<LuPlus aria-hidden />} onClick={() => openSheet()}>
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

      {/* One calm line: what's left, what's done */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-[22px] bg-sun px-6 py-4">
        <p className="text-[0.95rem]">
          {done ? (
            <span className="font-semibold">Bütün ödənişlər edilib</span>
          ) : (
            <>
              Ödənilməli qalıb: <b className="font-semibold tabular">{formatMoney(outstanding, cur)}</b>
            </>
          )}
          {paidTotal > 0 && <span className="text-ink/70">, artıq ödənilib: {formatMoney(paidTotal, cur)}</span>}
        </p>
        <div className="h-2 min-w-[160px] flex-1 overflow-hidden rounded-full bg-ink/15" role="progressbar" aria-label="Hesablaşmanın gedişatı" aria-valuenow={all ? Math.round((paidTotal / all) * 100) : 100} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${all ? (paidTotal / all) * 100 : 100}%` }} />
        </div>
      </div>

      {done && (
        <div className="mt-6 flex items-center gap-4 rounded-[24px] bg-white px-6 py-5 shadow-[0_8px_28px_-14px_rgb(80_50_10/0.16)]">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sun text-ink">
            <LuPartyPopper className="size-6" aria-hidden />
          </span>
          <div>
            <p className="text-[1.05rem] font-semibold">Hamı hesablaşıb</p>
            <p className="text-[0.9rem] text-ink-2">Heç kim heç kimə borclu deyil. Yaxşı səfər idi!</p>
          </div>
        </div>
      )}

      <Panel title="Kim kimə ödəyir" id="pay-h" aside={done ? "hamısı ödənilib" : `${pending.length} ödəniş gözləyir`} className="mt-6">
        <table className="w-full text-left">
          <thead className="max-md:hidden">
            <tr className="border-b border-line text-[0.76rem] text-ink-3">
              <th scope="col" className="py-3 pl-6 font-medium">Ödəyən</th>
              <th scope="col" className="py-3 font-medium">Alan</th>
              <th scope="col" className="py-3 text-right font-medium">Məbləğ</th>
              <th scope="col" className="py-3 pl-8 font-medium">Vəziyyət</th>
              <th scope="col" className="py-3 pr-6">
                <span className="sr-only">Əməliyyat</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pending.map((t) => (
              <tr key={`p-${t.from}-${t.to}`} className="border-b border-line transition-colors hover:bg-cream-2/60 max-md:grid max-md:grid-cols-[1fr_auto] max-md:gap-y-2 max-md:px-4 max-md:py-3.5">
                <td className="py-4 pl-6 max-md:p-0">
                  <span className="flex items-center gap-3">
                    <PersonTile name={name(t.from)} size={38} />
                    <span className="text-[0.98rem] font-semibold">{name(t.from)}</span>
                    <LuArrowRight className="size-4 text-sun-2 md:hidden" aria-hidden />
                    <span className="text-[0.98rem] font-medium md:hidden">{name(t.to)}</span>
                  </span>
                </td>
                <td className="py-4 max-md:hidden">
                  <span className="flex items-center gap-3">
                    <LuArrowRight className="size-4 text-sun-2" aria-hidden />
                    <PersonTile name={name(t.to)} size={38} />
                    <span className="text-[0.98rem] font-medium">{name(t.to)}</span>
                  </span>
                </td>
                <td className="py-4 text-right text-[1.08rem] font-bold whitespace-nowrap tabular max-md:self-center max-md:p-0">{formatMoney(t.amount, cur)}</td>
                <td className="py-4 pl-8 max-md:p-0">
                  <StatusPill paid={false} />
                </td>
                <td className="py-4 pr-6 text-right max-md:p-0">
                  <Button
                    size="md"
                    variant="sun"
                    icon={<LuCheck className="size-4" aria-hidden />}
                    className="h-9 px-4 text-[0.84rem]"
                    aria-label={`Ödənildi kimi qeyd et: ${name(t.from)} → ${name(t.to)}, ${formatMoney(t.amount, cur)}`}
                    onClick={() => {
                      dispatch({ type: "payment/add", tripId: trip.id, payment: { id: uid("o-"), ...t, createdAt: Date.now() } });
                      toast.show(`${name(t.from)} → ${name(t.to)}: ödənildi kimi qeyd olundu`);
                    }}
                  >
                    Ödənildi
                  </Button>
                </td>
              </tr>
            ))}
            {[...trip.payments].reverse().map((p) => (
              <tr key={p.id} className="border-b border-line text-ink-2 max-md:grid max-md:grid-cols-[1fr_auto] max-md:gap-y-2 max-md:px-4 max-md:py-3.5">
                <td className="py-4 pl-6 max-md:p-0">
                  <span className="flex items-center gap-3 opacity-70">
                    <PersonTile name={name(p.from)} size={38} />
                    <span className="text-[0.98rem] font-medium line-through decoration-ink-3/60">{name(p.from)}</span>
                    <LuArrowRight className="size-4 md:hidden" aria-hidden />
                    <span className="text-[0.98rem] md:hidden">{name(p.to)}</span>
                  </span>
                </td>
                <td className="py-4 max-md:hidden">
                  <span className="flex items-center gap-3 opacity-70">
                    <LuArrowRight className="size-4" aria-hidden />
                    <PersonTile name={name(p.to)} size={38} />
                    <span className="text-[0.98rem]">{name(p.to)}</span>
                  </span>
                </td>
                <td className="py-4 text-right text-[1.02rem] font-semibold whitespace-nowrap tabular max-md:self-center max-md:p-0">{formatMoney(p.amount, cur)}</td>
                <td className="py-4 pl-8 max-md:p-0">
                  <StatusPill paid />
                </td>
                <td className="py-4 pr-6 text-right max-md:p-0">
                  <Button
                    variant="ghost"
                    icon={<LuUndo2 className="size-4" aria-hidden />}
                    className="h-9 px-3 text-[0.84rem]"
                    aria-label={`${name(p.from)} → ${name(p.to)} ödənişini geri al`}
                    onClick={() => {
                      dispatch({ type: "payment/remove", tripId: trip.id, id: p.id });
                      toast.show("Ödəniş geri alındı");
                    }}
                  >
                    Geri al
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="Balanslar" id="bal-h" aside="ödədiyi − payı">
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
                    <td className="py-3 pl-6">
                      <span className="flex items-center gap-3">
                        <PersonTile name={p.name} size={34} />
                        <span className="text-[0.92rem] font-medium">{p.name}</span>
                      </span>
                    </td>
                    <td className="py-3 text-right text-[0.88rem] text-ink-2 tabular max-sm:hidden">{formatMoney(b.paid, cur)}</td>
                    <td className="py-3 text-right text-[0.88rem] text-ink-2 tabular max-sm:hidden">{formatMoney(b.share, cur)}</td>
                    <td className="py-3 pr-6 text-right">
                      <span className={cx("block text-[0.95rem] font-semibold tabular", b.outstanding === 0 ? "text-ink-3" : b.net > 0 ? "text-gain" : "text-owe")}>{formatMoney(b.net, cur, { signed: true })}</span>
                      <span className="block text-[0.72rem] text-ink-3">
                        {b.net === 0 ? "bərabər" : b.outstanding === 0 ? "hesab bağlanıb" : b.net > 0 ? "alacaq" : "borcludur"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <Panel title="Səfərin xülasəsi" id="sum-h" className="self-start">
          <ul className="space-y-3 px-6 py-5">
            {notes.map((n) => (
              <li key={n} className="flex gap-3 text-[0.9rem] leading-relaxed text-ink-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-sun-2" aria-hidden />
                {n}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
