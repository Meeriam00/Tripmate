import { useId, type ReactNode } from "react";
import { cx } from "./ui";

/**
 * Original illustration system: every trip gets a vintage-travel-poster
 * scene, generated from its destination. Flat shapes in the brand palette,
 * no photos, no stock art. The same trip always gets the same picture.
 */

export type Scene = "mountains" | "sea" | "city" | "dunes";

const SEA = /dəniz|sahil|plaj|nabran|lənkəran|astara|xəzər|antalya|batumi|bodrum|dubai|maldiv|nice|barselona|kipr|krit/i;
const CITY = /bakı|istanbul|paris|london|roma|praqa|tbilisi|berlin|vyana|amsterdam|madrid|nyu|tokio|şəhər|budapeşt|milan/i;
const MOUNT = /qəbələ|şəki|quba|qusar|şahdağ|tufandağ|lahıc|ismayıllı|xınalıq|qax|zaqatala|dağ|alp|kazbek|gudauri|kapadokya|bakuriani/i;
const DUNE = /qobustan|səhra|misir|dubay|mərakeş|naxçıvan|ərəbistan/i;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Small deterministic random generator, so a trip's picture never changes. */
function rng(seed: number) {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sceneFor(destination: string, name: string, id: string): Scene {
  const text = `${destination} ${name}`.toLocaleLowerCase("az");
  if (SEA.test(text)) return "sea";
  if (MOUNT.test(text)) return "mountains";
  if (DUNE.test(text)) return "dunes";
  if (CITY.test(text)) return "city";
  return (["mountains", "sea", "city", "dunes"] as const)[hash(id) % 4];
}

const SKIES = ["#FDF0DC", "#FCE2BD", "#FDE8C8", "#F9D9A6"];

export function TripArt({ trip, className, rounded = true }: { trip: { id: string; name: string; destination: string }; className?: string; rounded?: boolean }) {
  const scene = sceneFor(trip.destination, trip.name, trip.id);
  const r = rng(hash(trip.id + trip.destination));
  const sky = SKIES[Math.floor(r() * SKIES.length)];
  const sunX = 70 + r() * 260;
  const sunY = 58 + r() * 30;
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className={cx("block h-full w-full", className)} role="img" aria-label={`${trip.name} üçün illüstrasiya`}>
      <defs>
        <clipPath id={`c${uid}`}>
          <rect width="400" height="240" rx={rounded ? 0 : 0} />
        </clipPath>
      </defs>
      <g clipPath={`url(#c${uid})`}>
        <rect width="400" height="240" fill={sky} />
        {/* Sun with a few poster-style rings */}
        <circle cx={sunX} cy={sunY} r="64" fill="#FBB54C" opacity=".14" />
        <circle cx={sunX} cy={sunY} r="46" fill="#FBB54C" opacity=".22" />
        <circle cx={sunX} cy={sunY} r="30" fill="#FBB54C" />
        {scene === "mountains" && <Mountains r={r} />}
        {scene === "sea" && <Sea r={r} />}
        {scene === "city" && <City r={r} />}
        {scene === "dunes" && <Dunes r={r} />}
        {/* Two birds */}
        <path d={`M${300 - sunX / 3} 46 q6 -6 12 0 q6 -6 12 0`} fill="none" stroke="#1B1B1B" strokeWidth="2" strokeLinecap="round" />
        <path d={`M${330 - sunX / 3} 64 q4 -4 8 0 q4 -4 8 0`} fill="none" stroke="#1B1B1B" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function ridge(r: () => number, base: number, amp: number, steps: number) {
  const pts: string[] = [`0,240`, `0,${base}`];
  for (let i = 1; i <= steps; i++) {
    const x = (400 / steps) * i - (400 / steps) * (0.2 + r() * 0.6) * 0.5;
    const peak = i % 2 === 1;
    pts.push(`${x.toFixed(1)},${(base - (peak ? amp * (0.6 + r() * 0.5) : amp * r() * 0.25)).toFixed(1)}`);
  }
  pts.push(`400,${base - amp * r() * 0.3}`, `400,240`);
  return pts.join(" ");
}

function Mountains({ r }: { r: () => number }) {
  return (
    <>
      <polygon points={ridge(r, 170, 95, 5)} fill="#F6C987" />
      <polygon points={ridge(r, 196, 80, 7)} fill="#F5A52D" />
      {/* Snow caps hinted by the light ridge above */}
      <polygon points={ridge(r, 222, 46, 9)} fill="#1B1B1B" />
      {Array.from({ length: 7 }, (_, i) => {
        const x = 20 + i * 55 + r() * 20;
        const h = 18 + r() * 12;
        return <polygon key={i} points={`${x},${232 - h} ${x - 7},232 ${x + 7},232`} fill="#1B1B1B" />;
      })}
    </>
  );
}

function Sea({ r }: { r: () => number }) {
  const boat = 80 + r() * 220;
  return (
    <>
      <rect y="150" width="400" height="90" fill="#F5A52D" />
      <rect y="150" width="400" height="6" fill="#FBB54C" />
      {Array.from({ length: 5 }, (_, i) => (
        <path
          key={i}
          d={`M${-20 + r() * 30} ${172 + i * 14} ${Array.from({ length: 12 }, () => `q 9 -6 18 0 t 18 0`).join(" ")}`}
          fill="none"
          stroke="#1B1B1B"
          strokeOpacity={0.25 + i * 0.1}
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
      <path d={`M${boat} 148 l14 -40 v40 z`} fill="#FDF0DC" />
      <path d={`M${boat - 6} 150 h30 l-6 9 h-18 z`} fill="#1B1B1B" />
    </>
  );
}

function City({ r }: { r: () => number }) {
  const blocks: { x: number; w: number; h: number }[] = [];
  let x = -4;
  while (x < 404) {
    const w = 22 + r() * 34;
    blocks.push({ x, w, h: 40 + r() * 90 });
    x += w + 3;
  }
  return (
    <>
      <polygon points={ridge(r, 205, 40, 5)} fill="#F6C987" />
      {blocks.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={240 - b.h} width={b.w} height={b.h} fill={i % 3 === 1 ? "#F5A52D" : "#1B1B1B"} />
          {i % 3 !== 1 &&
            Array.from({ length: Math.floor(b.h / 22) }, (_, k) => (
              <rect key={k} x={b.x + 6} y={240 - b.h + 10 + k * 22} width={Math.max(4, b.w - 12)} height="4" fill="#FDF0DC" opacity=".55" />
            ))}
        </g>
      ))}
    </>
  );
}

function Dunes({ r }: { r: () => number }) {
  const a = 150 + r() * 20;
  return (
    <>
      <path d={`M0 ${a} C 90 ${a - 40}, 170 ${a + 10}, 260 ${a - 25} S 380 ${a - 10}, 400 ${a - 30} V240 H0 Z`} fill="#F6C987" />
      <path d={`M0 ${a + 40} C 120 ${a + 5}, 200 ${a + 55}, 300 ${a + 20} S 390 ${a + 30}, 400 ${a + 10} V240 H0 Z`} fill="#F5A52D" />
      <path d={`M0 ${a + 75} C 100 ${a + 55}, 220 ${a + 90}, 400 ${a + 60} V240 H0 Z`} fill="#1B1B1B" />
    </>
  );
}

/** A dashed travel route with a small plane: the product's recurring motif. */
export function RouteLine({ className, progress }: { className?: string; progress?: number }) {
  const p = progress === undefined ? null : Math.max(0, Math.min(1, progress));
  return (
    <svg viewBox="0 0 300 40" preserveAspectRatio="none" className={cx("block w-full", className)} aria-hidden>
      <path d="M4 30 C 80 2, 160 2, 296 22" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
      {p !== null && <path d="M4 30 C 80 2, 160 2, 296 22" fill="none" stroke="#F5A52D" strokeWidth="3" strokeLinecap="round" pathLength="1" strokeDasharray={`${p} 1`} />}
      <circle cx="4" cy="30" r="4" fill="currentColor" />
      <circle cx="296" cy="22" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/** A passport-style stamp. */
export function Stamp({ children, tone = "ink", className }: { children: ReactNode; tone?: "ink" | "gain" | "sun"; className?: string }) {
  const color = tone === "gain" ? "text-gain border-gain" : tone === "sun" ? "text-sun-2 border-sun-2" : "text-ink border-ink";
  return (
    <span
      className={cx(
        "inline-flex items-center justify-center rounded-[10px] border-[2.5px] px-3 py-1 text-[0.68rem] font-bold tracking-[0.14em] whitespace-nowrap uppercase",
        "shadow-[inset_0_0_0_2px_rgb(255_255_255/0.6)]",
        color,
        className,
      )}
    >
      {children}
    </span>
  );
}
