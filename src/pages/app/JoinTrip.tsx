import { useState } from "react";
import { LuCalendar, LuMapPin, LuUsers } from "react-icons/lu";
import { backend } from "../../backend";
import { iAm } from "../../lib/az";
import { formatRange } from "../../lib/dates";
import { useLive } from "../../state/data";
import { Link, navigate, useTitle } from "../../state/router";
import { useSession } from "../../state/session";
import { Avatar, Button, Empty, Logo, PageLoading, errorText, useToast } from "../../ui/kit";
import { Mascot } from "../../ui/Mascot";

export function JoinTrip({ code }: { code: string }) {
  useTitle("Səfərə qoşul");
  const toast = useToast();
  const { profile } = useSession();
  const { data, error, loading } = useLive(() => backend.previewInvite(code), [code]);
  const [seat, setSeat] = useState<string | "new">("new");
  const [busy, setBusy] = useState(false);
  const me = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");

  async function join() {
    setBusy(true);
    try {
      const tripId = await backend.joinTrip(code, seat === "new" ? null : seat);
      toast.ok("Səfərə qoşuldunuz!");
      navigate(`/app/sefer/${tripId}`, { replace: true });
    } catch (e) {
      toast.err(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="join-page">
      <header className="join-top">
        <Link to="/app" aria-label="Səfərlərim">
          <Logo size={30} />
        </Link>
      </header>
      <main className="page narrow">
        {loading && !data ? (
          <PageLoading />
        ) : error || !data ? (
          <Empty
            mood="shocked"
            color="peach"
            title="Dəvət tapılmadı"
            text={error ?? "Kodu yoxlayın və ya dostunuzdan yeni link istəyin."}
            action={<Button onClick={() => navigate("/app")}>Səfərlərimə qayıt</Button>}
          />
        ) : (
          <div className="card join-card rise">
            <div className="join-hero">
              <div className="bubble">{data.alreadyMember ? "Sən artıq buradasan!" : "Səni gözləyirdik!"}</div>
              <Mascot mood={data.alreadyMember ? "wink" : "party"} color="lilac" size={130} />
            </div>
            <p className="eyebrow" style={{ justifySelf: "center" }}>
              Səfər dəvəti
            </p>
            <h1 style={{ textAlign: "center" }}>{data.name}</h1>
            <div className="join-meta">
              <span>
                <LuMapPin /> {data.destination}
              </span>
              <span>
                <LuCalendar /> {formatRange(data.startDate, data.endDate)}
              </span>
              <span>
                <LuUsers /> {data.memberCount} iştirakçı
              </span>
            </div>
            {data.alreadyMember ? (
              <Button size="lg" block onClick={() => navigate(`/app/sefer/${data.tripId}`, { replace: true })}>
                Səfərə keç
              </Button>
            ) : (
              <>
                {data.openSeats.length > 0 && (
                  <fieldset className="seats">
                    <legend className="label">Siyahıda sən varsan? Yerini seç:</legend>
                    {data.openSeats.map((s) => (
                      <label key={s.id} className={`seat ${seat === s.id ? "on" : ""}`}>
                        <input type="radio" name="seat" checked={seat === s.id} onChange={() => setSeat(s.id)} />
                        <Avatar name={s.name} size={36} />
                        <span>Mən {iAm(s.name)}</span>
                      </label>
                    ))}
                    <label className={`seat ${seat === "new" ? "on" : ""}`}>
                      <input type="radio" name="seat" checked={seat === "new"} onChange={() => setSeat("new")} />
                      <Avatar name={me || "?"} src={profile?.avatar} size={36} />
                      <span>Yeni iştirakçı kimi qoşul ({me})</span>
                    </label>
                  </fieldset>
                )}
                <p className="faint small" style={{ textAlign: "center" }}>
                  {seat === "new"
                    ? "Qoşulmazdan əvvəl yazılmış xərclər sənin balansına təsir etmir."
                    : "Bu yerə yazılmış xərclər və ödənişlər sənin hesabına keçəcək."}
                </p>
                <Button size="lg" block loading={busy} onClick={join}>
                  Səfərə qoşul
                </Button>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
