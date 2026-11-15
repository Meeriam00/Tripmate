import { LuBed, LuEllipsis, LuShoppingBag, LuTicket, LuTrainFront, LuUtensils } from "react-icons/lu";
import { CATEGORY_META } from "../lib/categories";
import type { Category } from "../lib/types";
import { cx } from "./ui";

const ICONS = {
  accommodation: LuBed,
  food: LuUtensils,
  transport: LuTrainFront,
  activities: LuTicket,
  shopping: LuShoppingBag,
  other: LuEllipsis,
} as const;

export function CategoryIcon({ category, size = 36, className }: { category: Category; size?: number; className?: string }) {
  const Icon = ICONS[category];
  const color = CATEGORY_META[category].color;
  return (
    <span
      aria-hidden
      className={cx("inline-flex shrink-0 items-center justify-center rounded-[0.7rem]", className)}
      style={{ width: size, height: size, background: `${color}17`, color }}
    >
      <Icon style={{ width: size * 0.48, height: size * 0.48 }} />
    </span>
  );
}

export function CategoryGlyph({ category, className }: { category: Category; className?: string }) {
  const Icon = ICONS[category];
  return <Icon className={className} aria-hidden />;
}
