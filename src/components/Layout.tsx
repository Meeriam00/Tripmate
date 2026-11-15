import { createContext, useContext, useState, type ReactNode } from "react";
import { LuPencil, LuPlus } from "react-icons/lu";
import { tripTotal } from "../lib/balances";
import { formatRange, tripDays } from "../lib/dates";
import { formatMoney } from "../lib/money";
import type { Expense, Trip } from "../lib/types";
import { ExpenseSheet } from "../screens/ExpenseSheet";
import { href, tripHref, type Tab } from "../state/router";
import { useStore } from "../state/store";
import { useToast } from "./Toast";
import { LinkButton, Button, PersonTile, cx } from "./ui";

/* ------------------------------------------------ Site header */

export function SiteHeader({ cta = true }: { cta?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-sun-soft/60 bg-cream/90 backdrop-blur print:hidden">
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center gap-6 px-5 sm:px-8">
        <a href={href({ name: "home" })} className="text-[1.6rem] leading-none font-extrabold tracking-[-0.03em] text-sun-2">
          TRIPMATE
        </a>
        <nav aria-label="Əsas menyu" className="ml-auto flex items-center gap-2 sm:gap-4">
          <a href={href({ name: "home" })} className="rounded-full px-3 py-2 text-[0.92rem] font-medium text-ink-2 transition-colors hover:text-ink max-sm:hidden">
            Səfərlərim
          </a>
          {cta && (
            <LinkButton href={href({ name: "new" })} variant="dark" icon={<LuPlus className="size-4" strokeWidth={2.5} aria-hidden />} className="h-10 px-4">
              <span className="max-sm:hidden">Yeni səfər yarat</span>
              <span className="sm:hidden">Yeni səfər</span>
            </LinkButton>
          )}
        </nav>
      </div>
    </header>
  );
}

export function Page({ children, narrow }: { children: ReactNode; narrow?: boolean }) {
  return <main id="main" className={cx("mx-auto px-5 pt-8 pb-28 sm:px-8 lg:pt-12", narrow ? "max-w-[880px]" : "max-w-[1200px]")}>{children}</main>;
}

/* ------------------------------------------------ Quick expense entry */

const SheetCtx = createContext<(e?: Expense) => void>(() => {});
export const useExpenseSheet = () => useContext(SheetCtx);

/* ------------------------------------------------ A trip: header + three tabs */

const TABS: { tab: Tab; label: string }[] = [
  { tab: "overview", label: "Ümumi məlumat" },
  { tab: "expenses", label: "Xərclər" },
  { tab: "settle", label: "Hesablaşma" },
];

