import { useEffect, useState } from "react";
import { LuArrowRight, LuCircleCheck, LuHandCoins, LuReceipt, LuShieldCheck, LuSmartphone, LuSparkles, LuUsers, LuWandSparkles } from "react-icons/lu";
import { isDemo } from "../../backend";
import { Link, navigate, useTitle } from "../../state/router";
import { useSession } from "../../state/session";
import { Avatar, Button, Logo } from "../../ui/kit";
import { Mascot } from "../../ui/Mascot";
import { LiveDemo } from "./LiveDemo";

const SPLIT_PEOPLE = ["Məryəm", "Əli", "Leyla", "Nigar"];
const SPLITS = {
  equal: { label: "Bərabər", values: [3000, 3000, 3000, 3000], note: "120 € dörd nəfərə bərabər: hərəyə 30 €." },
  custom: { label: "Məbləğlə", values: [4500, 3500, 2500, 1500], note: "Kim nə yedisə, onu ödəyir. Cəm 120 €-ya bərabər olmalıdır." },
  percent: { label: "Faizlə", values: [4800, 3600, 2400, 1200], note: "40% · 30% · 20% · 10% — faizlərin cəmi 100% olmalıdır." },
} as const;

function SplitShowcase() {
  const [m, setM] = useState<keyof typeof SPLITS>("equal");
  const s = SPLITS[m];
  return (
    <div className="split-show card">
      <div className="split-show-head">
        <div>
          <div className="eyebrow warm">Şam yeməyi · Trastevere</div>
          <div className="split-total num">120,00 €</div>
        </div>
        <Avatar name="Leyla" size={40} />
      </div>
      <div className="seg" role="group" aria-label="Bölgü üsulu">
        {(Object.keys(SPLITS) as (keyof typeof SPLITS)[]).map((k) => (
          <button key={k} aria-pressed={m === k} onClick={() => setM(k)}>
            {SPLITS[k].label}
          </button>
        ))}
      </div>
      <div className="split-bars">
        {SPLIT_PEOPLE.map((p, i) => (
          <div key={p} className="split-bar">
            <Avatar name={p} size={32} />
            <span className="name">{p}</span>
            <div className="track">
              <span style={{ width: `${(s.values[i] / 4800) * 100}%` }} />
            </div>
            <b className="num">{(s.values[i] / 100).toFixed(0)} €</b>
          </div>
        ))}
      </div>
      <p className="faint small">{s.note}</p>
    </div>
  );
}

