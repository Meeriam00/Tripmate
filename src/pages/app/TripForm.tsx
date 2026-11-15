import { useState, type FormEvent } from "react";
import { LuArrowLeft, LuImagePlus, LuPlus, LuTrash2, LuX } from "react-icons/lu";
import { backend, type TripInput } from "../../backend";
import { todayISO, addDays } from "../../lib/dates";
import { CURRENCIES, currencySymbol, parseAmount, toInputValue } from "../../lib/money";
import type { Trip } from "../../lib/types";
import { participantNamesError, tripErrors } from "../../lib/validate";
import { Link, navigate, useTitle } from "../../state/router";
import { useSession } from "../../state/session";
import { compressImage } from "../../ui/image";
import { Button, Field, TextField, errorText, useToast } from "../../ui/kit";
import { Mascot } from "../../ui/Mascot";
import { TripCover } from "../../ui/TripCover";
import { InviteCard } from "./trip/InviteCard";

export function TripForm({ trip, onDone }: { trip?: Trip; onDone: (t: Trip) => void }) {
  const { profile } = useSession();
  const toast = useToast();
  const editing = !!trip;
  const [name, setName] = useState(trip?.name ?? "");
  const [destination, setDestination] = useState(trip?.destination ?? "");
  const [startDate, setStart] = useState(trip?.startDate ?? addDays(todayISO(), 7));
  const [endDate, setEnd] = useState(trip?.endDate ?? addDays(todayISO(), 10));
  const [currency, setCurrency] = useState(trip?.currency ?? profile?.currency ?? "AZN");
  const [budget, setBudget] = useState(trip?.budget ? toInputValue(trip.budget) : "");
  const [cover, setCover] = useState<string | null>(trip?.cover ?? null);
  const [people, setPeople] = useState<string[]>(["", ""]);
  const [errors, setErrors] = useState<Partial<Record<keyof TripInput | "people" | "form", string>>>({});
  const [busy, setBusy] = useState(false);

  async function pickCover(file: File | undefined) {
    if (!file) return;
    try {
      setCover(await compressImage(file, 1200, 0.75));
    } catch (e) {
      toast.err(errorText(e));
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const b = budget.trim() ? parseAmount(budget) : null;
    const input: TripInput = { name, destination, startDate, endDate, currency, budget: b, cover };
    const errs: typeof errors = tripErrors(input);
    if (budget.trim() && (b === null || b <= 0)) errs.budget = "Büdcəni rəqəmlə yazın, məsələn 2000.";
    if (!editing) {
      const pe = participantNamesError(people);
      if (pe) errs.people = pe;
    }
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      return;
    }
    setBusy(true);
    try {
      const coverUrl = cover && cover.startsWith("data:") ? await backend.uploadImage("cover", cover) : cover;
      if (editing) {
        await backend.updateTrip(trip.id, { ...input, cover: coverUrl });
        toast.ok("Səfər yeniləndi.");
        onDone({ ...trip, ...input, cover: coverUrl });
      } else {
        const t = await backend.createTrip({ ...input, cover: coverUrl }, people);
        onDone(t);
      }
    } catch (err) {
      setErrors({ form: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  const sym = currencySymbol(currency);

  return (
    <form className="form-grid trip-form" onSubmit={submit} noValidate>
      {errors.form && <div className="alert">{errors.form}</div>}

      <label className="cover-pick">
        <TripCover src={cover} destination={destination || name} />
        <span className="cover-pick-label">
          <LuImagePlus /> {cover ? "Şəkli dəyiş" : "Üz qabığı şəkli (istəyə bağlı)"}
        </span>
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickCover(e.target.files?.[0])} />
        {cover && (
          <button
            type="button"
            className="icon-btn cover-remove"
            aria-label="Şəkli sil"
            onClick={(e) => {
              e.preventDefault();
              setCover(null);
            }}
          >
            <LuX />
          </button>
        )}
      </label>

      <TextField label="Səfərin adı" placeholder="İtaliya yay səfəri" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={60} />
      <TextField label="Hara?" placeholder="Roma, İtaliya" value={destination} onChange={(e) => setDestination(e.target.value)} error={errors.destination} maxLength={80} />
      <div className="row-2">
        <TextField label="Başlanğıc" type="date" value={startDate} onChange={(e) => {
          setStart(e.target.value);
          if (endDate < e.target.value) setEnd(e.target.value);
        }} error={errors.startDate} />
        <TextField label="Bitmə" type="date" min={startDate} value={endDate} onChange={(e) => setEnd(e.target.value)} error={errors.endDate} />
      </div>
      <div className="row-2 stack-sm">
        <Field label="Əsas valyuta" htmlFor="trip-cur" error={errors.currency}>
          <select id="trip-cur" className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code} — {c.name}
              </option>
            ))}
          </select>
        </Field>
        <TextField label="Ümumi büdcə (istəyə bağlı)" inputMode="decimal" placeholder="2000" value={budget} onChange={(e) => setBudget(e.target.value)} error={errors.budget} suffix={sym} />
      </div>

      {!editing && (
        <Field label="İştirakçılar" error={errors.people} hint="Sən avtomatik əlavə olunursan. Dostların sonra dəvət linki ilə öz yerlərini tuta bilər.">
          <div className="people-rows">
            <div className="people-row me">
              <span className="input" aria-readonly>
                {[profile?.firstName, profile?.lastName].filter(Boolean).join(" ")} <span className="badge lav">Sən · admin</span>
              </span>
            </div>
            {people.map((p, i) => (
              <div className="people-row" key={i}>
                <input
                  className="input"
                  placeholder={`Dost ${i + 1}`}
                  value={p}
                  aria-label={`İştirakçı ${i + 1}`}
                  maxLength={40}
                  onChange={(e) => setPeople(people.map((x, k) => (k === i ? e.target.value : x)))}
                />
                <button type="button" className="icon-btn flat" aria-label="Sil" onClick={() => setPeople(people.filter((_, k) => k !== i))}>
                  <LuTrash2 />
                </button>
              </div>
            ))}
            <Button variant="soft" size="sm" onClick={() => setPeople([...people, ""])} disabled={people.length >= 29}>
              <LuPlus /> Dost əlavə et
            </Button>
          </div>
        </Field>
      )}

      <Button type="submit" size="lg" block loading={busy}>
        {editing ? "Yadda saxla" : "Səfəri yarat"}
      </Button>
    </form>
  );
}

export function TripFormPage() {
  useTitle("Yeni səfər");
  const [created, setCreated] = useState<Trip | null>(null);
  return (
    <main className="page narrow">
      <Link to="/app" className="back-link">
        <LuArrowLeft /> Səfərlərim
      </Link>
      {created ? (
        <div className="card created rise">
          <Mascot mood="party" color="mint" size={130} />
          <h1>Səfər hazırdır!</h1>
          <p className="muted">Linki dostlarına göndər — qoşulanda öz yerlərini seçəcəklər.</p>
          <InviteCard trip={created} />
          <Button size="lg" block onClick={() => navigate(`/app/sefer/${created.id}`, { replace: true })}>
            Səfərə keç
          </Button>
        </div>
      ) : (
        <>
          <h1 className="page-title">Yeni səfər yarat</h1>
          <TripForm onDone={setCreated} />
        </>
      )}
    </main>
  );
}
