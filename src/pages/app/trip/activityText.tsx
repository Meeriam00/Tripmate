import {
  LuArchive,
  LuArchiveRestore,
  LuCircleCheck,
  LuCircleX,
  LuPencil,
  LuPlane,
  LuSend,
  LuTrash2,
  LuUndo2,
  LuUserMinus,
  LuUserPlus,
} from "react-icons/lu";
import { genitive } from "../../../lib/az";
import type { Activity } from "../../../lib/types";
import { CategoryTile } from "../../../ui/kit";
import type { TripCtx } from "./context";

/** One human sentence per activity, e.g. "Məryəm «Otel» xərcini əlavə etdi". */
export function activityText(a: Activity, c: Pick<TripCtx, "nameOf">): string {
  const who = a.actor ? c.nameOf(a.actor) : "Sistem";
  const t = a.data.title ? `«${a.data.title}»` : "";
  const name = (id?: string) => (id ? c.nameOf(id) : "—");
  switch (a.kind) {
    case "trip_created":
      return `${who} səfəri yaratdı`;
    case "trip_updated":
      return `${who} səfər məlumatlarını yenilədi`;
    case "trip_archived":
      return `${who} səfəri arxivlədi`;
    case "trip_unarchived":
      return `${who} səfəri arxivdən çıxardı`;
    case "member_added":
      return `${who} ${name(a.data.memberId)} adlı iştirakçını əlavə etdi`;
    case "member_joined":
      return `${name(a.data.memberId)} səfərə qoşuldu`;
    case "member_removed":
      return `${who} ${name(a.data.memberId)} adlı iştirakçını çıxardı`;
    case "expense_added":
      return `${who} ${t} xərcini əlavə etdi`;
    case "expense_updated":
      return `${who} ${t} xərcini dəyişdi`;
    case "expense_deleted":
      return `${who} ${t} xərcini sildi`;
    case "payment_sent":
      return `${name(a.data.from)} → ${name(a.data.to)}: ödəniş göndərildi, təsdiq gözləyir`;
    case "payment_confirmed":
      return `${name(a.data.to)} ${genitive(name(a.data.from)).replace(/^Sənin$/, "sənin")} ödənişini təsdiqlədi`;
    case "payment_rejected":
      return `${name(a.data.to)} ödənişin çatmadığını bildirdi (${name(a.data.from)})`;
    case "payment_cancelled":
      return `${who} ödəniş qeydini ləğv etdi`;
  }
}

export function ActivityIcon({ a }: { a: Activity }) {
  if ((a.kind === "expense_added" || a.kind === "expense_updated") && a.data.category) return <CategoryTile category={a.data.category} size={42} />;
  const map = {
    expense_deleted: [LuTrash2, "rose"],
    expense_added: [LuPencil, "lav"],
    expense_updated: [LuPencil, "lav"],
    trip_created: [LuPlane, "lav"],
    trip_updated: [LuPencil, "lav"],
    trip_archived: [LuArchive, ""],
    trip_unarchived: [LuArchiveRestore, ""],
    member_added: [LuUserPlus, "mint"],
    member_joined: [LuUserPlus, "mint"],
    member_removed: [LuUserMinus, "rose"],
    payment_sent: [LuSend, "warm"],
    payment_confirmed: [LuCircleCheck, "mint"],
    payment_rejected: [LuCircleX, "rose"],
    payment_cancelled: [LuUndo2, ""],
  } as const;
  const [I, tone] = map[a.kind];
  return (
    <span className={`act-icon ${tone}`}>
      <I />
    </span>
  );
}