export function Landing() {
  useTitle("");
  const { ready, session } = useSession();
  const signedIn = ready && !!session;
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const start = () => navigate(signedIn ? "/app" : "/xos-gelmisiniz");

  return (
    <div className="landing">
      <header className={`l-nav ${scrolled ? "scrolled" : ""}`}>
        <div className="l-nav-in">
          <Link to="/" aria-label="TRIPMATE">
            <Logo size={34} />
          </Link>
          <nav className="l-links" aria-label="Bölmələr">
            <a href="#nece-isleyir">Necə işləyir</a>
            <a href="#ustunlukler">Üstünlüklər</a>
            <a href="#xercler">Xərclər</a>
          </nav>
          <div className="l-nav-cta">
            {!signedIn && (
              <Link to="/daxil-ol" className="btn btn-ghost">
                Daxil ol
              </Link>
            )}
            <Button onClick={start}>{signedIn ? "Tətbiqə keç" : "Başla"}</Button>
          </div>
        </div>
      </header>

      <section className="l-hero">
        <div className="l-hero-copy">
          <span className="l-kicker">
            <LuSparkles /> Dostlarla səyahət üçün ortaq xərclər
          </span>
          <h1>
            Sən səyahətindən zövq al, <span className="grad">xərclərin hesabını Tripmate həll etsin.</span>
          </h1>
          <p className="l-lead">Kim nə ödədisə yaz. TRIPMATE hər kəsin payını hesablayır, ödənişləri izləyir və kimin kimə nə qədər qaytaracağını ən az köçürmə ilə göstərir.</p>
          <div className="l-cta">
            <Button size="lg" onClick={start}>
              {signedIn ? "Səfərlərimə keç" : "Pulsuz başla"} <LuArrowRight />
            </Button>
            {isDemo && !signedIn && (
              <Button size="lg" variant="soft" onClick={() => navigate("/daxil-ol")}>
                Demo hesabla bax
              </Button>
            )}
          </div>
        </div>

        <div className="l-stage">
          <div className="l-float f1" style={{ ["--rot" as string]: "-4deg" }}>
            <Avatar name="Məryəm" size={34} />
            <div>
              <b>Məryəm otel ödədi</b>
              <small className="num">400 € · 5 nəfərə bölündü</small>
            </div>
          </div>
          <div className="l-float f2" style={{ ["--rot" as string]: "3deg" }}>
            <span className="l-float-icon warm">
              <LuHandCoins />
            </span>
            <div>
              <b>Əli → Məryəm</b>
              <small className="num">70 € · təsdiq gözləyir</small>
            </div>
          </div>
          <div className="l-float f3" style={{ ["--rot" as string]: "-2deg" }}>
            <span className="l-float-icon mint">
              <LuCircleCheck />
            </span>
            <div>
              <b>Ödəniş təsdiqləndi</b>
              <small>Məryəm pulu aldı</small>
            </div>
          </div>
          <div className="l-float f4" style={{ ["--rot" as string]: "5deg" }}>
            <Mascot mood="wink" color="peach" size={46} still />
            <div>
              <b>5 nəfər, 3 köçürmə</b>
              <small>ən az köçürmə ilə</small>
            </div>
          </div>
          <div className="phone">
            <LiveDemo />
          </div>
          <p className="l-try">
            <LuWandSparkles /> Telefonda sına: xərc əlavə et, balanslar dərhal dəyişir
          </p>
        </div>
      </section>

      <section className="l-section" id="nece-isleyir">
        <div className="l-head">
          <span className="eyebrow">Necə işləyir</span>
          <h2>Üç addım. Bir dəqiqə. Sıfır mübahisə.</h2>
        </div>
        <div className="l-steps">
          {[
            { n: 1, t: "Səfəri yarat", d: "Ad, məkan, tarixlər, büdcə. Dostlarını əlavə et və dəvət linkini paylaş.", mood: "happy" as const, color: "lilac" as const },
            { n: 2, t: "Xərcləri yaz", d: "Otel, şam yeməyi, taksi — kim ödədisə yazır. Bərabər, məbləğlə və ya faizlə bölüşdür.", mood: "wink" as const, color: "peach" as const },
            { n: 3, t: "Hesablaş", d: "TRIPMATE kimin kimə nə qədər qaytaracağını göstərir. Pulu alan təsdiqləyir — borc bağlanır.", mood: "party" as const, color: "mint" as const },
          ].map((s) => (
            <article key={s.n} className={`l-step ${s.color}`}>
              <span className="l-step-n">{s.n}</span>
              <Mascot mood={s.mood} color={s.color} size={96} />
              <h3>{s.t}</h3>
              <p className="muted">{s.d}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="l-section" id="ustunlukler">
        <div className="l-head">
          <span className="eyebrow warm">Üstünlüklər</span>
          <h2>Pul mövzusu dostluğu yormasın</h2>
        </div>
        <div className="l-benefits">
          <article>
            <span className="l-icon lav">
              <LuSparkles />
            </span>
            <h3>Dəqiq hesab</h3>
            <p className="muted">Məbləğlər qəpiyinə qədər hesablanır. Yuvarlaqlaşdırma fərqi heç vaxt itmir — paylar həmişə xərcin özünə bərabərdir.</p>
          </article>
          <article>
            <span className="l-icon warm">
              <LuHandCoins />
            </span>
            <h3>Ən az köçürmə</h3>
            <p className="muted">Beş nəfərin bir-birinə on borcu əvəzinə, hamını bağlayan ən qısa ödəniş siyahısı.</p>
          </article>
          <article>
            <span className="l-icon mint">
              <LuShieldCheck />
            </span>
            <h3>İki tərəfli təsdiq</h3>
            <p className="muted">Borclu «Ödəniş etdim» deyir, pulu alan təsdiqləyir. Hissə-hissə ödəniş də olar. Heç nə iki dəfə sayılmır.</p>
          </article>
          <article>
            <span className="l-icon pink">
              <LuSmartphone />
            </span>
            <h3>Yolda, telefonda</h3>
            <p className="muted">Kafedə, taksidə, hava limanında — bir əllə xərc yaz, çekin şəklini çək.</p>
          </article>
        </div>
      </section>

      <section className="l-section l-expense" id="xercler">
        <div className="l-expense-copy">
          <span className="eyebrow">Xərclərin idarəsi</span>
          <h2>Hər xərc yerində, hər pay aydın</h2>
          <ul className="l-list">
            <li>
              <LuReceipt /> Altı kateqoriya: qalacaq yer, yemək, nəqliyyat, əyləncə, alış-veriş, digər
            </li>
            <li>
              <LuUsers /> Xərci hamı və ya yalnız bir neçə nəfər bölüşə bilər
            </li>
            <li>
              <LuSparkles /> Kateqoriya, iştirakçı və tarix üzrə filtr, çek şəkli, qeyd
            </li>
            <li>
              <LuShieldCheck /> Hər dəyişiklikdən sonra balanslar avtomatik yenidən hesablanır
            </li>
          </ul>
        </div>
        <SplitShowcase />
      </section>

      <section className="l-final">
        <div className="l-final-card">
          <Mascot mood="party" color="mint" size={140} />
          <div>
            <h2>Növbəti səfərdə hesabı Tripo saxlasın</h2>
            <p>Qeydiyyat bir dəqiqə çəkir. Dostlarını dəvət et, xərcləri yaz, rahat gəz.</p>
          </div>
          <Button size="lg" variant="ink" onClick={start}>
            {signedIn ? "Tətbiqə keç" : "Pulsuz başla"} <LuArrowRight />
          </Button>
        </div>
      </section>

      <footer className="l-footer">
        <Logo size={26} />
        <span className="faint small">© {new Date().getFullYear()} TRIPMATE · Sən səyahətindən zövq al.</span>
      </footer>
    </div>
  );
}
