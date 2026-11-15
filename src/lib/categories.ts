import type { Category } from "./types";

export const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  accommodation: { label: "Accommodation", color: "#173B2F" },
  food: { label: "Food & Drinks", color: "#C8913A" },
  transport: { label: "Transport", color: "#3D5A99" },
  activities: { label: "Activities", color: "#2C6E6A" },
  shopping: { label: "Shopping", color: "#7A3E62" },
  other: { label: "Other", color: "#8A938D" },
};
