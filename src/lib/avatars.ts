/**
 * Avatar palette. Eight colours chosen to stay distinguishable from each
 * other (and from the forest/marigold brand colours) on cream paper, each
 * with AA-contrast initials.
 */
export const AVATAR_COLORS: { bg: string; fg: string; name: string }[] = [
  { bg: "#2C6E6A", fg: "#F3F0E7", name: "Lagoon" },
  { bg: "#C8913A", fg: "#1D1A12", name: "Ochre" },
  { bg: "#7A3E62", fg: "#F7EDF2", name: "Fig" },
  { bg: "#3D5A99", fg: "#EEF1F8", name: "Azulejo" },
  { bg: "#6E8A3A", fg: "#F3F6EA", name: "Olive" },
  { bg: "#C2564B", fg: "#FBEFEC", name: "Coral" },
  { bg: "#4E4A63", fg: "#EFEEF4", name: "Slate" },
  { bg: "#D9B8A2", fg: "#3A2A20", name: "Sand" },
];

export function avatarColor(index: number) {
  return AVATAR_COLORS[((index % AVATAR_COLORS.length) + AVATAR_COLORS.length) % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).replace(/^./, (c) => c.toUpperCase());
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Pick the first palette slot not already used in the trip. */
export function nextColor(used: number[]): number {
  for (let i = 0; i < AVATAR_COLORS.length; i++) if (!used.includes(i)) return i;
  return used.length % AVATAR_COLORS.length;
}
