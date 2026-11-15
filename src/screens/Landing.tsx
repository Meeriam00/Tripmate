import { useMemo, type ReactNode } from "react";
import { LuArrowRight, LuPlus } from "react-icons/lu";
import { TopBar } from "../components/TopBar";
import { Avatar, AvatarStack, LinkButton, Logo, Money, Panel, cx } from "../components/ui";
import { tripTotal } from "../lib/balances";
import { formatRange, nights } from "../lib/dates";
import { formatMoney } from "../lib/money";
import { sampleTrip, SAMPLE_TRIP_ID } from "../lib/sample";
import { minimizeTransfers } from "../lib/settle";
import { settlementView } from "../lib/trip";
import type { Trip } from "../lib/types";
import { useStore } from "../state/store";

export function Landing() {
  const { trips, getTrip } = useStore();
  // The ticket always shows the pristine sample, even if the user edited theirs.
  const demo = useMemo(sampleTrip, []);
  const hasSample = !!getTrip(SAMPLE_TRIP_ID);

  return (
    <>
      <TopBar />
      <main id="main">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-16 sm:px-6 md:pt-16 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10 lg:pt-20 lg:pb-24">
          <div className="max-w-xl">
            <h1 className="display-tight font-display text-[clamp(3.4rem,9vw,6.6rem)] leading-[0.92] font-medium text-forest">
              Good trips.
              <br />
              Clear tabs.
            </h1>
            <p className="mt-7 max-w-[34rem] text-[1.12rem] leading-relaxed text-ink-2">
              Log who paid for what as the trip happens. Tripmate splits every bill to the cent and works out the fewest
              payments it takes for everyone to be square.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <LinkButton href="#/new" variant="signal" size="lg" icon={<LuPlus className="size-5" aria-hidden />}>
                Start a trip
              </LinkButton>
              <LinkButton href={hasSample ? `#/trip/${SAMPLE_TRIP_ID}` : "#/import/sample"} size="lg" variant="secondary">
                Explore the Lisbon example
              </LinkButton>
            </div>
            <p className="mt-6 text-[0.88rem] text-ink-3">No sign-up. Trips are saved in this browser.</p>
          </div>
          <Ticket trip={demo} />
        </section>

        <HowItWorks />

        {trips.length > 0 && <YourTrips trips={trips} />}
      </main>
      <footer className="border-t border-line/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-[0.85rem] text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo className="opacity-80" />
          <p>Good trips. Clear tabs. Your data never leaves this device unless you share a link.</p>
        </div>
      </footer>
    </>
  );
}

