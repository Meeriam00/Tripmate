import { useMemo, useRef, useState, type FormEvent } from "react";
import { LuTrash2, LuUserPlus, LuX } from "react-icons/lu";
import { useToast } from "../components/Toast";
import { Button, ConfirmDialog, Field, IconButton, LinkButton, PersonTile, Select, TextInput, Tile, cx } from "../components/ui";
import { isISO } from "../lib/dates";
import { CURRENCIES, formatMoney, parseAmount, toInputValue } from "../lib/money";
import { defaultTripDates, uid } from "../lib/storage";
import type { Trip } from "../lib/types";
import { navigate } from "../state/router";
import { useStore } from "../state/store";

interface Row {
  id: string;
  name: string;
  isNew: boolean;
}

const EXAMPLES = ["Məryəm", "Əli", "Leyla", "Murad", "Aysel"];

/** Create a trip, or edit the active one: details, dates, budget and friends. */
export function TripForm({ existing, cancelHref }: { existing?: Trip; cancelHref: string }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const editing = !!existing;
  const dates = useMemo(defaultTripDates, []);

  const [name, setName] = useState(existing?.name ?? "");
  const [destination, setDestination] = useState(existing?.destination ?? "");
  const [startDate, setStart] = useState(existing?.startDate ?? dates.startDate);
  const [endDate, setEnd] = useState(existing?.endDate ?? dates.endDate);
  const [currency, setCurrency] = useState(existing?.currency ?? "AZN");
  const [budget, setBudget] = useState(existing?.budget ? toInputValue(existing.budget) : "");
  const [rows, setRows] = useState<Row[]>(() =>
    existing ? existing.participants.map((p) => ({ ...p, isNew: false })) : EXAMPLES.map(() => ({ id: uid("p-"), name: "", isNew: true })),
  );
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputs = useRef(new Map<string, HTMLInputElement>());

  const dupes = useMemo(() => {
    const count = new Map<string, number>();
    for (const r of rows) {
      const k = r.name.trim().toLocaleLowerCase("az");
      if (k) count.set(k, (count.get(k) ?? 0) + 1);
    }
    return new Set([...count].filter(([, c]) => c > 1).map(([k]) => k));
  }, [rows]);

  const used = new Set([...(existing?.expenses.flatMap((e) => [e.paidBy, ...e.participantIds]) ?? []), ...(existing?.payments.flatMap((p) => [p.from, p.to]) ?? [])]);
  const named = rows.filter((r) => r.name.trim());
  const budgetMinor = budget.trim() ? parseAmount(budget) : 0;
  const errors = {
    name: !name.trim() ? "Səfərə ad verin" : null,
    start: !isISO(startDate) ? "Başlama tarixini seçin" : null,
    end: !isISO(endDate) ? "Bitmə tarixini seçin" : isISO(startDate) && endDate < startDate ? "Səfər başlamazdan əvvəl bitə bilməz" : null,
    budget: budgetMinor === null ? "Büdcəni rəqəmlə yazın, məsələn: 1500" : null,
    people: rows.some((r) => !r.isNew && !r.name.trim())
      ? "Mövcud iştirakçının adını boş qoymaq olmaz"
      : named.length < 2
        ? "Ən azı iki nəfər əlavə edin"
        : dupes.size
          ? "İki nəfərin adı eynidir. Onları fərqləndirin, məsələn: «Əli M.»"
          : null,
  };
  const valid = Object.values(errors).every((e) => !e);
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : null);

  function addRow() {
    const id = uid("p-");
    setRows((r) => [...r, { id, name: "", isNew: true }]);
    setTimeout(() => inputs.current.get(id)?.focus(), 0);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) {
      setTimeout(() => document.querySelector<HTMLElement>("form [aria-invalid=true]")?.focus(), 0);
      return;
    }
    const trip: Trip = {
      ...(existing ?? { id: uid("t-"), expenses: [], payments: [], activity: [], createdAt: Date.now(), updatedAt: Date.now() }),
      name: name.trim(),
      destination: destination.trim(),
      startDate,
      endDate,
      currency,
      budget: budgetMinor || undefined,
      participants: rows.filter((r) => r.name.trim() || !r.isNew).map((r) => ({ id: r.id, name: r.name.trim().replace(/\s+/g, " ") })),
    };
    dispatch({ type: "trip/save", trip });
    toast.show(editing ? "Dəyişikliklər yadda saxlanıldı" : "Səfər yaradıldı. İndi ilk xərci əlavə edin.");
    navigate({ name: "trip", id: trip.id, tab: editing ? "overview" : "expenses" }, { replace: true });
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid gap-x-5 gap-y-5 px-6 pt-6 sm:grid-cols-2">
        <Field label="Səfərin adı" htmlFor="t-name" error={show("name")}>
          <TextInput id="t-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Məsələn, Qəbələ həftəsonu" maxLength={60} autoComplete="off" autoFocus={!editing} invalid={!!show("name")} />
        </Field>
        <Field label="İstiqamət" htmlFor="t-dest" optional>
          <TextInput id="t-dest" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Məsələn, Qəbələ" maxLength={60} autoComplete="off" />
        </Field>
        <Field label="Başlama tarixi" htmlFor="t-start" error={show("start")}>
          <TextInput
            id="t-start"
            type="date"
            value={startDate}
            onChange={(e) => {
              setStart(e.target.value);
              if (isISO(e.target.value) && endDate < e.target.value) setEnd(e.target.value);
            }}
            invalid={!!show("start")}
          />
        </Field>
        <Field label="Bitmə tarixi" htmlFor="t-end" error={show("end")}>
          <TextInput id="t-end" type="date" min={startDate} value={endDate} onChange={(e) => setEnd(e.target.value)} invalid={!!show("end")} />
        </Field>
        <Field label="Valyuta" htmlFor="t-cur" hint={existing?.expenses.length ? "Xərclər əlavə edildikdən sonra dəyişmir" : undefined}>
          <Select id="t-cur" value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={!!existing?.expenses.length} className="disabled:bg-mist disabled:text-ink-2">
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol}  {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Büdcə" htmlFor="t-budget" optional error={show("budget")} hint={budgetMinor ? `Ümumi büdcə: ${formatMoney(budgetMinor, currency)}` : "Xərclər büdcə ilə müqayisə ediləcək"}>
          <TextInput id="t-budget" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Məsələn, 1500" autoComplete="off" invalid={!!show("budget")} className="tabular" />
        </Field>
      </div>

      <div className="mx-6 mt-9 flex items-baseline justify-between border-b-2 border-sun pb-3">
        <h3 className="text-[1rem] font-semibold">İştirakçılar</h3>
        <span className="text-[0.82rem] font-medium text-ink-2">{named.length} nəfər</span>
      </div>
      <ul className="grid gap-x-6 px-6 sm:grid-cols-2">
        {rows.map((r, i) => {
          const locked = !r.isNew && used.has(r.id);
          const dupe = dupes.has(r.name.trim().toLocaleLowerCase("az"));
          return (
            <li key={r.id} className="flex items-center gap-3 border-b border-line py-3">
              {r.name.trim() ? (
                <PersonTile name={r.name} size={40} />
              ) : (
                <Tile size={40}>
                  <span className="text-ink-3">{i + 1}</span>
                </Tile>
              )}
              <TextInput
                ref={(el) => {
                  if (el) inputs.current.set(r.id, el);
                  else inputs.current.delete(r.id);
                }}
                value={r.name}
                onChange={(e) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)))}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  if (i === rows.length - 1) addRow();
                  else inputs.current.get(rows[i + 1].id)?.focus();
                }}
                placeholder={EXAMPLES[i] ? `Məsələn, ${EXAMPLES[i]}` : "Ad"}
                aria-label={`${i + 1}${suffix(i + 1)} dostun adı`}
                maxLength={30}
                autoComplete="off"
                invalid={submitted && (dupe || (!r.isNew && !r.name.trim()))}
                className="h-11 border-transparent bg-mist hover:border-line"
              />
              <IconButton
                label={locked ? "Bu şəxsin xərcləri var, onu silmək olmaz" : `Sil: ${r.name.trim() || `${i + 1}${suffix(i + 1)} dost`}`}
                disabled={locked || rows.length <= 2}
                onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                className="text-ink-3 hover:text-owe"
              >
                <LuX className="size-5" aria-hidden />
              </IconButton>
            </li>
          );
        })}
      </ul>
      <div className="px-6">
        {show("people") && (
          <p role="alert" className="mt-2 text-[0.82rem] font-medium text-owe">
            {errors.people}
          </p>
        )}
        <Button variant="soft" icon={<LuUserPlus aria-hidden />} onClick={addRow} className="mt-4">
          Dost əlavə et
        </Button>
      </div>

      <div className="mt-8 flex flex-col-reverse items-stretch gap-3 border-t border-line bg-cream-2/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        {editing ? (
          <Button variant="ghost" icon={<LuTrash2 aria-hidden />} onClick={() => setConfirmDelete(true)} className="text-owe hover:bg-owe/10 hover:text-owe">
            Səfəri sil
          </Button>
        ) : (
          <span />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <LinkButton href={cancelHref} variant="ghost">
            Ləğv et
          </LinkButton>
          <Button type="submit" variant="sun" className={cx("sm:min-w-48")}>
            {editing ? "Yadda saxla" : "Səfəri yarat"}
          </Button>
        </div>
      </div>

      {existing && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title="Səfər silinsin?"
          body={`«${existing.name}» və onun bütün xərcləri bu brauzerdən silinəcək. Bu əməliyyatı geri qaytarmaq mümkün deyil.`}
          confirmLabel="Səfəri sil"
          onConfirm={() => {
            dispatch({ type: "trip/delete", id: existing.id });
            toast.show("Səfər silindi");
            navigate({ name: "home" }, { replace: true });
          }}
        />
      )}
    </form>
  );
}

/** Azerbaijani ordinal suffix: 1-ci, 2-ci, 3-cü, 4-cü, 5-ci, 6-cı, 9-cu, 10-cu… */
export function suffix(n: number): string {
  const last = n % 10;
  const tens = n % 100;
  if (last === 0) {
    if ([10, 30].includes(tens)) return "-cu";
    if ([20, 50, 70, 80].includes(tens)) return "-ci";
    if ([40, 60, 90].includes(tens)) return "-cı";
    return "-cü";
  }
  if ([1, 2, 5, 7, 8].includes(last)) return "-ci";
  if ([3, 4].includes(last)) return "-cü";
  if (last === 6) return "-cı";
  return "-cu";
}
