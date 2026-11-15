import { Fragment, useMemo, useState } from "react";
import { LuChevronDown, LuFilterX, LuPencil, LuPlus, LuReceipt, LuSearch, LuTrash2 } from "react-icons/lu";
import { CATEGORY_ICON, CategoryTile } from "../components/CategoryIcon";
import { SectionTitle, useExpenseSheet } from "../components/Layout";
import { useToast } from "../components/Toast";
import { Button, ConfirmDialog, IconButton, Panel, PersonTile, Select, Tile, cx, inputClass } from "../components/ui";
import { categoryTotals, tripTotal } from "../lib/balances";
import { CATEGORY } from "../lib/categories";
import { formatDay, formatDayLong } from "../lib/dates";
import { formatMoney } from "../lib/money";
import { sharesFor } from "../lib/split";
import type { Category, Expense, Trip } from "../lib/types";
import { useStore } from "../state/store";

type Sort = "new" | "old" | "high" | "low";

export function ExpensesPage({ trip }: { trip: Trip }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const openSheet = useExpenseSheet();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "all">("all");
  const [payer, setPayer] = useState("all");
  const [day, setDay] = useState("all");
  const [sort, setSort] = useState<Sort>("new");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Expense | null>(null);
  const cur = trip.currency;
  const order = trip.participants.map((p) => p.id);
  const name = (id: string) => trip.participants.find((p) => p.id === id)?.name ?? "Silinmiş şəxs";

  const days = useMemo(() => [...new Set(trip.expenses.map((e) => e.date))].sort(), [trip.expenses]);
  const list = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("az");
    const out = trip.expenses.filter(
      (e) =>
        (cat === "all" || e.category === cat) &&
        (payer === "all" || e.paidBy === payer) &&
        (day === "all" || e.date === day) &&
        (!needle || `${e.title} ${e.note ?? ""}`.toLocaleLowerCase("az").includes(needle)),
    );
    const by: Record<Sort, (a: Expense, b: Expense) => number> = {
      new: (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
      old: (a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt,
      high: (a, b) => b.amount - a.amount,
      low: (a, b) => a.amount - b.amount,
    };
    return out.sort(by[sort]);
  }, [trip.expenses, q, cat, payer, day, sort]);

  const filtered = q.trim() !== "" || cat !== "all" || payer !== "all" || day !== "all";
  const shown = list.reduce((s, e) => s + e.amount, 0);
  const clear = () => {
    setQ("");
    setCat("all");
    setPayer("all");
    setDay("all");
  };

  const cats = useMemo(() => categoryTotals(trip), [trip]);
  const left = trip.budget ? trip.budget - tripTotal(trip) : null;
  const header = (
    <SectionTitle
      title="Xərclər"
      sub={
        trip.expenses.length
          ? `${trip.expenses.length} xərc, cəmi ${formatMoney(tripTotal(trip), cur)}${left === null ? "" : left >= 0 ? `. Büdcədən ${formatMoney(left, cur)} qalıb.` : `. Büdcə ${formatMoney(-left, cur)} aşılıb.`}`
          : "Səfər boyu edilən bütün ödənişlər"
      }
    />
  );

  if (trip.expenses.length === 0) {
    return (
      <>
        {header}
        <Panel>
          <div className="flex flex-col items-center px-8 py-20 text-center">
            <Tile size={64}>
              <LuReceipt className="size-7" />
            </Tile>
            <h2 className="mt-5 text-[1.15rem] font-semibold">Hələ xərc yoxdur</h2>
            <p className="mt-1.5 max-w-sm text-[0.92rem] text-ink-2">Benzin, ev kirayəsi, şam yeməyi: kimsə nəyəsə pul ödəyən kimi buraya yazın.</p>
            <Button className="mt-6" icon={<LuPlus aria-hidden />} onClick={() => openSheet()}>
              İlk xərci əlavə et
            </Button>
          </div>
        </Panel>
      </>
    );
  }

  return (
    <>
      {header}

      <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="relative">
          <LuSearch className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Xərc axtar" aria-label="Xərc axtar" className={cx(inputClass, "h-11 pl-11")} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:flex">
          <Select value={payer} onChange={(e) => setPayer(e.target.value)} aria-label="Ödəyən üzrə süzgəc" className="h-11 xl:w-[12rem]">
            <option value="all">Ödəyənlər</option>
            {trip.participants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select value={day} onChange={(e) => setDay(e.target.value)} aria-label="Tarix üzrə süzgəc" className="h-11 xl:w-[10.5rem]">
            <option value="all">Günlər</option>
            {days.map((d) => (
              <option key={d} value={d}>
                {formatDay(d)}
              </option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sıralama" className="h-11 max-sm:col-span-2 xl:w-[12rem]">
            <option value="new">Yenilər əvvəl</option>
            <option value="old">Köhnələr əvvəl</option>
            <option value="high">Ən bahalı</option>
            <option value="low">Ən ucuz</option>
          </Select>
        </div>
      </div>

      <div className="mb-5 -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Kateqoriya üzrə süzgəc">
        <button
          aria-pressed={cat === "all"}
          onClick={() => setCat("all")}
          className={cx("inline-flex shrink-0 items-center gap-2 rounded-full border-2 px-4 py-2 text-[0.86rem] font-medium transition-colors", cat === "all" ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-2 hover:border-sun-soft hover:text-ink")}
        >
          Hamısı <span className="tabular opacity-70">{formatMoney(tripTotal(trip), cur)}</span>
        </button>
        {cats.map((c) => {
          const Icon = CATEGORY_ICON[c.category];
          const on = cat === c.category;
          return (
            <button
              key={c.category}
              aria-pressed={on}
              onClick={() => setCat(on ? "all" : c.category)}
              className={cx("inline-flex shrink-0 items-center gap-2 rounded-full border-2 px-4 py-2 text-[0.86rem] font-medium transition-colors", on ? "border-sun bg-sun text-ink" : "border-line bg-white text-ink-2 hover:border-sun-soft hover:text-ink")}
            >
              <Icon className="size-4" aria-hidden />
              {CATEGORY[c.category].label}
              <span className="tabular opacity-70">{formatMoney(c.amount, cur)}</span>
            </button>
          );
        })}
      </div>

      <Panel
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 text-[0.86rem]">
            <span className="text-ink-2" aria-live="polite">
              {filtered ? `${list.length} / ${trip.expenses.length} xərc göstərilir` : `${list.length} xərc`}
            </span>
            <span className="font-semibold tabular">Cəmi: {formatMoney(shown, cur)}</span>
          </div>
        }
      >
        {filtered && (
          <div className="flex items-center justify-between gap-3 border-b border-line bg-cream-2/60 px-6 py-2.5 text-[0.84rem]">
            <span className="text-ink-2">Süzgəc tətbiq olunub</span>
            <button onClick={clear} className="inline-flex items-center gap-1.5 rounded font-semibold text-ink hover:text-sun-2">
              <LuFilterX className="size-4" aria-hidden /> Süzgəcləri təmizlə
            </button>
          </div>
        )}
        {list.length === 0 ? (
          <div className="px-8 py-14 text-center">
            <p className="font-semibold">Uyğun xərc tapılmadı</p>
            <p className="mt-1 text-[0.9rem] text-ink-2">Axtarışı dəyişin və ya süzgəcləri təmizləyin.</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="max-md:hidden">
              <tr className="border-b border-line text-[0.76rem] text-ink-3">
                <th scope="col" className="py-3 pl-6 font-medium">Xərc</th>
                <th scope="col" className="py-3 pr-4 font-medium">Tarix</th>
                <th scope="col" className="py-3 pr-4 font-medium">Ödəyən</th>
                <th scope="col" className="py-3 pr-4 font-medium max-xl:hidden">Bölgü</th>
                <th scope="col" className="py-3 pr-4 text-right font-medium">Məbləğ</th>
                <th scope="col" className="w-28 py-3 pr-6 max-md:hidden">
                  <span className="sr-only">Əməliyyatlar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => {
                const open = expanded === e.id;
                const shares = sharesFor(e, order);
                const everyone = e.participantIds.length === trip.participants.length;
                return (
                  <Fragment key={e.id}>
                    <tr className={cx("group border-b border-line transition-colors hover:bg-cream-2/60 max-md:flex max-md:flex-wrap max-md:items-center max-md:px-4 max-md:py-3", open && "bg-cream-2/60")}>
                      <td className="py-3.5 pl-6 max-md:flex-1 max-md:py-0 max-md:pl-0">
                        <button onClick={() => setExpanded(open ? null : e.id)} aria-expanded={open} className="flex w-full items-center gap-3.5 text-left">
                          <CategoryTile category={e.category} size={40} />
                          <span className="min-w-0">
                            <span className="block truncate text-[0.95rem] font-medium text-ink">{e.title}</span>
                            <span className="block truncate text-[0.76rem] text-ink-3">
                              {CATEGORY[e.category].label}
                              <span className="md:hidden">, {name(e.paidBy)} ödədi, {formatDay(e.date)}</span>
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="py-3.5 pr-4 text-[0.88rem] whitespace-nowrap text-ink-2 max-md:hidden">{formatDay(e.date)}</td>
                      <td className="py-3.5 pr-4 max-md:hidden">
                        <span className="flex items-center gap-2 text-[0.88rem] whitespace-nowrap">
                          <PersonTile name={name(e.paidBy)} size={28} />
                          {name(e.paidBy)}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-[0.84rem] whitespace-nowrap text-ink-2 max-xl:hidden">
                        {everyone ? "Hamı" : `${e.participantIds.length} nəfər`}
                        {e.custom && <span className="ml-2 rounded-full bg-sun-soft px-2 py-0.5 text-[0.72rem] font-semibold text-ink">fərdi</span>}
                      </td>
                      <td className="py-3.5 pr-4 text-right text-[0.95rem] font-semibold whitespace-nowrap tabular max-md:py-0 max-md:pr-0 max-md:pl-3">{formatMoney(e.amount, cur)}</td>
                      <td className="py-3.5 pr-6 max-md:hidden">
                        <div className="flex items-center justify-end gap-0.5 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                          <IconButton label={`Düzəlt: ${e.title}`} onClick={() => openSheet(e)} className="size-9 text-ink-2">
                            <LuPencil className="size-4" aria-hidden />
                          </IconButton>
                          <IconButton label={`Sil: ${e.title}`} onClick={() => setToDelete(e)} className="size-9 text-ink-2 hover:text-owe max-md:hidden">
                            <LuTrash2 className="size-4" aria-hidden />
                          </IconButton>
                          <IconButton label={open ? "Payları gizlət" : "Payları göstər"} onClick={() => setExpanded(open ? null : e.id)} className="size-9 text-ink-2">
                            <LuChevronDown className={cx("size-4 transition-transform", open && "rotate-180")} aria-hidden />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-b border-line bg-cream-2/60 max-md:block">
                        <td colSpan={6} className="px-6 pt-1 pb-4 max-md:block max-md:px-4">
                          <p className="mb-2.5 text-[0.8rem] text-ink-2">
                            {formatDayLong(e.date)}. {name(e.paidBy)} ödəyib, {e.custom ? "fərdi bölünüb" : "bərabər bölünüb"}.
                            {e.note && <span className="text-ink"> {e.note}</span>}
                          </p>
                          <ul className="flex flex-wrap gap-2" aria-label="Hər kəsin payı">
                            {trip.participants
                              .filter((p) => shares.has(p.id))
                              .map((p) => (
                                <li key={p.id} className="inline-flex items-center gap-2 rounded-full border border-sun-soft bg-white py-1 pr-3.5 pl-1 text-[0.84rem]">
                                  <PersonTile name={p.name} size={24} />
                                  {p.name}
                                  <b className="font-semibold tabular">{formatMoney(shares.get(p.id)!, cur)}</b>
                                </li>
                              ))}
                          </ul>
                          <div className="mt-3 flex gap-2">
                            <Button variant="soft" icon={<LuPencil className="size-4" aria-hidden />} className="h-9 px-4 text-[0.84rem]" onClick={() => openSheet(e)}>
                              Düzəlt
                            </Button>
                            <Button variant="ghost" icon={<LuTrash2 className="size-4" aria-hidden />} className="h-9 px-3 text-[0.84rem] text-owe hover:bg-owe/10 hover:text-owe" onClick={() => setToDelete(e)}>
                              Sil
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      {toDelete && (
        <ConfirmDialog
          open
          onClose={() => setToDelete(null)}
          title="Xərc silinsin?"
          body={`«${toDelete.title}» silinəcək və bütün hesablar yenidən aparılacaq.`}
          confirmLabel="Sil"
          onConfirm={() => {
            dispatch({ type: "expense/delete", tripId: trip.id, id: toDelete.id });
            toast.show("Xərc silindi");
          }}
        />
      )}
    </>
  );
}