/** The hero's boarding-pass: a real trip, real maths, computed live. */
function Ticket({ trip }: { trip: Trip }) {
  const view = useMemo(() => settlementView(trip), [trip]);
  const total = tripTotal(trip);
  const name = (id: string) => trip.participants.find((p) => p.id === id)!;
  return (
    <div className="relative mx-auto w-full max-w-[30rem] lg:mr-0">
      <div className="ticket-in overflow-hidden rounded-[1.35rem] bg-card shadow-lift ring-1 ring-line/60 lg:rotate-[1.2deg]">
        <div className="px-6 pt-6 pb-5 sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.82rem] font-medium text-ink-3">{formatRange(trip.startDate, trip.endDate)}</p>
              <h2 className="mt-1 font-display text-[2rem] leading-none font-medium tracking-[-0.02em] text-ink">Lisbon</h2>
              <p className="mt-1.5 text-[0.9rem] text-ink-2">
                {nights(trip.startDate, trip.endDate)} nights, five friends
              </p>
            </div>
            <div className="text-right">
              <p className="text-[0.82rem] font-medium text-ink-3">Spent together</p>
              <p className="mt-1 font-display text-[2rem] leading-none font-medium tracking-[-0.02em] text-forest tabular">
                {formatMoney(total, trip.currency, { compact: true })}
              </p>
              <p className="mt-1.5 text-[0.9rem] text-ink-2">{trip.expenses.length} expenses</p>
            </div>
          </div>
          <ul className="mt-6 grid grid-cols-5 gap-1">
            {trip.participants.map((p) => {
              const l = view.ledgers.get(p.id)!;
              return (
                <li key={p.id} className="flex flex-col items-center gap-1.5 text-center">
                  <Avatar person={p} size={38} />
                  <span className="text-[0.78rem] font-medium text-ink">{p.name}</span>
                  <span className={cx("text-[0.74rem] font-semibold tabular", l.net > 0 ? "text-gain" : l.net < 0 ? "text-owe" : "text-ink-3")}>
                    {formatMoney(l.net, trip.currency, { signed: true, compact: true })}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="relative h-5 bg-card" aria-hidden>
          <span className="absolute top-1/2 -left-2.5 size-5 -translate-y-1/2 rounded-full bg-paper shadow-[inset_-1px_0_0_var(--color-line)]" />
          <span className="absolute top-1/2 -right-2.5 size-5 -translate-y-1/2 rounded-full bg-paper shadow-[inset_1px_0_0_var(--color-line)]" />
          <div className="absolute inset-x-5 top-1/2 border-t-2 border-dashed border-line" />
        </div>
        <div className="board px-6 pt-5 pb-6 sm:px-7">
          <div className="flex items-baseline justify-between">
            <p className="font-display text-lg text-paper">Settle up</p>
            <p className="text-[0.8rem] text-paper/60">{view.transfers.length} payments clear everything</p>
          </div>
          <ol className="mt-3">
            {view.transfers.map((t, i) => (
              <li key={i} className="board-row flap-in flex items-center gap-3 py-2.5" style={{ animationDelay: `${300 + i * 110}ms` }}>
                <span className="w-16 truncate text-[0.92rem] font-medium text-paper">{name(t.from).name}</span>
                <LuArrowRight className="size-4 shrink-0 text-paper/45" aria-label="pays" />
                <span className="flex-1 truncate text-[0.92rem] font-medium text-paper">{name(t.to).name}</span>
                <span className="flap text-[0.95rem] font-semibold tabular">{formatMoney(t.amount, trip.currency)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

const EXAMPLE = [
  { name: "Maryam", color: 0, paid: 20000 },
  { name: "Ali", color: 1, paid: 5000 },
  { name: "Leyla", color: 2, paid: 0 },
  { name: "Murad", color: 3, paid: 15000 },
  { name: "Aysel", color: 5, paid: 10000 },
];

function HowItWorks() {
  const share = 10000;
  const balances = new Map(EXAMPLE.map((p) => [p.name, p.paid - share]));
  const transfers = minimizeTransfers(balances, EXAMPLE.map((p) => p.name));
  const max = 10000;
  return (
    <section className="border-y border-line/70 bg-card/60" aria-labelledby="how">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <h2 id="how" className="max-w-2xl font-display text-[clamp(2rem,4.4vw,3rem)] leading-[1.05] font-medium tracking-[-0.02em] text-ink">
          How the maths works, in one example
        </h2>
        <div className="mt-12 grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <ol className="space-y-8">
            <Step n={1} title="Everyone pays for something">
              Five friends spend €500 between them. Maryam covered €200, Murad €150, Aysel €100, Ali €50 and Leyla
              nothing yet.
            </Step>
            <Step n={2} title="Each person's fair share is worked out">
              Everything was shared equally, so everyone's share is €100. Balance is what you paid minus your share.
              Splits can also be exact amounts or weighted, and odd cents are never lost.
            </Step>
            <Step n={3} title="The fewest payments settle it">
              Instead of everyone paying everyone, Tripmate finds groups that cancel out. Here two payments clear the
              whole trip.
            </Step>
          </ol>

          <Panel className="p-5 sm:p-7">
            <ul className="space-y-3.5" aria-label="Balances">
              {EXAMPLE.map((p) => {
                const b = balances.get(p.name)!;
                return (
                  <li key={p.name} className="grid grid-cols-[7.5rem_1fr_4.5rem] items-center gap-3 sm:grid-cols-[9rem_1fr_5rem]">
                    <span className="flex items-center gap-2.5">
                      <Avatar person={p} size={30} />
                      <span className="text-[0.92rem] font-medium">{p.name}</span>
                    </span>
                    <span className="relative h-7" aria-hidden>
                      <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
                      {b !== 0 && (
                        <span
                          className={cx("absolute inset-y-1 rounded-[0.3rem]", b > 0 ? "left-1/2 bg-gain" : "right-1/2 bg-owe")}
                          style={{ width: `${(Math.abs(b) / max) * 50}%` }}
                        />
                      )}
                    </span>
                    <Money value={b} currency="EUR" signed tone="auto" className="text-right text-[0.92rem] font-semibold" />
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex justify-between text-[0.78rem] text-ink-3">
              <span>owes</span>
              <span>gets back</span>
            </div>
            <div className="board mt-6 rounded-xl px-5 py-4">
              {transfers.map((t, i) => (
                <div key={i} className="board-row flex items-center gap-3 py-2">
                  <span className="w-16 text-[0.92rem] font-medium">{t.from}</span>
                  <LuArrowRight className="size-4 text-paper/45" aria-label="pays" />
                  <span className="flex-1 text-[0.92rem] font-medium">{t.to}</span>
                  <span className="flap font-semibold tabular">{formatMoney(t.amount, "EUR")}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[0.85rem] text-ink-2">
              Paying each person back for each expense would take 16 separate transfers. Aysel is already square,
              so she isn't asked to do anything.
            </p>
          </Panel>
        </div>
      </div>
    </section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[2.5rem_1fr] gap-4">
      <span className="flex size-9 items-center justify-center rounded-full bg-forest font-display text-lg text-signal" aria-hidden>
        {n}
      </span>
      <div>
        <h3 className="text-[1.08rem] font-semibold text-ink">{title}</h3>
        <p className="mt-1.5 max-w-md text-[0.97rem] leading-relaxed text-ink-2">{children}</p>
      </div>
    </li>
  );
}

function YourTrips({ trips }: { trips: Trip[] }) {
  const sorted = [...trips].sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <section id="trips" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6" aria-labelledby="trips-h">
      <div className="flex items-end justify-between gap-4">
        <h2 id="trips-h" className="font-display text-[2.2rem] leading-none font-medium tracking-[-0.02em]">
          Your trips
        </h2>
        <LinkButton href="#/new" size="sm" icon={<LuPlus aria-hidden />}>
          New trip
        </LinkButton>
      </div>
      <ul className="mt-8 divide-y divide-line/80 border-y border-line/80">
        {sorted.map((t) => (
          <TripRow key={t.id} trip={t} />
        ))}
      </ul>
    </section>
  );
}

function TripRow({ trip }: { trip: Trip }) {
  const view = useMemo(() => settlementView(trip), [trip]);
  const total = tripTotal(trip);
  const status = trip.expenses.length === 0 ? "No expenses yet" : view.settled ? "All settled" : `${formatMoney(view.outstanding, trip.currency)} to settle`;
  return (
    <li>
      <a
        href={`#/trip/${trip.id}`}
        className="group grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 px-1 py-5 transition-colors hover:bg-card/70 sm:grid-cols-[1.4fr_1fr_auto_auto] sm:px-3"
      >
        <div className="min-w-0">
          <p className="truncate font-display text-[1.35rem] leading-tight font-medium text-ink group-hover:text-forest">{trip.name}</p>
          <p className="mt-0.5 truncate text-[0.88rem] text-ink-3">
            {[trip.destination, formatRange(trip.startDate, trip.endDate)].filter(Boolean).join(", ")}
          </p>
        </div>
        <div className="hidden sm:block">
          <AvatarStack people={trip.participants} size={28} />
        </div>
        <div className="text-right">
          <Money value={total} currency={trip.currency} className="text-[1rem] font-semibold" />
          <p className={cx("text-[0.82rem]", view.settled && trip.expenses.length ? "text-gain" : "text-ink-3")}>{status}</p>
        </div>
        <LuArrowRight className="hidden size-5 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ink sm:block" aria-hidden />
      </a>
    </li>
  );
}
