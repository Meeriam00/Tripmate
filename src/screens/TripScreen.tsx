import { useMemo, useState } from "react";
import { LuArrowLeft, LuArrowRight, LuArrowRightLeft, LuPlus, LuReceipt, LuSettings2 } from "react-icons/lu";
import { AppBar, Shell } from "../components/Shell";
import { useToast } from "../components/Toast";
import { Button, PersonTile, SectionHead, Tile, cx } from "../components/ui";
import { computeBalances, settlement, tripTotal } from "../lib/balances";
import { formatMoney } from "../lib/money";
import type { Expense, Trip } from "../lib/types";
import { href } from "../state/router";
import { useStore } from "../state/store";
import { ExpenseSheet } from "./ExpenseSheet";
import { NotFound } from "./NotFound";

export function TripScreen({ id, tab }: { id: string; tab: "expenses" | "settle" }) {
  const { getTrip, dispatch } = useStore();
  const toast = useToast();
  const trip = getTrip(id);
  const [sheet, setSheet] = useState<{ open: boolean; expense?: Expense; n: number }>({ open: false, n: 0 });

  if (!trip) return <NotFound what="trip" />;
  const open = (expense?: Expense) => setSheet((s) => ({ open: true, expense, n: s.n + 1 }));

  return (
    <Shell
      top={
        <AppBar
          left={
            <a href={href({ name: "home" })} aria-label="Səyahətlərə qayıt" className="inline-flex size-10 items-center justify-center rounded-full hover:bg-ink/[0.06]">
              <LuArrowLeft className="size-5" aria-hidden />
            </a>
          }
          title={trip.name}
          sub={trip.destination || undefined}
          right={
            <a href={href({ name: "edit", id: trip.id })} aria-label="Səyahət ayarları" title="Səyahət ayarları" className="inline-flex size-10 items-center justify-center rounded-full hover:bg-ink/[0.06]">
              <LuSettings2 className="size-5" aria-hidden />
            </a>
          }
        />
      }
      bar={<BottomBar trip={trip} tab={tab} onAdd={() => open()} />}
    >
      <Summary trip={trip} />
      {tab === "expenses" ? <ExpenseList trip={trip} onOpen={open} /> : <Settlement trip={trip} onAdd={() => open()} />}

      <ExpenseSheet
        key={sheet.n}
        trip={trip}
        open={sheet.open}
        expense={sheet.expense}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
        onSave={(e, isNew) => {
          dispatch({ type: "expense/save", tripId: trip.id, expense: e });
          setSheet((s) => ({ ...s, open: false }));
          toast.show(isNew ? "Xərc əlavə edildi" : "Dəyişikliklər yadda saxlanıldı");
        }}
        onDelete={(e) => {
          dispatch({ type: "expense/delete", tripId: trip.id, id: e.id });
          setSheet((s) => ({ ...s, open: false }));
          toast.show("Xərc silindi");
        }}
      />
    </Shell>
  );
}

