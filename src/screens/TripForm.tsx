import { useMemo, useRef, useState, type FormEvent } from "react";
import { LuArrowLeft, LuTrash2, LuUserPlus, LuX } from "react-icons/lu";
import { useToast } from "../components/Toast";
import { TopBar } from "../components/TopBar";
import { Avatar, Button, ConfirmDialog, Field, IconButton, LinkButton, Panel, Select, TextInput } from "../components/ui";
import { AVATAR_COLORS, nextColor } from "../lib/avatars";
import { addDays, isValidISO, todayISO } from "../lib/dates";
import { COMMON_CURRENCIES } from "../lib/money";
import { uid } from "../lib/storage";
import { participantInvolvement } from "../lib/trip";
import type { Participant, Trip } from "../lib/types";
import { navigate } from "../state/router";
import { useStore } from "../state/store";

interface Row {
  id: string;
  name: string;
  color: number;
  isNew: boolean;
}

const EXAMPLE_NAMES = ["Maryam", "Ali", "Leyla", "Murad", "Aysel"];

export function TripForm({ tripId }: { tripId?: string }) {
  const { getTrip, dispatch, trips } = useStore();
  const toast = useToast();
  const existing = tripId ? getTrip(tripId) : undefined;
  const editing = !!existing;

  const [name, setName] = useState(existing?.name ?? "");
  const [destination, setDestination] = useState(existing?.destination ?? "");
  const [start, setStart] = useState(existing?.startDate ?? todayISO());
  const [end, setEnd] = useState(existing?.endDate ?? addDays(todayISO(), 4));
  const [currency, setCurrency] = useState(existing?.currency ?? "EUR");
  const [rows, setRows] = useState<Row[]>(() =>
    existing
      ? existing.participants.map((p) => ({ ...p, isNew: false }))
      : [0, 1, 2, 3, 4].map((i) => ({ id: uid("p-"), name: "", color: i === 4 ? 5 : i, isNew: true })),
  );
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nameRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const named = rows.filter((r) => r.name.trim());
  const dupes = useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of rows) {
      const k = r.name.trim().toLowerCase();
      if (k) seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    return new Set([...seen].filter(([, c]) => c > 1).map(([k]) => k));
  }, [rows]);

  if (tripId && !existing) {
    return (
      <>
        <TopBar />
        <main id="main" className="mx-auto max-w-xl px-6 py-24 text-center">
          <h1 className="font-display text-3xl font-medium">This trip isn't in this browser</h1>
          <p className="mt-2 text-ink-2">It may have been deleted, or it was created on another device.</p>
          <LinkButton href="#/" variant="primary" className="mt-6">
            Back to your trips
          </LinkButton>
        </main>
      </>
    );
  }


  const errors = {
    destination: !destination.trim() ? "Where are you going?" : null,
    name: null as string | null,
    start: !isValidISO(start) ? "Pick a start date" : null,
    end: !isValidISO(end) ? "Pick an end date" : isValidISO(start) && end < start ? "The trip can't end before it starts" : null,
    people:
      named.length < 2
        ? "Add at least two people to split with"
        : dupes.size
          ? "Two people have the same name. Add an initial so balances stay clear."
          : editing && rows.some((r) => !r.isNew && !r.name.trim())
            ? "Existing participants need a name"
            : null,
  };
  const valid = Object.values(errors).every((e) => !e);
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : null);

  const hasExpenses = !!existing && existing.expenses.length > 0;

  function addRow() {
    const id = uid("p-");
    setRows((r) => [...r, { id, name: "", color: nextColor(r.map((x) => x.color)), isNew: true }]);
    setTimeout(() => nameRefs.current.get(id)?.focus(), 0);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) {
      const first = document.querySelector<HTMLElement>("[aria-invalid=true]");
      first?.focus();
      return;
    }
    const participants: Participant[] = rows
      .filter((r) => r.name.trim() || !r.isNew)
      .map((r) => ({ id: r.id, name: r.name.trim().replace(/\s+/g, " "), color: r.color }));
    const trip: Trip = {
      ...(existing ?? { id: uid("t-"), expenses: [], payments: [], createdAt: Date.now(), updatedAt: Date.now() }),
      name: name.trim() || destination.trim().split(",")[0],
      destination: destination.trim(),
      startDate: start,
      endDate: end,
      currency,
      participants,
    } as Trip;
    dispatch({ type: "trip/upsert", trip });
    toast.show(editing ? "Trip updated" : `${trip.name} is ready. Add the first expense.`);
    navigate({ name: "trip", id: trip.id, tab: editing ? "overview" : "expenses" }, { replace: true });
  }

  function deleteTrip() {
    if (!existing) return;
    const index = trips.findIndex((t) => t.id === existing.id);
    dispatch({ type: "trip/delete", id: existing.id });
    navigate({ name: "home" }, { replace: true });
    toast.show(`Deleted ${existing.name}`, {
      tone: "info",
      action: { label: "Undo", run: () => dispatch({ type: "trip/restore", trip: existing, index }) },
    });
  }

  return (
    <>
      <TopBar />
      <main id="main" className="mx-auto max-w-3xl px-4 pt-8 pb-24 sm:px-6 sm:pt-12">
        <a
          href={existing ? `#/trip/${existing.id}` : "#/"}
          className="inline-flex items-center gap-1.5 rounded-md text-[0.88rem] font-medium text-ink-2 hover:text-ink"
        >
          <LuArrowLeft aria-hidden /> {existing ? existing.name : "Back"}
        </a>
        <h1 className="mt-4 font-display text-[clamp(2.4rem,6vw,3.4rem)] leading-none font-medium tracking-[-0.02em]">
          {editing ? "Trip settings" : "Where to?"}
        </h1>
        {!editing && <p className="mt-3 text-ink-2">The basics now. You can change any of this later.</p>}

        <form onSubmit={submit} noValidate className="mt-10 space-y-6">
          <Panel className="space-y-5 p-5 sm:p-7">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Destination" htmlFor="dest" error={show("destination")}>
                <TextInput
                  id="dest"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Lisbon, Portugal"
                  autoFocus={!editing}
                  invalid={!!show("destination")}
                  autoComplete="off"
                />
              </Field>
              <Field label="Trip name" htmlFor="tname" optional hint="Defaults to the destination">
                <TextInput
                  id="tname"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={destination.trim() ? `${destination.split(",")[0].trim()} with friends` : "Lisbon long weekend"}
                  autoComplete="off"
                />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-[1fr_1fr_0.8fr]">
              <Field label="Starts" htmlFor="start" error={show("start")}>
                <TextInput
                  id="start"
                  type="date"
                  value={start}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStart(v);
                    if (isValidISO(v) && end < v) setEnd(v);
                  }}
                  invalid={!!show("start")}
                />
              </Field>
              <Field label="Ends" htmlFor="end" error={show("end")}>
                <TextInput id="end" type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} invalid={!!show("end")} />
              </Field>
              <Field
                label="Currency"
                htmlFor="cur"
                hint={hasExpenses ? "Locked once expenses exist" : "Expenses in other currencies can be converted"}
              >
                <Select id="cur" value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={hasExpenses}>
                  {COMMON_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Panel>

          <Panel className="p-5 sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-[1.6rem] leading-tight font-medium">Who's coming</h2>
                <p className="mt-1 text-[0.9rem] text-ink-2">Tap an avatar to change its colour.</p>
              </div>
              {!editing && rows.every((r) => !r.name.trim()) && (
                <Button
                  size="sm"
                  variant="quiet"
                  onClick={() => setRows((rs) => rs.map((r, i) => ({ ...r, name: EXAMPLE_NAMES[i] ?? r.name })))}
                >
                  Use example names
                </Button>
              )}
            </div>

            <ul className="mt-5 space-y-2.5">
              {rows.map((r, i) => {
                const involvement = existing && !r.isNew ? participantInvolvement(existing, r.id) : null;
                const dupe = dupes.has(r.name.trim().toLowerCase());
                return (
                  <li key={r.id} className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, color: (x.color + 1) % AVATAR_COLORS.length } : x)))
                      }
                      aria-label={`Change colour for ${r.name || `person ${i + 1}`}`}
                      className="rounded-full transition-transform hover:scale-105 active:scale-95"
                    >
                      <Avatar person={{ name: r.name || String(i + 1), color: r.color }} size={40} />
                    </button>
                    <TextInput
                      ref={(el) => {
                        if (el) nameRefs.current.set(r.id, el);
                        else nameRefs.current.delete(r.id);
                      }}
                      value={r.name}
                      onChange={(e) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (i === rows.length - 1) addRow();
                          else nameRefs.current.get(rows[i + 1].id)?.focus();
                        }
                      }}
                      placeholder={EXAMPLE_NAMES[i] ? `e.g. ${EXAMPLE_NAMES[i]}` : "Name"}
                      aria-label={`Person ${i + 1} name`}
                      invalid={submitted && (dupe || (!r.isNew && !r.name.trim()))}
                      maxLength={40}
                      autoComplete="off"
                    />
                    <IconButton
                      label={involvement ? `Can't remove: ${involvement}` : `Remove ${r.name || `person ${i + 1}`}`}
                      disabled={!!involvement || rows.length <= 2}
                      onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                    >
                      <LuX className="size-4.5" aria-hidden />
                    </IconButton>
                  </li>
                );
              })}
            </ul>
            {show("people") && (
              <p role="alert" className="mt-3 text-[0.84rem] font-medium text-owe">
                {errors.people}
              </p>
            )}
            {editing && existing!.participants.some((p) => participantInvolvement(existing!, p.id)) && (
              <p className="mt-3 text-[0.82rem] text-ink-3">
                People with expenses or payments can be renamed but not removed. Delete or reassign their expenses first.
              </p>
            )}
            <Button variant="ghost" size="sm" className="mt-4" icon={<LuUserPlus aria-hidden />} onClick={addRow}>
              Add person
            </Button>
          </Panel>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            {editing ? (
              <Button variant="quiet" icon={<LuTrash2 aria-hidden />} onClick={() => setConfirmDelete(true)} className="text-owe hover:text-owe">
                Delete trip
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <LinkButton href={existing ? `#/trip/${existing.id}` : "#/"} variant="ghost" size="lg">
                Cancel
              </LinkButton>
              <Button type="submit" variant="primary" size="lg" className="flex-1 sm:flex-none">
                {editing ? "Save changes" : "Create trip"}
              </Button>
            </div>
          </div>
        </form>
      </main>
      {existing && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={deleteTrip}
          title={`Delete ${existing.name}?`}
          body={`All ${existing.expenses.length} expenses and ${existing.payments.length} recorded payments will be removed from this browser.`}
          confirmLabel="Delete trip"
        />
      )}
    </>
  );
}
