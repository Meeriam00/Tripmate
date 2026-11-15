import { useState, type FormEvent } from "react";
import { LuCalendar, LuMapPin, LuPlus, LuTicket } from "react-icons/lu";
import { formatRange } from "../../lib/dates";
import { budgetState, tripPhase } from "../../lib/ledger";
import { formatMoney } from "../../lib/money";
import type { TripSummary } from "../../lib/types";
import { useTrips } from "../../state/data";
import { Link, navigate, useTitle } from "../../state/router";
import { useSession } from "../../state/session";
import { AvatarStack, Button, Empty, ErrorState, Skeleton, TextField, Sheet } from "../../ui/kit";
import { Mascot } from "../../ui/Mascot";
import { TripCover } from "../../ui/TripCover";

const PHASE = {
  active: { label: "Yoldayıq", cls: "mint" },
  upcoming: { label: "Qarşıdadır", cls: "lav" },
  past: { label: "Bitib", cls: "" },
} as const;

export function TripCard({ s, i = 0 }: { s: TripSummary; i?: number }) {
  const { trip } = s;
  const phase = tripPhase(trip);
  const b = budgetState(trip.budget, s.total);
  const pct = b.ratio === null ? 0 : Math.min(100, Math.round(b.ratio * 100));
  return (
    <Link to={`/app/sefer/${trip.id}`} className="trip-card rise" style={{ animationDelay: `${i * 60}ms` }}>
      <div className="trip-card-cover">
        <TripCover src={trip.cover} destination={trip.destination} />
        <span className={`badge ${trip.archived ? "" : PHASE[phase].cls}`}>{trip.archived ? "Arxivdə" : PHASE[phase].label}</span>
      </div>
      <div className="trip-card-body">
        <h3>{trip.name}</h3>
        <div className="meta">
          <span>
            <LuMapPin /> {trip.destination}
          </span>
          <span>
            <LuCalendar /> {formatRange(trip.startDate, trip.endDate)}
          </span>
        </div>
        <div className="trip-card-people">
          <AvatarStack people={s.members} size={28} max={4} />
          <span className="faint">{s.members.length} nəfər</span>
        </div>
        <div className="trip-card-money">
          <div>
            <div className="faint small">Xərclənib</div>
            <div className="big num">{formatMoney(s.total, trip.currency)}</div>
          </div>
          {trip.budget ? (
            <div style={{ textAlign: "right" }}>
              <div className="faint small">Büdcə</div>
              <div className="num" style={{ fontWeight: 800 }}>
                {formatMoney(trip.budget, trip.currency)}
              </div>
            </div>
          ) : (
            <span className="faint small">Büdcəsiz</span>
          )}
        </div>
        {trip.budget ? (
          <div className={`progress ${b.level === "over" ? "over" : b.level === "watch" ? "warm" : ""}`} aria-label={`Büdcənin ${pct}%-i xərclənib`}>
            <span style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </div>
    </Link>
  );
}

function JoinByCode({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  function submit(e: FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase().replace(/.*\/QOSUL\//i, "");
    if (!/^[A-Z0-9]{6}$/.test(c)) return setError("Kod 6 simvoldan ibarətdir, məsələn: K7M2QX.");
    onClose();
    navigate(`/qosul/${c}`);
  }
  return (
    <Sheet open={open} onClose={onClose} title="Səfərə qoşul">
      <form className="form-grid" onSubmit={submit} noValidate>
        <p className="muted">Dostunun göndərdiyi dəvət kodunu və ya linkini yaz.</p>
        <TextField label="Dəvət kodu" placeholder="K7M2QX" autoCapitalize="characters" value={code} onChange={(e) => setCode(e.target.value)} error={error} />
        <Button type="submit" size="lg" block>
          Davam et
        </Button>
      </form>
    </Sheet>
  );
}

export function Trips() {
  useTitle("Səfərlərim");
  const { profile } = useSession();
  const { data, error, loading, reload } = useTrips();
  const [joinOpen, setJoinOpen] = useState(false);
  const current = data?.filter((s) => tripPhase(s.trip) !== "past") ?? [];
  const past = data?.filter((s) => tripPhase(s.trip) === "past") ?? [];
  const active = current.find((s) => tripPhase(s.trip) === "active");

  const bubble = !data?.length
    ? "Hələ səfər yoxdur. Çantaları yığaq?"
    : active
      ? `«${active.trip.name}» davam edir. Xərcləri unutma!`
      : current.length
        ? `${current.length} səfər qarşıdadır. Həyəcanlıyam!`
        : "Növbəti macəra haradır?";

  return (
    <main className="page">
      <section className="home-hero rise">
        <div className="home-hero-text">
          <p className="eyebrow">Səfərlərim</p>
          <h1>Salam, {profile?.firstName || "dost"}!</h1>
          <p className="muted">Bütün səfərlərin və ortaq xərclərin bir yerdə.</p>
          <div className="home-actions">
            <Button size="lg" onClick={() => navigate("/app/yeni")}>
              <LuPlus /> Yeni səfər yarat
            </Button>
            <Button size="lg" variant="soft" onClick={() => setJoinOpen(true)}>
              <LuTicket /> Kodla qoşul
            </Button>
          </div>
        </div>
        <div className="home-hero-art" aria-hidden>
          <div className="bubble">{bubble}</div>
          <Mascot mood={data?.length ? "happy" : "sleepy"} color={active ? "peach" : "lilac"} size={150} />
        </div>
      </section>

      {loading && !data ? (
        <div className="trip-grid">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} h={320} r={26} />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data?.length ? (
        <Empty
          title="İlk səfərini yarat"
          text="Səfəri yarat, dostlarını dəvət et və xərcləri yazmağa başla. Hesabı Tripo aparacaq."
          action={
            <Button onClick={() => navigate("/app/yeni")}>
              <LuPlus /> Yeni səfər yarat
            </Button>
          }
        />
      ) : (
        <>
          <section className="section">
            <h2 className="section-title">Aktiv və qarşıdakı səfərlər</h2>
            {current.length ? (
              <div className="trip-grid">
                {current.map((s, i) => (
                  <TripCard key={s.trip.id} s={s} i={i} />
                ))}
              </div>
            ) : (
              <p className="muted">Qarşıda səfər yoxdur. Yenisini planlayaq?</p>
            )}
          </section>
          {past.length > 0 && (
            <section className="section">
              <h2 className="section-title">Keçmiş səfərlər</h2>
              <div className="trip-grid">
                {past.map((s, i) => (
                  <TripCard key={s.trip.id} s={s} i={i} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
      <JoinByCode open={joinOpen} onClose={() => setJoinOpen(false)} />
    </main>
  );
}
