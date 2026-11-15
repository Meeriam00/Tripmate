import { useState } from "react";
import { LuChevronRight } from "react-icons/lu";
import { formatDayLong } from "../../../lib/dates";
import type { Activity } from "../../../lib/types";
import { Link } from "../../../state/router";
import { Empty } from "../../../ui/kit";
import { ActivityIcon, activityText } from "./activityText";
import { useTripCtx } from "./context";

const FILTERS = [
  { key: "all", label: "Hamısı" },
  { key: "expense", label: "Xərclər" },
  { key: "payment", label: "Ödənişlər" },
  { key: "member", label: "İştirakçılar" },
] as const;

/** Every important trip action, newest first, grouped by day. */
export function ActivityPage() {
  const c = useTripCtx();
  const [f, setF] = useState<(typeof FILTERS)[number]["key"]>("all");
  const expenseIds = new Set(c.bundle.expenses.map((e) => e.id));
  const items = c.bundle.activity.filter((a) => f === "all" || a.kind.startsWith(f) || (f === "member" && a.kind.startsWith("trip")));
  const groups = new Map<string, Activity[]>();
  for (const a of items) {
    const d = new Date(a.at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  return (
    <div className="activity">
      <div className="page-head">
        <div>
          <h2 className="page-title">Fəaliyyət tarixçəsi</h2>
          <p className="muted">Səfərdə baş verən hər şey, xronoloji ardıcıllıqla.</p>
        </div>
      </div>
      <div className="chips" style={{ marginBottom: 16 }}>
        {FILTERS.map((x) => (
          <button key={x.key} className={`chip ${f === x.key ? "on" : ""}`} aria-pressed={f === x.key} onClick={() => setF(x.key)}>
            {x.label}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <Empty mood="sleepy" size={100} title="Burada hələ heç nə yoxdur" />
      ) : (
        [...groups].map(([day, list]) => (
          <section key={day} className="day-group">
            <h3 className="day-title">{formatDayLong(day)}</h3>
            <div className="card list timeline">
              {list.map((a) => {
                const time = new Date(a.at);
                const link = a.data.expenseId && expenseIds.has(a.data.expenseId) ? `${c.base}/xercler/${a.data.expenseId}` : null;
                const body = (
                  <>
                    <ActivityIcon a={a} />
                    <div className="grow">
                      <div className="title wrap">{activityText(a, c)}</div>
                      <div className="sub num">
                        {String(time.getHours()).padStart(2, "0")}:{String(time.getMinutes()).padStart(2, "0")}
                      </div>
                    </div>
                    {a.data.amount ? <div className="amount">{c.money(a.data.amount)}</div> : null}
                    {link && <LuChevronRight className="faint" aria-hidden />}
                  </>
                );
                return link ? (
                  <Link key={a.id} to={link} className="list-row">
                    {body}
                  </Link>
                ) : (
                  <div key={a.id} className="list-row">
                    {body}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
