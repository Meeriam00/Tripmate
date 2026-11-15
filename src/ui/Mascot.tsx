import { useId } from "react";

/**
 * Tripo — TRIPMATE's fluffy travel buddy. The fur is real SVG: the body is
 * displaced with fractal noise, so the edge looks hairy at any size.
 * Mood and colour carry meaning: lilac = calm, peach = "careful",
 * mint = all settled.
 */
export type MascotMood = "happy" | "calm" | "worried" | "shocked" | "sleepy" | "party" | "wink";
export type MascotColor = "lilac" | "peach" | "mint";

const PALETTE: Record<MascotColor, [string, string, string]> = {
  lilac: ["#d6c6ff", "#a07ff5", "#7a55dd"],
  peach: ["#ffd3a6", "#ff9a4a", "#e9721f"],
  mint: ["#bff2dc", "#55cfa0", "#2d9f78"],
};

export function Mascot({
  mood = "happy",
  color = "lilac",
  size = 160,
  still = false,
  className = "",
  title,
}: {
  mood?: MascotMood;
  color?: MascotColor;
  size?: number;
  still?: boolean;
  className?: string;
  title?: string;
}) {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (s: string) => `${s}${raw}`;
  const [light, mid, dark] = PALETTE[color];
  const eyesClosed = mood === "sleepy";

  return (
    <svg
      className={`mascot ${still ? "still" : ""} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <radialGradient id={id("g")} cx="42%" cy="34%" r="70%">
          <stop offset="0%" stopColor={light} />
          <stop offset="58%" stopColor={mid} />
          <stop offset="100%" stopColor={dark} />
        </radialGradient>
        <filter id={id("fur")} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="11" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id={id("tex")} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" seed="3" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 -0.2" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <radialGradient id={id("shadow")} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2a1f55" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#2a1f55" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="100" cy="186" rx="58" ry="9" fill={`url(#${id("shadow")})`} />

      <g className="body">
        {/* feet */}
        <ellipse cx="78" cy="176" rx="15" ry="9" fill={dark} filter={`url(#${id("fur")})`} />
        <ellipse cx="122" cy="176" rx="15" ry="9" fill={dark} filter={`url(#${id("fur")})`} />
        {/* fluffy body */}
        <path
          d="M100 28c34 0 60 22 63 60 2 22 4 40 0 58-5 22-29 32-63 32s-58-10-63-32c-4-18-2-36 0-58 3-38 29-60 63-60Z"
          fill={`url(#${id("g")})`}
          filter={`url(#${id("fur")})`}
        />
        <path
          d="M100 34c30 0 54 20 57 55 2 21 3 38 0 54-5 19-26 28-57 28s-52-9-57-28c-3-16-2-33 0-54 3-35 27-55 57-55Z"
          fill={`url(#${id("g")})`}
          filter={`url(#${id("tex")})`}
          opacity="0.35"
        />
        {/* tuft */}
        <path d="M92 30c2-10 10-14 14-10-6 1-7 6-6 10" fill={mid} filter={`url(#${id("fur")})`} />

        {mood === "party" && (
          <g>
            <path d="M84 30 100 -2l16 32Z" fill="#ff8a3d" />
            <circle cx="100" cy="-3" r="6" fill="#ec4f8f" />
            <path d="M90 22h20M87 15h26" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
          </g>
        )}

        {/* cheeks */}
        {(mood === "happy" || mood === "party" || mood === "wink") && (
          <g fill="#ff7aa8" opacity="0.45">
            <ellipse cx="62" cy="108" rx="10" ry="6" />
            <ellipse cx="138" cy="108" rx="10" ry="6" />
          </g>
        )}

        {/* brows */}
        {mood === "worried" && (
          <g stroke="#2a1f45" strokeWidth="4" strokeLinecap="round" fill="none">
            <path d="M62 66 82 72" />
            <path d="M138 66 118 72" />
          </g>
        )}
        {mood === "shocked" && (
          <g stroke="#2a1f45" strokeWidth="4" strokeLinecap="round" fill="none">
            <path d="M62 62q10-8 20-2" />
            <path d="M118 60q10-6 20 2" />
          </g>
        )}

        {/* eyes */}
        {eyesClosed ? (
          <g stroke="#2a1f45" strokeWidth="5" strokeLinecap="round" fill="none">
            <path d="M64 92q12 9 24 0" />
            <path d="M112 92q12 9 24 0" />
          </g>
        ) : (
          <g className="eyes">
            <ellipse cx="76" cy="90" rx={mood === "shocked" ? 17 : 15} ry={mood === "shocked" ? 19 : 17} fill="#1f1736" />
            {mood === "wink" ? (
              <path d="M112 92q12-9 24 0" stroke="#1f1736" strokeWidth="5" strokeLinecap="round" fill="none" />
            ) : (
              <ellipse cx="124" cy="90" rx={mood === "shocked" ? 17 : 15} ry={mood === "shocked" ? 19 : 17} fill="#1f1736" />
            )}
            <circle cx="81" cy="83" r="5.5" fill="#fff" />
            <circle cx="72" cy="96" r="2.4" fill="#fff" opacity="0.8" />
            {mood !== "wink" && (
              <>
                <circle cx="129" cy="83" r="5.5" fill="#fff" />
                <circle cx="120" cy="96" r="2.4" fill="#fff" opacity="0.8" />
              </>
            )}
          </g>
        )}

        {/* mouth */}
        <g stroke="#2a1f45" strokeWidth="4" strokeLinecap="round" fill="none">
          {mood === "happy" && <path d="M90 116q10 9 20 0" />}
          {mood === "wink" && <path d="M88 115q12 11 24 0" />}
          {mood === "calm" && <path d="M92 118q8 4 16 0" />}
          {mood === "worried" && <path d="M90 122q10-8 20 0" />}
          {mood === "sleepy" && <path d="M95 118h10" />}
        </g>
        {mood === "shocked" && <ellipse cx="100" cy="121" rx="7" ry="9" fill="#2a1f45" />}
        {mood === "party" && <path d="M86 114q14 18 28 0Z" fill="#2a1f45" />}

        {/* arms */}
        {mood === "party" ? (
          <g fill={mid} filter={`url(#${id("fur")})`}>
            <ellipse cx="34" cy="96" rx="9" ry="20" transform="rotate(-35 34 96)" />
            <ellipse cx="166" cy="96" rx="9" ry="20" transform="rotate(35 166 96)" />
          </g>
        ) : (
          <g fill={dark} opacity="0.9" filter={`url(#${id("fur")})`}>
            <ellipse cx="40" cy="132" rx="8" ry="15" transform="rotate(18 40 132)" />
            <ellipse cx="160" cy="132" rx="8" ry="15" transform="rotate(-18 160 132)" />
          </g>
        )}
      </g>

      {mood === "sleepy" && (
        <g fill="#8e86b8" fontWeight="900" fontFamily="Nunito, sans-serif">
          <text x="150" y="40" fontSize="20">z</text>
          <text x="166" y="24" fontSize="14">z</text>
        </g>
      )}
    </svg>
  );
}
