import type { Category } from "./types";

/** Category names (Azerbaijani) and chart colours drawn from the brand palette. */
export const CATEGORY: Record<Category, { label: string; color: string }> = {
  food: { label: "Yemək", color: "#FBB54C" },
  stay: { label: "Yaşayış", color: "#1B1B1B" },
  transport: { label: "Nəqliyyat", color: "#E07B39" },
  fun: { label: "Əyləncə", color: "#8C8C8C" },
  shopping: { label: "Alış-veriş", color: "#F7D59B" },
  other: { label: "Digər", color: "#D9D2C5" },
};

/** Display order in pickers. */
export const CATEGORY_ORDER: Category[] = ["food", "stay", "transport", "fun", "shopping", "other"];
