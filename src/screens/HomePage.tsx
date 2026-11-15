import { LuArrowRight, LuCalendar, LuMapPin, LuPlus } from "react-icons/lu";
import { Page, SiteHeader } from "../components/Layout";
import { LinkButton, PersonTile, cx } from "../components/ui";
import { settlement, tripTotal } from "../lib/balances";
import { formatRange, todayISO } from "../lib/dates";
import { formatMoney } from "../lib/money";
import type { Trip } from "../lib/types";
import { href, tripHref } from "../state/router";
import { useStore } from "../state/store";

/** Səfərlərim: every trip as a card, newest first, with one clear way to start another. */
export function HomePage() {
  const { trips } = useStore();
  if (trips.length === 0) return <Welcome />;
  const sorted = [...trips].sort((a, b) => b.startDate.localeCompare(a.startDate) || b.updatedAt - a.updatedAt);
  return (
    <>
      <SiteHeader cta={false} />
      <Page>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="text-[clamp(2rem,4.2vw,3.2rem)] leading-[1.05] font-bold tracking-[-0.025em]">Səfərlərim</h1>
            <p className="mt-2 max-w-xl text-[1rem] text-ink-2">Dostlarla birgə xərcləri yazın, kimin kimə nə qədər qaytaracağını TRIPMATE hesablasın.</p>
          </div>
          <LinkButton href={href({ name: "new" })} size="lg" variant="sun" icon={<LuPlus className="size-5" strokeWidth={2.5} aria-hidden />} className="shadow-fab">
            Yeni səfər yarat
          </LinkButton>
        </div>

        <ul className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((t) => (
            <TripCard key={t.id} trip={t} />
          ))}
          <li>
            <a
              href={href({ name: "new" })}
              className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 rounded-[28px] border-2 border-dashed border-sun-soft text-ink-2 transition-colors hover:border-sun hover:bg-white/50 hover:text-ink"
            >
              <span className="inline-flex size-12 items-center justify-center rounded-full bg-sun-soft text-ink">
                <LuPlus className="size-6" aria-hidden />
              </span>
              <span className="font-semibold">Yeni səfər yarat</span>
            </a>
          </li>
        </ul>
      </Page>
    </>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  const total = tripTotal(trip);
  const pending = trip.expenses.length ? settlement(trip).length : 0;
  const today = todayISO();
  const when = trip.startDate > today ? "Qarşıda" : trip.endDate < today ? "Bitib" : "Davam edir";
  const status = trip.expenses.length === 0 ? "Hələ xərc yoxdur" : pending ? `${pending} ödəniş gözləyir` : "Hamı hesablaşıb";
  return (
    <li>
      <a
        href={tripHref(trip.id)}
        className="group flex h-full flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_1px_2px_rgb(80_50_10/0.04),0_10px_30px_-16px_rgb(80_50_10/0.25)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_2px_4px_rgb(80_50_10/0.05),0_22px_44px_-18px_rgb(80_50_10/0.35)]"
      >
        <div className="bg-sun px-6 pt-5 pb-5">
          <div className="flex items-center justify-between gap-3 text-[0.78rem] font-medium text-ink/75">
            <span className="inline-flex items-center gap-1.5">
              <LuCalendar className="size-3.5" aria-hidden />
              {formatRange(trip.startDate, trip.endDate)}
            </span>
            <span className="rounded-full bg-white/60 px-2.5 py-0.5 text-ink">{when}</span>
          </div>
          <h2 className="mt-3 text-[1.45rem] leading-tight font-bold tracking-[-0.01em] text-ink">{trip.name}</h2>
          {trip.destination && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-[0.88rem] text-ink/75">
              <LuMapPin className="size-3.5" aria-hidden />
              {trip.destination}
            </p>
          )}
        </div>
        <div className="flex flex-1 flex-col px-6 pt-5 pb-5">
          <div className="flex items-center gap-3">
            <span className="flex gap-1.5">
              {trip.participants.slice(0, 5).map((p) => (
                <PersonTile key={p.id} name={p.name} size={32} />
              ))}
            </span>
            <span className="text-[0.84rem] text-ink-2">{trip.participants.length} nəfər</span>
          </div>
          <div className="mt-auto flex items-end justify-between gap-4 pt-6">
            <div>
              <p className="text-[0.78rem] text-ink-3">Ümumi xərc</p>
              <p className="text-[1.3rem] font-semibold tabular">{formatMoney(total, trip.currency)}</p>
              <p className={cx("mt-0.5 text-[0.8rem] font-medium", pending ? "text-sun-2" : "text-ink-3")}>{status}</p>
            </div>
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-cream-2 text-ink transition-colors group-hover:bg-sun">
              <LuArrowRight className="size-5" aria-hidden />
            </span>
          </div>
        </div>
      </a>
    </li>
  );
}

/** No trips yet: a welcoming first screen. */
function Welcome() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-cream">
      <div className="absolute inset-x-0 top-[60%] bottom-0 bg-sun" aria-hidden />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 pt-[13vh] pb-16 text-center">
        <h1 className="text-[clamp(3.5rem,11vw,7rem)] leading-[0.92] font-extrabold tracking-[-0.03em] text-sun">TRIPMATE</h1>
        <p className="mt-3 text-[clamp(1.25rem,3vw,2rem)] font-bold">XƏRCLƏRİ ASAN BÖLÜŞÜN</p>
        <p className="mt-5 max-w-lg text-[1.02rem] text-ink-2">Səfərdə kim nə ödədisə, yazın. Kimin kimə nə qədər qaytarmalı olduğunu TRIPMATE özü hesablayacaq.</p>
        <div className="mt-10 w-full max-w-md rounded-[28px] bg-white p-7 shadow-sheet">
          <ol className="space-y-3 text-left text-[0.92rem]">
            {["Səfəri yaradın və dostlarınızı əlavə edin", "Kim nə ödəyibsə, xərc kimi yazın", "Kim kimə nə qədər qaytarmalıdır, dərhal görün"].map((s, i) => (
              <li key={s} className="flex items-center gap-3">
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-sun text-[0.8rem] font-bold">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          <LinkButton href={href({ name: "new" })} size="lg" variant="dark" className="mt-7 w-full" icon={<LuPlus className="size-5" aria-hidden />}>
            Yeni səfər yarat
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