/** The reference's orange pill: three figures split by thin rules. */
function Summary({ trip }: { trip: Trip }) {
  const items = [
    { label: "Ümumi xərc", value: formatMoney(tripTotal(trip), trip.currency) },
    { label: "Xərclər", value: String(trip.expenses.length) },
    { label: "Nəfər", value: String(trip.participants.length) },
  ];
  return (
    <div className="px-5 pt-6 sm:px-7">
      <dl className="grid grid-cols-[1.5fr_1fr_1fr] rounded-[22px] bg-sun py-3.5">
        {items.map((it, i) => (
          <div key={it.label} className={cx("flex flex-col items-center justify-center px-2 text-center", i > 0 && "border-l-2 border-ink/80")}>
            <dt className="text-[0.82rem] text-ink/80">{it.label}</dt>
            <dd className="text-[1.02rem] font-semibold text-ink tabular sm:text-[1.1rem]">{it.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ExpenseList({ trip, onOpen }: { trip: Trip; onOpen: (e: Expense) => void }) {
  const byId = new Map(trip.participants.map((p) => [p.id, p]));
  const list = [...trip.expenses].sort((a, b) => b.createdAt - a.createdAt);

  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center px-8 py-16 text-center">
        <Tile size={64}>
          <LuReceipt className="size-7" />
        </Tile>
        <h2 className="mt-5 text-[1.15rem] font-semibold">Hələ xərc yoxdur</h2>
        <p className="mt-1.5 max-w-xs text-[0.92rem] text-ink-2">Kimsə nəyəsə pul ödəyəndə, aşağıdakı + düyməsi ilə onu buraya əlavə edin.</p>
      </div>
    );
  }

  return (
    <section aria-labelledby="xh">
      <SectionHead id="xh" title="Bütün xərclər" aside={`Cəmi: ${formatMoney(tripTotal(trip), trip.currency)}`} />
      <ul>
        {list.map((e) => {
          const payer = byId.get(e.paidBy)?.name ?? "Silinmiş şəxs";
          const everyone = e.participantIds.length === trip.participants.length;
          return (
            <li key={e.id} className="border-b border-line">
              <button onClick={() => onOpen(e)} className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-cream-2/60 sm:px-7" aria-label={`${e.title}, ${formatMoney(e.amount, trip.currency)}. Düzəltmək üçün açın`}>
                <PersonTile name={payer} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[1rem] font-medium text-ink">{e.title}</span>
                  <span className="block truncate text-[0.78rem] text-ink-3">
                    Ödədi: {payer}  |  {everyone ? "hamı arasında" : `${e.participantIds.length} nəfər arasında`}
                  </span>
                </span>
                <span className="text-[1rem] text-ink-2 tabular">{formatMoney(e.amount, trip.currency)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Settlement({ trip, onAdd }: { trip: Trip; onAdd: () => void }) {
  const balances = useMemo(() => computeBalances(trip), [trip]);
  const transfers = useMemo(() => settlement(trip), [trip]);
  const name = (id: string) => trip.participants.find((p) => p.id === id)?.name ?? "Silinmiş şəxs";
  const cur = trip.currency;

  if (trip.expenses.length === 0) {
    return (
      <div className="flex flex-col items-center px-8 py-16 text-center">
        <Tile size={64}>
          <LuArrowRightLeft className="size-7" />
        </Tile>
        <h2 className="mt-5 text-[1.15rem] font-semibold">Hesablanacaq heç nə yoxdur</h2>
        <p className="mt-1.5 max-w-xs text-[0.92rem] text-ink-2">Xərc əlavə edən kimi kimin kimə nə qədər ödəməli olduğu burada görünəcək.</p>
        <Button className="mt-6" icon={<LuPlus aria-hidden />} onClick={onAdd}>
          Xərc əlavə et
        </Button>
      </div>
    );
  }

  return (
    <>
      <section aria-labelledby="sh">
        <SectionHead
          id="sh"
          title="Kim kimə ödəyir"
          aside={transfers.length ? `${transfers.length} köçürmə` : undefined}
        />
        {transfers.length === 0 ? (
          <p className="px-5 py-8 text-center text-[0.95rem] text-ink-2 sm:px-7">Hamı bərabərdir — heç kim heç kimə borclu deyil.</p>
        ) : (
          <table className="w-full table-fixed text-left">
            <thead>
              <tr className="text-[0.75rem] text-ink-3">
                <th scope="col" className="w-[38%] py-2.5 pl-5 font-medium sm:pl-7">Ödəyən</th>
                <th scope="col" className="w-[36%] py-2.5 font-medium">Alan</th>
                <th scope="col" className="py-2.5 pr-5 text-right font-medium sm:pr-7">Məbləğ</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={`${t.from}-${t.to}`} className="border-t border-line">
                  <td className="py-4 pl-5 sm:pl-7">
                    <span className="flex min-w-0 items-center gap-3">
                      <PersonTile name={name(t.from)} size={38} />
                      <span className="truncate text-[0.98rem] font-semibold">{name(t.from)}</span>
                    </span>
                  </td>
                  <td className="py-4">
                    <span className="flex min-w-0 items-center gap-2">
                      <LuArrowRight className="size-4 shrink-0 text-sun-2" aria-hidden />
                      <span className="truncate text-[0.98rem] font-medium">{name(t.to)}</span>
                    </span>
                  </td>
                  <td className="py-4 pr-5 text-right text-[1.02rem] font-bold whitespace-nowrap tabular sm:pr-7">{formatMoney(t.amount, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="bh" className="mt-6">
        <SectionHead id="bh" title="Balanslar" aside="ödədiyi − payı" />
        <ul>
          {trip.participants.map((p) => {
            const b = balances.get(p.id)!;
            return (
              <li key={p.id} className="flex items-center gap-4 border-b border-line px-5 py-3.5 sm:px-7">
                <PersonTile name={p.name} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.95rem] font-medium">{p.name}</span>
                  <span className="block truncate text-[0.76rem] text-ink-3 tabular">
                    Ödədi {formatMoney(b.paid, cur)}  |  Payı {formatMoney(b.share, cur)}
                  </span>
                </span>
                <span className="text-right">
                  <span className={cx("block text-[0.98rem] font-semibold tabular", b.net > 0 ? "text-gain" : b.net < 0 ? "text-owe" : "text-ink-3")}>
                    {formatMoney(b.net, cur, { signed: true })}
                  </span>
                  <span className="block text-[0.74rem] text-ink-3">{b.net > 0 ? "alacaq" : b.net < 0 ? "borcludur" : "bərabər"}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

/** The reference's bottom bar: two tabs and a raised orange "+" in the middle. */
function BottomBar({ trip, tab, onAdd }: { trip: Trip; tab: "expenses" | "settle"; onAdd: () => void }) {
  const Tab = ({ to, label, Icon }: { to: "expenses" | "settle"; label: string; Icon: typeof LuReceipt }) => (
    <a
      href={href({ name: "trip", id: trip.id, tab: to })}
      aria-current={tab === to ? "page" : undefined}
      className={cx("flex flex-col items-center gap-1 py-3 text-[0.75rem] font-semibold transition-colors", tab === to ? "text-ink" : "text-ink-3 hover:text-ink-2")}
    >
      <Icon className="size-6" aria-hidden />
      {label}
    </a>
  );
  return (
    <nav aria-label="Səyahət bölmələri" className="fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto grid max-w-[560px] grid-cols-[1fr_auto_1fr] items-end rounded-t-[28px] bg-white px-6 pb-[env(safe-area-inset-bottom)] shadow-bar">
        <Tab to="expenses" label="Xərclər" Icon={LuReceipt} />
        <button
          onClick={onAdd}
          aria-label="Xərc əlavə et"
          title="Xərc əlavə et"
          className="-mt-7 mb-3 inline-flex size-16 items-center justify-center rounded-full bg-sun text-ink shadow-fab ring-[6px] ring-white transition-transform hover:bg-sun-2 active:scale-95"
        >
          <LuPlus className="size-7" strokeWidth={2.5} aria-hidden />
        </button>
        <Tab to="settle" label="Hesablaşma" Icon={LuArrowRightLeft} />
      </div>
    </nav>
  );
}
