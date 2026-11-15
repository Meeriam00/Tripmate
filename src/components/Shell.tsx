import type { ReactNode } from "react";
import { LuCamera, LuCoffee, LuLuggage, LuMapPin, LuMountain, LuPlane, LuTent, LuTicket, LuUtensils, LuBus } from "react-icons/lu";
import { cx } from "./ui";

/**
 * Page frame from the reference: a cream page, the app as a white sheet,
 * and — on large screens — an orange band behind it with a few line icons.
 */
export function Shell({ top, children, bar, className }: { top: ReactNode; children: ReactNode; bar?: ReactNode; className?: string }) {
  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <Backdrop />
      <div className="relative mx-auto max-w-[560px]">
        <header className="px-5 pt-[max(1rem,env(safe-area-inset-top))] sm:px-7">{top}</header>
        <main
          id="main"
          className={cx(
            "min-h-[60dvh] rounded-t-[32px] bg-white md:mb-16 md:min-h-[520px] md:rounded-[32px] md:shadow-sheet",
            bar ? "pb-32 md:pb-28" : "pb-10",
            className,
          )}
        >
          {children}
        </main>
      </div>
      {bar}
    </div>
  );
}

const ICONS = [
  { I: LuUtensils, x: "8%", y: "54%", r: -12 },
  { I: LuCamera, x: "5%", y: "70%", r: 8 },
  { I: LuMapPin, x: "10%", y: "86%", r: -6 },
  { I: LuCoffee, x: "16%", y: "62%", r: 10 },
  { I: LuTent, x: "15%", y: "78%", r: -4 },
  { I: LuPlane, x: "89%", y: "55%", r: 14 },
  { I: LuLuggage, x: "93%", y: "71%", r: -8 },
  { I: LuMountain, x: "85%", y: "86%", r: 6 },
  { I: LuTicket, x: "84%", y: "66%", r: -14 },
  { I: LuBus, x: "90%", y: "93%", r: 4 },
];

function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 hidden md:block">
      <div className="absolute inset-x-0 top-[44%] bottom-0 bg-sun" />
      <div className="hidden xl:block">
        {ICONS.map(({ I, x, y, r }, i) => (
          <I key={i} className="absolute size-11 text-white" style={{ left: x, top: y, transform: `rotate(${r}deg)`, strokeWidth: 1.6 }} />
        ))}
      </div>
    </div>
  );
}

/** The reference's app bar: something left, a bold centred title, something right. */
export function AppBar({ left, title, sub, right }: { left?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 pb-6">
      <div>{left}</div>
      <div className="min-w-0 text-center">
        <h1 className="truncate text-[1.25rem] font-bold text-ink">{title}</h1>
        {sub && <p className="truncate text-[0.82rem] text-ink-2">{sub}</p>}
      </div>
      <div className="flex justify-end">{right}</div>
    </div>
  );
}
