import { LuBed, LuBus, LuEllipsis, LuPartyPopper, LuShoppingBag, LuUtensils } from "react-icons/lu";
import { CATEGORY } from "../lib/categories";
import type { Category } from "../lib/types";
import { Tile } from "./ui";

export const CATEGORY_ICON = {
  food: LuUtensils,
  stay: LuBed,
  transport: LuBus,
  fun: LuPartyPopper,
  shopping: LuShoppingBag,
  other: LuEllipsis,
} as const;

/** The reference's orange-rimmed tile, holding the category icon. */
export function CategoryTile({ category, size = 44 }: { category: Category; size?: number }) {
  const Icon = CATEGORY_ICON[category];
  return (
    <span data-tip={CATEGORY[category].label} aria-hidden="true" className="relative inline-flex shrink-0">
      <Tile size={size}>
        <Icon style={{ width: size * 0.45, height: size * 0.45 }} />
      </Tile>
    </span>
  );
}
