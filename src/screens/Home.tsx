import { LuChevronRight, LuLuggage, LuPlus } from "react-icons/lu";
import { Shell } from "../components/Shell";
import { LinkButton, SectionHead, Tile } from "../components/ui";
import { tripTotal } from "../lib/balances";
import { formatMoney } from "../lib/money";
import type { Trip } from "../lib/types";
import { href } from "../state/router";
import { useStore } from "../state/store";

export function Home() {
  const { trips } = useStore();
  const sorted = [...trips].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <Shell
      className="md:min-h-0"
      top={
        <div className="pt-10 pb-10 text-center sm:pt-16 md:pb-14">
          <h1 className="text-[clamp(3.3rem,15vw,5.4rem)] leading-[0.95] font-extrabold tracking-[-0.03em] text-sun">TRIPMATE</h1>
          <p className="mt-2 text-[clamp(1.2rem,5.2vw,1.85rem)] leading-tight font-bold text-ink">XƏRCLƏRİ ASAN BÖLÜŞÜN</p>
          <p className="mx-auto mt-5 max-w-[24rem] text-[0.98rem] text-ink-2">
            Səyahətdə kim nə ödədisə, yazın. Kimin kimə nə qədər qaytarmalı olduğunu TRIPMATE özü hesablayacaq.
          </p>
          <LinkButton href={href({ name: "new" })} size="lg" variant="dark" icon={<LuPlus className="size-5" aria-hidden />} className="mt-8">
            Səyahət yarat
          </LinkButton>
        </div>
      }
    >
      <SectionHead title="Səyahətlərim" aside={trips.length ? `${trips.length} səyahət` : undefined} />
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center px-8 py-14 text-center">
          <Tile size={64}>
            <LuLuggage className="size-7" />
          </Tile>
          <h2 className="mt-5 text-[1.15rem] font-semibold">Hələ səyahət yoxdur</h2>
          <p className="mt-1.5 max-w-xs text-[0.92rem] text-ink-2">İlk səyahətinizi yaradın, dostlarınızı əlavə edin və xərcləri birlikdə izləyin.</p>
        </div>
      ) : (
        <ul>
          {sorted.map((t) => (
            <TripRow key={t.id} trip={t} />
          ))}
        </ul>
      )}
      <div className="px-5 pt-4 sm:px-7">
        <a
          href={href({ name: "new" })}
          className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sun-soft py-4 text-[0.92rem] font-semibold text-ink-2 transition-colors hover:border-sun hover:bg-cream-2 hover:text-ink"
        >
          <LuPlus aria-hidden /> Yeni səyahət
        </a>
      </div>
    </Shell>
  );
}

function TripRow({ trip }: { trip: Trip }) {
  const n = trip.participants.length;
  return (
    <li className="border-b border-line">
      <a href={href({ name: "trip", id: trip.id, tab: "expenses" })} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-cream-2/60 sm:px-7">
        <Tile>
          <LuLuggage className="size-5" />
        </Tile>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[1rem] font-semibold text-ink">{trip.name}</span>
          <span className="block truncate text-[0.78rem] text-ink-3">
            {[trip.destination, `${n} nəfər`, `${trip.expenses.length} xərc`].filter(Boolean).join("  |  ")}
          </span>
        </span>
        <span className="text-right text-[0.95rem] font-medium text-ink-2 tabular">{formatMoney(tripTotal(trip), trip.currency)}</span>
        <LuChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
      </a>
    </li>
  );
}
