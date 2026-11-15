import type { Category } from "./types";

/** Expense categories — Azerbaijani labels and a palette drawn from the brand. */
export const CATEGORY: Record<Category, { label: string; short: string; color: string; tint: string }> = {
  stay: { label: "Qalacaq yer", short: "Qalacaq yer", color: "#8B5CF6", tint: "#EFE7FF" },
  food: { label: "Yemək və içki", short: "Yemək", color: "#FF8A3D", tint: "#FFEBDB" },
  transport: { label: "Nəqliyyat", short: "Nəqliyyat", color: "#3B9CE8", tint: "#E1F0FC" },
  fun: { label: "Əyləncə və fəaliyyətlər", short: "Əyləncə", color: "#EC4899", tint: "#FDE4F1" },
  shopping: { label: "Alış-veriş", short: "Alış-veriş", color: "#14B88A", tint: "#DDF6EE" },
  other: { label: "Digər", short: "Digər", color: "#8E8EA3", tint: "#EEEEF3" },
};

export const CATEGORY_ORDER: Category[] = ["stay", "food", "transport", "fun", "shopping", "other"];
