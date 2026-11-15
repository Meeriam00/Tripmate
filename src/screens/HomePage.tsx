import { LuPlane } from "react-icons/lu";
import { RouteLine, Stamp, TripArt } from "../components/Art";
import { SiteFooter, SiteHeader } from "../components/Layout";
import { LinkButton, PersonTile, cx } from "../components/ui";
import { settlement, tripTotal } from "../lib/balances";
import { formatRange, todayISO } from "../lib/dates";
import { formatMoney } from "../lib/money";
import type { Trip } from "../lib/types";
import { href, tripHref } from "../state/router";
import { useStore } from "../state/store";

const POSTCARDS = [
  { id: "kart-dag", name: "Qəbələ", destination: "Qəbələ" },
  { id: "kart-deniz", name: "Nabran", destination: "Nabran dəniz" },
  { id: "kart-seher", name: "İstanbul", destination: "İstanbul" },
];

/** Səfərlərim: an editorial welcome, then every trip as a postcard. */
export function HomePage() {
  const { trips } = useStore();
  const sorted = [...trips].sort((a, b) => b.startDate.localeCompare(a.startDate) || b.updatedAt - a.updatedAt);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader cta={false} transparent />
      <main id="main" className="flex flex-1 flex-col">
      <div className="grain bg-cream">
        <section className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 pt-10 pb-20 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pt-16 lg:pb-28">
          <div>
            <p className="font-serif text-[1.15rem] text-ink-2 italic">Dostlarla səfər, aydın hesab</p>
            <h1 className="mt-4 font-serif text-[clamp(2.7rem,5.6vw,4.7rem)] leading-[1.02] font-semibold tracking-[-0.02em] text-ink">
              Hər səfərin hesabı aydın olsun.
            </h1>
            <p className="mt-6 max-w-[30rem] text-[1.05rem] leading-relaxed text-ink-2">
              Kim nə ödədisə, yazın. Kimin kimə nə qədər qaytarmalı olduğunu TRIPMATE özü hesablayacaq, qəpiyinə qədər.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-5">
              <LinkButton href={href({ name: "new" })} size="lg" variant="dark" className="px-8">
                Yeni səfər yarat
              </LinkButton>
              {trips.length > 0 && (
                <a
                  href="#seferler"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById("seferler")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="group inline-flex items-center gap-2 rounded text-[0.95rem] font-semibold text-ink">
                  <span className="border-b-2 border-sun pb-0.5 transition-colors group-hover:border-ink">Səfərlərimə bax</span>
                </a>
              )}
            </div>
          </div>
          <Postcards />
        </section>
      </div>

      <section id="seferler" className="dots flex-1 scroll-mt-4 border-t border-sun-soft/70 bg-[#fffaf2]">
        <div className="mx-auto max-w-[1200px] px-5 pt-14 pb-20 sm:px-8 lg:pt-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-serif text-[clamp(2rem,3.6vw,2.9rem)] leading-none font-semibold tracking-[-0.015em]">Səfərlərim</h2>
            {trips.length > 0 && <p className="text-[0.95rem] text-ink-2">{trips.length === 1 ? "Bir səfər" : `${trips.length} səfər`}</p>}
          </div>

          {sorted.length === 0 ? (
            <div className="mt-10 grid gap-6 rounded-[28px] border-2 border-dashed border-sun-soft bg-white/60 p-8 sm:p-12 md:grid-cols-3">
              {["Səfəri yaradın, dostlarınızı əlavə edin", "Kim nə ödəyibsə, xərc kimi yazın", "Kim kimə nə qədər qaytarır, dərhal görün"].map((s, i) => (
                <div key={s}>
                  <p className="font-serif text-[2.4rem] leading-none font-semibold text-sun-2">{i + 1}</p>
                  <p className="mt-3 text-[1rem] text-ink">{s}</p>
                </div>
              ))}
            </div>
          ) : (
            <ul className="mt-10 grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
              {sorted.map((t, i) => (
                <TripCard key={t.id} trip={t} tilt={i % 3 === 1 ? 0.6 : i % 3 === 2 ? -0.5 : -0.8} />
              ))}
            </ul>
          )}
        </div>
      </section>
      </main>
      <SiteFooter />
    </div>
  );
}

