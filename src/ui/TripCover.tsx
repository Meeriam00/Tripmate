/**
 * A trip's cover. With a photo it shows the photo; without one it paints a
 * small landscape picked from the destination's name (sea, mountains or
 * city), so every trip card is recognisable at a glance.
 */
const SEA = /dəniz|sea|beach|nabran|antalya|bodrum|batumi|ital|roma|rome|nice|barselona|barcelona|maldiv|dubai|xəzər|lənkəran|bali|yunanıstan|greece|portu/i;
const MOUNTAIN = /dağ|qəbələ|gabala|şahdağ|shahdag|qusar|şəki|sheki|alp|tbilisi|gürcüstan|georgia|kazbeg|qax|zaqatala|isveçrə|swiss|nepal/i;

function kind(dest: string): "sea" | "mountain" | "city" {
  if (MOUNTAIN.test(dest)) return "mountain";
  if (SEA.test(dest)) return "sea";
  return "city";
}

export function TripCover({ src, destination, className = "", height }: { src?: string | null; destination: string; className?: string; height?: number }) {
  if (src) return <img className={`trip-cover ${className}`} src={src} alt="" style={{ height }} />;
  const k = kind(destination);
  return (
    <svg className={`trip-cover ${className}`} viewBox="0 0 320 140" preserveAspectRatio="xMidYMid slice" aria-hidden style={{ height }}>
      <defs>
        <linearGradient id={`sky-${k}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={k === "sea" ? "#ffd9b8" : k === "mountain" ? "#e5dafe" : "#ffe1cc"} />
          <stop offset="1" stopColor={k === "sea" ? "#fff2e6" : k === "mountain" ? "#f7f2ff" : "#f2ebff"} />
        </linearGradient>
      </defs>
      <rect width="320" height="140" fill={`url(#sky-${k})`} />
      <circle cx={k === "city" ? 70 : 240} cy="44" r="20" fill={k === "mountain" ? "#ffb574" : "#ff8a3d"} opacity="0.9" />
      {k === "sea" && (
        <>
          <path d="M0 92c40-10 80 10 120 0s80-12 120 0 60 8 80 2v46H0Z" fill="#b9a2f7" />
          <path d="M0 106c40-8 80 8 120 0s80-10 120 0 60 6 80 2v32H0Z" fill="#8b5cf6" opacity="0.8" />
          <path d="M0 122c50-6 90 6 140 0s100-6 180 0v18H0Z" fill="#7444e0" />
          <path d="M60 80l14-24 14 24Z" fill="#fff" opacity="0.9" />
          <path d="M74 56v26" stroke="#5b31b8" strokeWidth="2" />
        </>
      )}
      {k === "mountain" && (
        <>
          <path d="M-10 140 70 50l40 40 40-58 90 108Z" fill="#a586f3" />
          <path d="M150 32l18 22-10-4-8 10-8-10-8 4Z" fill="#fff" />
          <path d="M120 140l80-80 70 50 60-30v60Z" fill="#7444e0" />
          <path d="M0 128c60-12 140 4 200-4s90-6 120 0v16H0Z" fill="#5b31b8" />
          <path d="M40 130l8-18 8 18Zm20 2 6-14 6 14Z" fill="#2f1d6b" />
        </>
      )}
      {k === "city" && (
        <>
          <path d="M0 140V96h24V76h20v20h16V60h26v80Z" fill="#c4abfa" />
          <path d="M96 140V70l18-14 18 14v70Z" fill="#a586f3" />
          <path d="M140 140V48h30v92Zm38 0V84h22V66h20v74Z" fill="#8b5cf6" />
          <path d="M228 140V78h28v-16h20v78Zm56 0V92h36v48Z" fill="#7444e0" />
          <g fill="#fff" opacity="0.75">
            <rect x="146" y="58" width="6" height="8" rx="1" />
            <rect x="158" y="58" width="6" height="8" rx="1" />
            <rect x="146" y="74" width="6" height="8" rx="1" />
            <rect x="158" y="90" width="6" height="8" rx="1" />
            <rect x="236" y="88" width="6" height="8" rx="1" />
            <rect x="246" y="102" width="6" height="8" rx="1" />
          </g>
        </>
      )}
    </svg>
  );
}