export function TripLayout({ trip, tab, children }: { trip: Trip; tab: Tab; children: ReactNode }) {
  const { dispatch } = useStore();
  const toast = useToast();
  // A new `n` remounts the sheet so every opening starts from fresh values.
  const [sheet, setSheet] = useState<{ open: boolean; expense?: Expense; n: number }>({ open: false, n: 0 });
  const open = (expense?: Expense) => setSheet((s) => ({ open: true, expense, n: s.n + 1 }));
  const close = () => setSheet((s) => ({ ...s, open: false }));
  const total = tripTotal(trip);
  const days = tripDays(trip.startDate, trip.endDate);

  return (
    <SheetCtx.Provider value={open}>
      <SiteHeader />
      <div className="print:hidden">
        {/* Trip header */}
        <section className="mx-auto max-w-[1200px] px-5 pt-7 sm:px-8 lg:pt-10">
          <nav aria-label="Yol" className="text-[0.84rem] text-ink-3">
            <a href={href({ name: "home" })} className="rounded hover:text-ink">
              Səfərlərim
            </a>
            <span className="mx-2" aria-hidden>
              /
            </span>
            <span className="text-ink-2">{trip.name}</span>
          </nav>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
            <div className="min-w-0">
              <h1 className="text-[clamp(1.9rem,4vw,3rem)] leading-[1.05] font-bold tracking-[-0.025em]">{trip.name}</h1>
              <p className="mt-2 text-[0.98rem] text-ink-2">
                {[trip.destination, formatRange(trip.startDate, trip.endDate), days ? `${days} gün` : ""].filter(Boolean).join(", ")}
              </p>
              <div className="mt-4 flex items-center gap-3">
                <span className="flex gap-1.5">
                  {trip.participants.slice(0, 6).map((p) => (
                    <PersonTile key={p.id} name={p.name} size={34} />
                  ))}
                </span>
                <span className="text-[0.88rem] text-ink-2">{trip.participants.map((p) => p.name).join(", ")}</span>
              </div>
            </div>
            <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:items-end">
              <div className="flex rounded-[22px] bg-sun py-3">
                <div className="px-6 text-center">
                  <p className="text-[0.8rem] text-ink/75">Ümumi xərc</p>
                  <p className="text-[1.35rem] font-semibold tabular">{formatMoney(total, trip.currency)}</p>
                </div>
                <div className="border-l-2 border-ink/70 px-6 text-center">
                  <p className="text-[0.8rem] text-ink/75">Adambaşı</p>
                  <p className="text-[1.35rem] font-semibold tabular">{formatMoney(trip.participants.length ? Math.round(total / trip.participants.length) : 0, trip.currency)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs + primary action */}
          <div className="mt-8 flex items-end justify-between gap-4 border-b border-sun-soft">
            <nav aria-label="Səfər bölmələri" className="-mb-px flex gap-1 overflow-x-auto">
              {TABS.map((t) => {
                const on = t.tab === tab;
                return (
                  <a
                    key={t.tab}
                    href={tripHref(trip.id, t.tab)}
                    aria-current={on ? "page" : undefined}
                    className={cx(
                      "border-b-[3px] px-3 pt-2 pb-3 text-[0.9rem] font-semibold whitespace-nowrap transition-colors sm:px-5 sm:text-[0.95rem]",
                      on ? "border-sun text-ink" : "border-transparent text-ink-3 hover:border-sun-soft hover:text-ink",
                    )}
                  >
                    {t.label}
                  </a>
                );
              })}
            </nav>
            <div className="mb-2.5 flex items-center gap-2 max-md:hidden">
              <LinkButton href={href({ name: "edit", id: trip.id })} variant="ghost" icon={<LuPencil className="size-4" aria-hidden />} className="h-10 px-4">
                Səfəri düzəlt
              </LinkButton>
              <Button icon={<LuPlus className="size-[18px]" strokeWidth={2.5} aria-hidden />} onClick={() => open()} className="h-10">
                Xərc əlavə et
              </Button>
            </div>
          </div>
        </section>

        <main id="main" className="mx-auto max-w-[1200px] px-5 pt-7 pb-28 sm:px-8 lg:pt-9">
          {children}
        </main>
      </div>

      {/* Phones and tablets: one floating add button */}
      <button
        onClick={() => open()}
        aria-label="Xərc əlavə et"
        className="fixed right-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-40 inline-flex size-16 items-center justify-center rounded-full bg-sun text-ink shadow-fab transition-transform active:scale-95 md:hidden print:hidden"
      >
        <LuPlus className="size-7" strokeWidth={2.5} aria-hidden />
      </button>

      <ExpenseSheet
        key={sheet.n}
        trip={trip}
        open={sheet.open}
        expense={sheet.expense}
        onClose={close}
        onSave={(e, isNew) => {
          dispatch({ type: "expense/save", tripId: trip.id, expense: e });
          close();
          toast.show(isNew ? "Xərc əlavə edildi" : "Dəyişikliklər yadda saxlanıldı");
        }}
        onDelete={(e) => {
          dispatch({ type: "expense/delete", tripId: trip.id, id: e.id });
          close();
          toast.show("Xərc silindi");
        }}
      />
    </SheetCtx.Provider>
  );
}

/** Section heading used inside a tab. */
export function SectionTitle({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  // The tab already names the section, so the title is for screen readers only.
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div>
        <h2 className="sr-only">{title}</h2>
        {sub && <p className="text-[0.95rem] text-ink-2">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
