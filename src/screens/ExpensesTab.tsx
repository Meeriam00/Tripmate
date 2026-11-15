import { useMemo, useState } from "react";
import { LuFilterX, LuPencil, LuPlus, LuSearch, LuTrash2 } from "react-icons/lu";
import { CategoryGlyph, CategoryIcon } from "../components/CategoryIcon";
import { Avatar, AvatarStack, Button, EmptyState, IconButton, Money, Panel, Select, cx, inputBase } from "../components/ui";
import { CATEGORY_META } from "../lib/categories";
import { formatDay, formatShort } from "../lib/dates";
import { formatMoney, toInputValue } from "../lib/money";
import { splitParticipants } from "../lib/split";
import { CATEGORIES, type Category, type Expense } from "../lib/types";
import type { WorkspaceApi } from "./TripWorkspace";

type DateFilter = "all" | string;

export function ExpensesTab({ trip, openExpense, deleteExpense }: WorkspaceApi) {
  const [q, setQ] = useState("");
  const [cats, setCats] = useState<Category[]>([]);
  const [payer, setPayer] = useState("all");
  const [date, setDate] = useState<DateFilter>("all");
  const cur = trip.currency;
  const byId = new Map(trip.participants.map((p) => [p.id, p]));

  const dates = useMemo(() => [...new Set(trip.expenses.map((e) => e.date))].sort(), [trip.expenses]);
  const usedCats = useMemo(() => CATEGORIES.filter((c) => trip.expenses.some((e) => e.category === c)), [trip.expenses]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return trip.expenses
      .filter((e) => (cats.length ? cats.includes(e.category) : true))
      .filter((e) => (payer === "all" ? true : e.paidBy === payer))
      .filter((e) => (date === "all" ? true : e.date === date))
      .filter((e) => (needle ? `${e.title} ${e.note ?? ""}`.toLowerCase().includes(needle) : true))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }, [trip.expenses, q, cats, payer, date]);

  const groups = useMemo(() => {
    const m = new Map<string, Expense[]>();
    for (const e of filtered) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return [...m.entries()];
  }, [filtered]);

  const active = q.trim() !== "" || cats.length > 0 || payer !== "all" || date !== "all";
  const filteredTotal = filtered.reduce((s, e) => s + e.amount, 0);
  const clear = () => {
    setQ("");
    setCats([]);
    setPayer("all");
    setDate("all");
  };

  if (trip.expenses.length === 0) {
    return (
      <Panel>
        <EmptyState
          art={<CategoryIcon category="food" size={56} className="mb-5 rounded-2xl" />}
          title="No expenses yet"
          body="Add things as they happen: the apartment, the airport taxi, tonight's dinner. Balances update instantly."
          action={
            <Button variant="primary" size="lg" icon={<LuPlus aria-hidden />} onClick={() => openExpense()}>
              Add an expense
            </Button>
          }
        />
      </Panel>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <LuSearch className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search expenses"
            aria-label="Search expenses"
            className={cx(inputBase, "w-full pl-10")}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:flex">
          <Select value={payer} onChange={(e) => setPayer(e.target.value)} aria-label="Filter by payer" className="lg:w-48">
            <option value="all">Anyone paid</option>
            {trip.participants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} paid
              </option>
            ))}
          </Select>
          <Select value={date} onChange={(e) => setDate(e.target.value)} aria-label="Filter by date" className="lg:w-44">
            <option value="all">All days</option>
            {dates.map((d) => (
              <option key={d} value={d}>
                {formatDay(d)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-3 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by category">
        {usedCats.map((c) => {
          const on = cats.includes(c);
          return (
            <button
              key={c}
              aria-pressed={on}
              onClick={() => setCats((cs) => (on ? cs.filter((x) => x !== c) : [...cs, c]))}
              className={cx(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.84rem] font-medium ring-1 ring-inset transition-colors",
                on ? "bg-forest text-paper ring-forest" : "bg-card text-ink-2 ring-line hover:text-ink hover:ring-ink/30",
              )}
            >
              <CategoryGlyph category={c} className="size-3.5" />
              {CATEGORY_META[c].label}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-baseline justify-between gap-4 text-[0.88rem]">
        <p className="text-ink-2" aria-live="polite">
          {active ? `${filtered.length} of ${trip.expenses.length} expenses` : `${trip.expenses.length} expenses`},{" "}
          <span className="font-semibold text-ink tabular">{formatMoney(filteredTotal, cur)}</span>
        </p>
        {active && (
          <Button size="sm" variant="quiet" icon={<LuFilterX aria-hidden />} onClick={clear}>
            Clear filters
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <Panel className="mt-3">
          <EmptyState
            title="No expenses match"
            body="Try another search, or clear the filters to see everything."
            action={<Button onClick={clear}>Clear filters</Button>}
          />
        </Panel>
      ) : (
        <div className="mt-3 space-y-6">
          {groups.map(([day, list]) => (
            <section key={day} aria-labelledby={`d-${day}`}>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h3 id={`d-${day}`} className="font-display text-[1.15rem] font-medium text-ink">
                  {formatDay(day)}
                </h3>
                <span className="text-[0.82rem] text-ink-3 tabular">{formatMoney(list.reduce((s, e) => s + e.amount, 0), cur)}</span>
              </div>
              <Panel as="div" className="overflow-hidden">
                <ul className="divide-y divide-line/60">
                  {list.map((e) => {
                    const payerP = byId.get(e.paidBy);
                    const ids = splitParticipants(e.split);
                    const sharers = trip.participants.filter((p) => ids.includes(p.id));
                    const everyone = sharers.length === trip.participants.length;
                    return (
                      <li key={e.id} className="group relative flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-paper-2/40 sm:gap-4 sm:px-5">
                        <CategoryIcon category={e.category} size={40} />
                        <button onClick={() => openExpense(e)} className="min-w-0 flex-1 text-left after:absolute after:inset-0 after:content-['']" aria-label={`Edit ${e.title}`}>
                          <span className="block truncate text-[0.98rem] font-semibold text-ink">{e.title}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.82rem] text-ink-2">
                            <span className="inline-flex items-center gap-1.5">
                              {payerP && <Avatar person={payerP} size={18} />}
                              {payerP?.name ?? "Removed"} paid
                            </span>
                            <span className="text-ink-3" aria-hidden>
                              /
                            </span>
                            <span className="text-ink-3">
                              {CATEGORY_META[e.category].label}
                              <span className="sm:hidden">, {formatShort(e.date)}</span>
                            </span>
                          </span>
                        </button>
                        <div className="hidden items-center gap-2 md:flex">
                          <AvatarStack people={sharers} size={22} max={5} />
                          <span className="w-24 text-[0.8rem] text-ink-3">
                            {everyone ? "Everyone" : `${sharers.length} people`}
                            {e.split.mode !== "equal" && <span className="block">{e.split.mode === "exact" ? "exact amounts" : "by shares"}</span>}
                          </span>
                        </div>
                        <div className="text-right">
                          <Money value={e.amount} currency={cur} className="text-[0.98rem] font-semibold" />
                          {e.original && (
                            <span className="block text-[0.74rem] text-ink-3 tabular">
                              {toInputValue(e.original.amount, e.original.currency)} {e.original.currency}
                            </span>
                          )}
                        </div>
                        <div className="relative z-10 flex items-center opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                          <span className="hidden sm:block">
                            <IconButton label={`Edit ${e.title}`} onClick={() => openExpense(e)}>
                              <LuPencil className="size-4" aria-hidden />
                            </IconButton>
                          </span>
                          <IconButton label={`Delete ${e.title}`} onClick={() => deleteExpense(e)} className="hover:text-owe">
                            <LuTrash2 className="size-4" aria-hidden />
                          </IconButton>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
