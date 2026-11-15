import { createContext, useContext, useState, type ReactNode } from "react";
import { LuPlane, LuPlus } from "react-icons/lu";
import { tripTotal } from "../lib/balances";
import { formatRange, tripDays } from "../lib/dates";
import { formatMoney } from "../lib/money";
import type { Expense, Trip } from "../lib/types";
import { ExpenseSheet } from "../screens/ExpenseSheet";
import { href, tripHref, type Tab } from "../state/router";
import { useStore } from "../state/store";
import { RouteLine, TripArt } from "./Art";
import { useToast } from "./Toast";
import { Button, LinkButton, PersonTile, cx } from "./ui";

/* ------------------------------------------------ Site header and footer */

export function SiteHeader({ cta = true, transparent }: { cta?: boolean; transparent?: boolean }) {
  return (
    <header className={cx("sticky top-0 z-30 print:hidden", transparent ? "bg-cream/80 backdrop-blur" : "border-b border-sun-soft/60 bg-cream/90 backdrop-blur")}>
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center gap-6 px-5 sm:px-8">
        <a href={href({ name: "home" })} className="text-[1.6rem] leading-none font-extrabold tracking-[-0.03em] text-sun-2">
          TRIPMATE
        </a>
        <nav aria-label="Əsas menyu" className="ml-auto flex items-center gap-2 sm:gap-5">
          <a href={href({ name: "home" })} className="rounded px-1 py-2 text-[0.92rem] font-medium text-ink-2 transition-colors hover:text-ink max-sm:hidden">
            Səfərlərim
          </a>
          {cta && (
            <LinkButton href={href({ name: "new" })} variant="dark" className="h-10 px-5">
              Yeni səfər
            </LinkButton>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="grain overflow-hidden bg-sun print:hidden">
      <div className="mx-auto grid max-w-[1200px] items-center gap-8 px-5 py-12 sm:px-8 md:grid-cols-[auto_1fr_auto]">
        <div>
          <p className="text-[1.6rem] leading-none font-extrabold tracking-[-0.03em] text-ink">TRIPMATE</p>
          <p className="mt-2 font-serif text-[1.05rem] text-ink/80 italic">Xərcləri asan bölüşün.</p>
        </div>
        <div className="relative hidden h-12 md:block" aria-hidden>
          <RouteLine className="h-12 text-ink/45" />
          <LuPlane className="absolute -top-1 right-0 size-6 rotate-[20deg] text-ink" />
        </div>
        <p className="max-w-[16rem] text-[0.82rem] text-ink/70">Məlumatlar yalnız bu brauzerdə saxlanılır. Hesabat üçün CSV və ya PDF yükləyin.</p>
      </div>
    </footer>
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
  const perPerson = trip.participants.length ? Math.round(total / trip.participants.length) : 0;

  return (
    <SheetCtx.Provider value={open}>
      <div className="flex min-h-dvh flex-col print:hidden">
        <div className="grain border-b border-sun-soft bg-cream">
          <SiteHeader transparent />
          {/* Trip header: words on the left, the trip's postcard on the right */}
          <section className="mx-auto max-w-[1200px] px-5 pt-6 sm:px-8 lg:pt-8">
            <div className="grid items-center gap-x-14 gap-y-8 md:grid-cols-[1fr_320px] lg:grid-cols-[1fr_380px]">
              <div className="min-w-0">
                <nav aria-label="Yol" className="text-[0.84rem] text-ink-3">
                  <a href={href({ name: "home" })} className="rounded hover:text-ink">
                    Səfərlərim
                  </a>
                  <span className="mx-2" aria-hidden>
                    /
                  </span>
                  <span className="text-ink-2">{trip.name}</span>
                </nav>
                <h1 className="mt-3 font-serif text-[clamp(2.2rem,4.6vw,3.6rem)] leading-[1.02] font-semibold tracking-[-0.02em]">{trip.name}</h1>
                <p className="mt-3 font-serif text-[1.1rem] text-ink-2 italic">
                  {[trip.destination, formatRange(trip.startDate, trip.endDate), days ? `${days} gün` : ""].filter(Boolean).join(", ")}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <span className="flex gap-1.5" aria-hidden>
                    {trip.participants.slice(0, 8).map((p) => (
                      <PersonTile key={p.id} name={p.name} size={34} />
                    ))}
                  </span>
                  <span className="text-[0.9rem] text-ink-2">{trip.participants.map((p) => p.name).join(", ")}</span>
                </div>
                {/* Phones: the summary sits under the names */}
                <div className="mt-6 inline-flex rounded-[20px] bg-sun py-2.5 md:hidden">
                  <Figure label="Ümumi xərc" value={formatMoney(total, trip.currency)} />
                  <Figure label="Adambaşı" value={formatMoney(perPerson, trip.currency)} divided />
                </div>
              </div>
              <div className="relative hidden pb-6 md:block">
                <figure className="postcard rotate-[2.5deg] transition-transform duration-500 hover:rotate-0">
                  <div className="aspect-[16/10] overflow-hidden rounded-[3px]">
                    <TripArt trip={trip} />
                  </div>
                  <figcaption className="absolute bottom-2 left-3 font-serif text-[0.95rem] text-ink-2 italic">{trip.destination || trip.name}</figcaption>
                </figure>
                <div className="absolute -bottom-1 -left-8 flex -rotate-[2deg] rounded-[20px] bg-sun py-2.5 shadow-[0_12px_28px_-12px_rgb(120_70_0/0.5)]">
                  <Figure label="Ümumi xərc" value={formatMoney(total, trip.currency)} />
                  <Figure label="Adambaşı" value={formatMoney(perPerson, trip.currency)} divided />
                </div>
              </div>
            </div>

            {/* Tabs + the two actions */}
            <div className="mt-9 flex items-end justify-between gap-4">
              <nav aria-label="Səfər bölmələri" className="-mb-px flex gap-1 overflow-x-auto">
                {TABS.map((t) => {
                  const on = t.tab === tab;
                  return (
                    <a
                      key={t.tab}
                      href={tripHref(trip.id, t.tab)}
                      aria-current={on ? "page" : undefined}
                      className={cx(
                        "border-b-[3px] px-3 pt-2 pb-3.5 text-[0.9rem] font-semibold whitespace-nowrap transition-colors sm:px-5 sm:text-[0.98rem]",
                        on ? "border-ink text-ink" : "border-transparent text-ink-3 hover:border-sun hover:text-ink",
                      )}
                    >
                      {t.label}
                    </a>
                  );
                })}
              </nav>
              <div className="mb-3 flex items-center gap-2 max-md:hidden">
                <LinkButton href={href({ name: "edit", id: trip.id })} variant="ghost" className="h-10 px-4">
                  Səfəri düzəlt
                </LinkButton>
                <Button onClick={() => open()} className="h-10 px-5">
                  Xərc əlavə et
                </Button>
              </div>
            </div>
          </section>
        </div>

        <main id="main" className="mx-auto w-full max-w-[1200px] flex-1 px-5 pt-8 pb-28 sm:px-8 lg:pt-10">
          {children}
        </main>
        <SiteFooter />
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

function Figure({ label, value, divided }: { label: string; value: string; divided?: boolean }) {
  return (
    <div className={cx("px-5 text-center", divided && "border-l-2 border-ink/70")}>
      <p className="text-[0.76rem] text-ink/75">{label}</p>
      <p className="text-[1.25rem] font-semibold whitespace-nowrap tabular">{value}</p>
    </div>
  );
}

/** Section intro used inside a tab. The tab already names the section, so the title is for screen readers. */
export function SectionTitle({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div>
        <h2 className="sr-only">{title}</h2>
        {sub && <p className="font-serif text-[1.1rem] text-ink-2 italic">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
