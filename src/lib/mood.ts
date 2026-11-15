import type { BudgetState } from "./ledger";
import { formatMoney } from "./money";

/**
 * What Tripo (the mascot) says on a trip's main page. The mood is a real
 * signal, not decoration: the colour and face follow the budget and the
 * user's own balance, and the line tells them the one thing worth knowing.
 */
export interface MoodInput {
  firstName: string;
  currency: string;
  budget: BudgetState;
  hasExpenses: boolean;
  myOutstanding: number;
  awaitingMyConfirmation: number;
  everyoneSettled: boolean;
}

export interface TripMood {
  mood: "happy" | "calm" | "worried" | "shocked" | "party" | "wink";
  color: "lilac" | "peach" | "mint";
  line: string;
}

export function tripMood(i: MoodInput): TripMood {
  const m = (v: number) => formatMoney(Math.abs(v), i.currency);
  if (i.awaitingMyConfirmation > 0)
    return { mood: "wink", color: "peach", line: `Sənə ${m(i.awaitingMyConfirmation)} gəldiyi deyilir. Pul çatıbsa, təsdiqlə!` };
  if (i.budget.level === "over")
    return { mood: "shocked", color: "peach", line: "Bu büdcə sınıb, yoxsa mənə elə gəlir?" };
  if (!i.hasExpenses)
    return { mood: "happy", color: "lilac", line: `Salam, ${i.firstName}! Mən Tripo. İlk xərci yaz, qalanını mən hesablayım.` };
  if (i.budget.level === "watch")
    return { mood: "worried", color: "peach", line: `Büdcənin ${Math.round((i.budget.ratio ?? 0) * 100)}%-i getdi. Bu axşam küçə yeməyi?` };
  if (i.everyoneSettled) return { mood: "party", color: "mint", line: "Hamı hesablaşıb. Dostluq xilas oldu!" };
  if (i.myOutstanding < 0) return { mood: "calm", color: "lilac", line: `Sənin ${m(i.myOutstanding)} borcun var. Tələsmə, amma unutma da.` };
  if (i.myOutstanding > 0) return { mood: "happy", color: "lilac", line: `Sənə ${m(i.myOutstanding)} qaytarılmalıdır. Hesabı mən saxlayıram.` };
  return { mood: "happy", color: "lilac", line: "Sən hesablaşmısan. Bir dondurma da olar!" };
}
