import { useMemo, useRef, useState, type FormEvent } from "react";
import { LuArrowLeft, LuTrash2, LuUserPlus, LuX } from "react-icons/lu";
import { AppBar, Shell } from "../components/Shell";
import { useToast } from "../components/Toast";
import { Button, ConfirmDialog, Field, IconButton, LinkButton, PersonTile, TextInput, Tile, cx, inputClass } from "../components/ui";
import { CURRENCIES } from "../lib/money";
import { uid } from "../lib/storage";
import type { Trip } from "../lib/types";
import { href, navigate } from "../state/router";
import { useStore } from "../state/store";
import { NotFound } from "./NotFound";

interface Row {
  id: string;
  name: string;
  isNew: boolean;
}

const EXAMPLES = ["Məryəm", "Əli", "Leyla", "Murad", "Aysel"];

export function TripForm({ tripId }: { tripId?: string }) {
  const { getTrip, dispatch } = useStore();
  const toast = useToast();
  const existing = tripId ? getTrip(tripId) : undefined;
  const editing = !!existing;

  const [name, setName] = useState(existing?.name ?? "");
  const [destination, setDestination] = useState(existing?.destination ?? "");
  const [currency, setCurrency] = useState(existing?.currency ?? "AZN");
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

  if (tripId && !existing) return <NotFound what="trip" />;

  const used = new Set(existing?.expenses.flatMap((e) => [e.paidBy, ...e.participantIds]) ?? []);
  const named = rows.filter((r) => r.name.trim());
  const errors = {
    name: !name.trim() ? "Səyahətə ad verin" : null,
    people: rows.some((r) => !r.isNew && !r.name.trim())
      ? "Mövcud iştirakçının adını boş qoymaq olmaz"
      : named.length < 2
        ? "Ən azı iki nəfər əlavə edin"
        : dupes.size
          ? "İki nəfərin adı eynidir. Onları fərqləndirin, məsələn: «Əli M.»"
          : null,
  };
  const valid = !errors.name && !errors.people;

  function addRow() {
    const id = uid("p-");
    setRows((r) => [...r, { id, name: "", isNew: true }]);
    setTimeout(() => inputs.current.get(id)?.focus(), 0);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) {
      setTimeout(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus(), 0);
      return;
    }
    const trip: Trip = {
      ...(existing ?? { id: uid("t-"), expenses: [], createdAt: Date.now(), updatedAt: Date.now() }),
      name: name.trim(),
      destination: destination.trim(),
      currency,
      participants: rows.filter((r) => r.name.trim() || !r.isNew).map((r) => ({ id: r.id, name: r.name.trim().replace(/\s+/g, " ") })),
    };
    dispatch({ type: "trip/save", trip });
    toast.show(editing ? "Dəyişikliklər yadda saxlanıldı" : "Səyahət yaradıldı. İndi ilk xərci əlavə edin.");
    navigate({ name: "trip", id: trip.id, tab: "expenses" }, { replace: true });
  }

  const back = existing ? href({ name: "trip", id: existing.id, tab: "expenses" }) : href({ name: "home" });

  return (
    <Shell
      top={
        <AppBar
          left={
            <a href={back} aria-label="Geri qayıt" className="inline-flex size-10 items-center justify-center rounded-full hover:bg-ink/[0.06]">
              <LuArrowLeft className="size-5" aria-hidden />
            </a>
          }
          title={editing ? "Səyahət ayarları" : "Yeni səyahət"}
        />
      }
    >
      <form onSubmit={submit} noValidate className="px-5 pt-7 sm:px-7">
        <div className="space-y-5">
          <Field label="Səyahətin adı" htmlFor="t-name" error={submitted ? errors.name : null}>
            <TextInput
              id="t-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Məsələn, Qəbələ həftəsonu"
              maxLength={60}
              autoComplete="off"
              autoFocus={!editing}
              invalid={submitted && !!errors.name}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-[1fr_11rem]">
            <Field label="İstiqamət" htmlFor="t-dest" optional>
              <TextInput id="t-dest" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Məsələn, Qəbələ" maxLength={60} autoComplete="off" />
            </Field>
            <Field label="Valyuta" htmlFor="t-cur" hint={existing?.expenses.length ? "Xərclər əlavə edildikdən sonra dəyişmir" : undefined}>
              <select
                id="t-cur"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={!!existing?.expenses.length}
                className={cx(inputClass, "appearance-none disabled:bg-mist disabled:text-ink-2")}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.symbol}  {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div className="mt-9 flex items-baseline justify-between border-b-2 border-sun pb-3">
          <h2 className="text-[1rem] font-semibold">Dostlar</h2>
          <span className="text-[0.8rem] font-medium text-ink-2">{named.length} nəfər</span>
        </div>
        <ul className="divide-y divide-line">
          {rows.map((r, i) => {
            const locked = !r.isNew && used.has(r.id);
            const dupe = dupes.has(r.name.trim().toLocaleLowerCase("az"));
            return (
              <li key={r.id} className="flex items-center gap-3 py-3">
                {r.name.trim() ? (
                  <PersonTile name={r.name} size={44} />
                ) : (
                  <Tile size={44}>
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
                  className="border-transparent bg-mist hover:border-line"
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
        {submitted && errors.people && (
          <p role="alert" className="mt-1 text-[0.82rem] font-medium text-owe">
            {errors.people}
          </p>
        )}
        <Button variant="soft" icon={<LuUserPlus aria-hidden />} onClick={addRow} className="mt-4">
          Dost əlavə et
        </Button>

        <div className="mt-10 flex flex-col gap-3">
          <Button type="submit" size="lg" variant="sun" className="w-full">
            {editing ? "Yadda saxla" : "Səyahəti yarat"}
          </Button>
          <LinkButton href={back} variant="ghost" size="lg" className="w-full">
            Ləğv et
          </LinkButton>
          {editing && (
            <Button variant="ghost" icon={<LuTrash2 aria-hidden />} onClick={() => setConfirmDelete(true)} className="mt-2 self-center text-owe hover:bg-owe/10 hover:text-owe">
              Səyahəti sil
            </Button>
          )}
        </div>
      </form>

      {existing && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title="Səyahət silinsin?"
          body={`«${existing.name}» və onun bütün xərcləri bu brauzerdən silinəcək. Bu əməliyyatı geri qaytarmaq mümkün deyil.`}
          confirmLabel="Səyahəti sil"
          onConfirm={() => {
            dispatch({ type: "trip/delete", id: existing.id });
            toast.show("Səyahət silindi");
            navigate({ name: "home" }, { replace: true });
          }}
        />
      )}
    </Shell>
  );
}

/** Azerbaijani ordinal suffix: 1-ci, 2-ci, 3-cü, 4-cü, 5-ci, 6-cı, 9-cu, 10-cu… */
export function suffix(n: number): string {
  const last = n % 10;
  const tens = n % 100;
  if (n === 0) return "-cı";
  if (last === 0) {
    if ([10, 30].includes(tens)) return "-cu";
    if ([20, 50, 70, 80].includes(tens)) return "-ci";
    if ([40, 60, 90].includes(tens)) return "-cı";
    return "-cü";
  }
  if ([1, 2, 5, 7, 8].includes(last)) return "-ci";
  if ([3, 4].includes(last)) return "-cü";
  if (last === 6) return "-cı";
  return "-cu"; // 9
}