/** The hero composition: three illustrated postcards fanned out along a route. */
function Postcards() {
  return (
    <div className="relative mx-auto h-[330px] w-full max-w-[520px] sm:h-[400px]" aria-hidden>
      <RouteLine className="absolute top-[6%] left-[2%] h-16 w-[92%] text-ink/40" />
      <LuPlane className="absolute top-[3%] right-[2%] size-7 rotate-[18deg] text-ink" />
      {POSTCARDS.map((p, i) => {
        const pos = [
          "left-[2%] top-[22%] -rotate-[7deg] w-[52%]",
          "right-[2%] top-[14%] rotate-[5deg] w-[50%]",
          "left-[22%] top-[40%] -rotate-[1.5deg] w-[58%]",
        ][i];
        return (
          <figure key={p.id} className={cx("postcard absolute transition-transform duration-500 hover:z-10 hover:-translate-y-2", pos)}>
            <div className="aspect-[5/3] overflow-hidden rounded-[3px]">
              <TripArt trip={p} />
            </div>
            <figcaption className="absolute bottom-2 left-3 font-serif text-[0.95rem] text-ink-2 italic">{p.name}</figcaption>
            {i === 2 && <Stamp tone="sun" className="absolute -top-3 -right-3 rotate-[8deg] bg-white">TRIPMATE</Stamp>}
          </figure>
        );
      })}
    </div>
  );
}

function TripCard({ trip, tilt }: { trip: Trip; tilt: number }) {
  const total = tripTotal(trip);
  const pending = trip.expenses.length ? settlement(trip).length : 0;
  const today = todayISO();
  const when = trip.startDate > today ? "Qarşıda" : trip.endDate < today ? "Bitib" : "Yoldayıq";
  const status = trip.expenses.length === 0 ? "Hələ xərc yoxdur" : pending ? `${pending} ödəniş gözləyir` : "Hamı hesablaşıb";
  return (
    <li>
      <a
        href={tripHref(trip.id)}
        style={{ ["--tilt" as string]: `${tilt}deg` }}
        className="group postcard block rotate-[var(--tilt)] pb-5 transition-all duration-300 hover:rotate-0 hover:shadow-[0_2px_4px_rgb(80_50_10/0.06),0_28px_50px_-20px_rgb(80_50_10/0.45)]"
      >
        <div className="relative aspect-[16/10] overflow-hidden rounded-[3px]">
          <div className="h-full w-full transition-transform duration-500 group-hover:scale-[1.05]">
            <TripArt trip={trip} />
          </div>
          <Stamp tone="ink" className="absolute top-3 right-3 rotate-[6deg] bg-cream/90">
            {when}
          </Stamp>
        </div>
        <div className="px-2 pt-4">
          <h3 className="font-serif text-[1.45rem] leading-tight font-semibold tracking-[-0.01em] text-ink">{trip.name}</h3>
          <p className="mt-1 text-[0.86rem] text-ink-2">{[trip.destination, formatRange(trip.startDate, trip.endDate)].filter(Boolean).join(", ")}</p>
          <div className="mt-4 flex items-end justify-between gap-4 border-t border-dashed border-line pt-4">
            <div>
              <p className="text-[1.2rem] font-semibold tabular">{formatMoney(total, trip.currency)}</p>
              <p className={cx("text-[0.8rem] font-medium", pending ? "text-sun-2" : "text-ink-3")}>{status}</p>
            </div>
            <span className="flex gap-1" aria-label={trip.participants.map((p) => p.name).join(", ")}>
              {trip.participants.slice(0, 5).map((p) => (
                <PersonTile key={p.id} name={p.name} size={28} />
              ))}
            </span>
          </div>
        </div>
      </a>
    </li>
  );
}
