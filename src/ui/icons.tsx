import { LuBedDouble, LuBus, LuCircleEllipsis, LuShoppingBag, LuTicket, LuUtensils } from "react-icons/lu";
import type { Category } from "../lib/types";

const ICON: Record<Category, typeof LuBedDouble> = {
  stay: LuBedDouble,
  food: LuUtensils,
  transport: LuBus,
  fun: LuTicket,
  shopping: LuShoppingBag,
  other: LuCircleEllipsis,
};

export function CategoryIcon({ category }: { category: Category }) {
  const I = ICON[category];
  return <I aria-hidden />;
}
