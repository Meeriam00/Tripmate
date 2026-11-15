import { useState, type FormEvent, type ReactNode } from "react";
import { LuArrowLeft, LuArrowRight, LuCamera, LuInfo, LuMailCheck } from "react-icons/lu";
import { backend, isDemo, localBackend } from "../../backend";
import { DEMO_PASSWORD } from "../../backend/seed";
import { CURRENCIES } from "../../lib/money";
import { emailError, nameError, passwordError } from "../../lib/validate";
import { Link, navigate, safeNext, useLocation, useTitle } from "../../state/router";
import { useSession } from "../../state/session";
import { compressImage } from "../../ui/image";
import { Avatar, Button, Field, Logo, PasswordField, TextField, errorText, useToast } from "../../ui/kit";
import { Mascot, type MascotColor, type MascotMood } from "../../ui/Mascot";

// ---------- layout ----------

function AuthLayout({
  children,
  mood = "happy",
  color = "lilac",
  bubble,
}: {
  children: ReactNode;
  mood?: MascotMood;
  color?: MascotColor;
  bubble: string;
}) {
  return (
    <div className={`auth ${color}`}>
      <aside className="auth-art">
        <Link to="/" className="auth-logo" aria-label="TRIPMATE ana səhifə">
          <Logo />
        </Link>
        <div className="auth-hero">
          <div className="bubble" key={bubble}>
            {bubble}
          </div>
          <Mascot mood={mood} color={color} size={190} />
        </div>
        <p className="auth-tag">Sən səyahətindən zövq al, xərclərin hesabını Tripmate həll etsin.</p>
      </aside>
      <main className="auth-main">
        <div className="auth-card rise">{children}</div>
      </main>
    </div>
  );
}

function GoogleButton() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <div className="field">
      <Button
        variant="soft"
        block
        size="lg"
        loading={busy}
        disabled={!backend.googleAvailable}
        onClick={async () => {
          setBusy(true);
          try {
            await backend.signInWithGoogle();
          } catch (e) {
            toast.err(errorText(e));
            setBusy(false);
          }
        }}
      >
        <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        Google ilə davam et
      </Button>
      {!backend.googleAvailable && <div className="field-hint">Google ilə giriş Supabase qoşulduqdan sonra aktiv olacaq.</div>}
    </div>
  );
}

function Divider() {
  return (
    <div className="divider">
      <span>və ya</span>
    </div>
  );
}

// ---------- Welcome / onboarding ----------

const SLIDES: { title: string; text: string; mood: MascotMood; color: MascotColor; bubble: string }[] = [
  { title: "Səfərini yarat", text: "Dostlarını əlavə et, tarixləri və büdcəni yaz. Dəvət linkini paylaş — hamı bir yerdə.", mood: "happy", color: "lilac", bubble: "Hara gedirik?" },
  { title: "Kim nə ödədisə, yaz", text: "Otel, şam yeməyi, taksi. Bərabər, məbləğlə və ya faizlə bölüşdür.", mood: "wink", color: "peach", bubble: "Çeki mənə ver!" },
  { title: "Hesablaşma bir baxışda", text: "TRIPMATE kimin kimə nə qədər qaytaracağını ən az köçürmə ilə hesablayır.", mood: "party", color: "mint", bubble: "Dostluq xilas oldu!" },
];

export function Welcome() {
  useTitle("Xoş gəlmisiniz");
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  return (
    <AuthLayout mood={s.mood} color={s.color} bubble={s.bubble}>
      <div className="onboard">
        <div className="onboard-step eyebrow">
          Addım {i + 1} / {SLIDES.length}
        </div>
        <h1 key={s.title} className="rise">
          {s.title}
        </h1>
        <p className="muted rise" key={s.text}>
          {s.text}
        </p>
        <div className="dots" role="tablist" aria-label="Addımlar">
          {SLIDES.map((x, k) => (
            <button key={x.title} role="tab" aria-selected={k === i} aria-label={`Addım ${k + 1}`} className={k === i ? "on" : ""} onClick={() => setI(k)} />
          ))}
        </div>
        {i < SLIDES.length - 1 ? (
          <div className="onboard-actions">
            <Button variant="ghost" onClick={() => setI(SLIDES.length - 1)}>
              Keç
            </Button>
            <Button onClick={() => setI(i + 1)}>
              Növbəti <LuArrowRight />
            </Button>
          </div>
        ) : (
          <div className="form-grid" style={{ marginTop: 8 }}>
            <Button size="lg" block onClick={() => navigate("/qeydiyyat")}>
              Hesab yarat
            </Button>
            <Button size="lg" variant="soft" block onClick={() => navigate("/daxil-ol")}>
              Artıq hesabım var
            </Button>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}

// ---------- Register ----------

export function Register() {
  useTitle("Qeydiyyat");
  const { query } = useLocation();
  const { refresh } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null; repeat?: string | null; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = { email: emailError(email), password: passwordError(password), repeat: repeat !== password ? "Şifrələr eyni deyil." : null };
    setErrors(errs);
    if (errs.email || errs.password || errs.repeat) return;
    setBusy(true);
    try {
      const s = await backend.signUp(email, password);
      if (!s) {
        setCheckEmail(true);
        return;
      }
      await refresh();
      navigate(`/profil-tamamla?next=${encodeURIComponent(safeNext(query))}`, { replace: true });
    } catch (err) {
      setErrors({ form: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  if (checkEmail)
    return (
      <AuthLayout mood="wink" color="mint" bubble="Poçtuna bax!">
        <div className="form-grid" style={{ textAlign: "center", justifyItems: "center" }}>
          <LuMailCheck size={42} className="hl-lav" />
          <h1>E-poçtunuzu təsdiqləyin</h1>
          <p className="muted">
            <b>{email}</b> ünvanına təsdiq keçidi göndərdik. Keçidə klikləyin, sonra profilinizi tamamlayacağıq.
          </p>
          <Link className="link" to="/daxil-ol">
            Daxil ol səhifəsinə qayıt
          </Link>
        </div>
      </AuthLayout>
    );

  return (
    <AuthLayout mood="happy" bubble="Yeni dost? Xoş gəldin!">
      <form className="form-grid" onSubmit={submit} noValidate>
        <div>
          <h1>Qeydiyyat</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            Bir dəqiqəyə hesab aç, ilk səfərini yarat.
          </p>
        </div>
        {errors.form && <div className="alert">{errors.form}</div>}
        <TextField label="E-poçt" type="email" autoComplete="email" inputMode="email" placeholder="ad@nümunə.az" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <PasswordField autoComplete="new-password" placeholder="Ən azı 8 simvol" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} hint="Ən azı 8 simvol, bir hərf və bir rəqəm." />
        <PasswordField label="Şifrəni təkrarla" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} error={errors.repeat} />
        <Button type="submit" size="lg" block loading={busy}>
          Hesab yarat
        </Button>
        <Divider />
        <GoogleButton />
        <p className="center muted">
          Hesabın var?{" "}
          <Link className="link" to={`/daxil-ol${query.get("next") ? `?next=${encodeURIComponent(query.get("next")!)}` : ""}`}>
            Daxil ol
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

// ---------- Login ----------

export function Login() {
  useTitle("Daxil ol");
  const { query } = useLocation();
  const { refresh } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function go(em: string, pw: string, tag: string) {
    setBusy(tag);
    setError(null);
    try {
      await backend.signIn(em, pw);
      await refresh();
      navigate(safeNext(query), { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const err = emailError(email) ?? (password ? null : "Şifrəni yazın.");
    if (err) return setError(err);
    await go(email, password, "form");
  }

  const demo = localBackend?.demoAccounts() ?? [];

  return (
    <AuthLayout mood="wink" bubble="Yenə səyahət? Gəl görək!">
      <form className="form-grid" onSubmit={submit} noValidate>
        <div>
          <h1>Daxil ol</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            Səfərlərin və hesablaşmaların səni gözləyir.
          </p>
        </div>
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
        <TextField label="E-poçt" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordField autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Link className="link" to="/sifreni-unutmusunuz" style={{ justifySelf: "end", marginTop: -6 }}>
          Şifrəni unutmusunuz?
        </Link>
        <Button type="submit" size="lg" block loading={busy === "form"}>
          Daxil ol
        </Button>
        <Divider />
        <GoogleButton />
        {isDemo && demo.length > 0 && (
          <div className="demo-box">
            <div className="eyebrow warm">Demo hesabları</div>
            <p className="faint" style={{ fontSize: 13 }}>
              Hazır səfərlərlə tanış olun. Ödəniş təsdiqini yoxlamaq üçün əvvəlcə Əli, sonra Məryəm kimi daxil olun. Şifrə: <b>{DEMO_PASSWORD}</b>
            </p>
            <div className="demo-people">
              {demo.slice(0, 5).map((d) => (
                <button key={d.email} type="button" className="demo-person" onClick={() => go(d.email, DEMO_PASSWORD, d.email)} disabled={!!busy}>
                  <Avatar name={d.name} size={36} />
                  <span>{busy === d.email ? "..." : d.name.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="center muted">
          Hesabın yoxdur?{" "}
          <Link className="link" to={`/qeydiyyat${query.get("next") ? `?next=${encodeURIComponent(query.get("next")!)}` : ""}`}>
            Qeydiyyatdan keç
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

// ---------- Forgot / reset password ----------

export function ForgotPassword() {
  useTitle("Şifrəni bərpa et");
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState<string | undefined>();
  const [typed, setTyped] = useState("");
  const [pw, setPw] = useState("");

  async function request(e: FormEvent) {
    e.preventDefault();
    const err = emailError(email);
    if (err) return setError(err);
    setBusy(true);
    setError(null);
    try {
      const r = await backend.requestPasswordReset(email);
      setCode(r.localCode);
      setSent(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function reset(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await backend.resetPassword({ email, code: typed, password: pw });
      toast.ok("Şifrə yeniləndi. İndi daxil ola bilərsiniz.");
      navigate("/daxil-ol", { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout mood={sent ? "wink" : "worried"} color="peach" bubble={sent ? "Tapdım!" : "Şifrə yadından çıxıb? Olur!"}>
      <div className="form-grid">
        <Link to="/daxil-ol" className="link" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <LuArrowLeft /> Geri
        </Link>
        <div>
          <h1>Şifrəni unutmusunuz?</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            {sent ? "Yeni şifrə təyin edin." : "E-poçtunuzu yazın, bərpa üçün kod və ya keçid göndərək."}
          </p>
        </div>
        {error && <div className="alert">{error}</div>}
        {!sent ? (
          <form className="form-grid" onSubmit={request} noValidate>
            <TextField label="E-poçt" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" size="lg" block loading={busy}>
              Bərpa et
            </Button>
          </form>
        ) : isDemo ? (
          <form className="form-grid" onSubmit={reset} noValidate>
            {code ? (
              <div className="alert info">
                <LuInfo />
                <span>
                  Demo rejimində e-poçt göndərilmir. Bərpa kodunuz: <b className="num">{code}</b> (15 dəqiqə etibarlıdır).
                </span>
              </div>
            ) : (
              <div className="alert info">
                <LuInfo />
                <span>Bu ünvan qeydiyyatdadırsa, bərpa kodu yaradıldı.</span>
              </div>
            )}
            <TextField label="Bərpa kodu" inputMode="numeric" autoComplete="one-time-code" value={typed} onChange={(e) => setTyped(e.target.value)} />
            <PasswordField label="Yeni şifrə" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} hint="Ən azı 8 simvol, bir hərf və bir rəqəm." />
            <Button type="submit" size="lg" block loading={busy}>
              Şifrəni yenilə
            </Button>
          </form>
        ) : (
          <div className="alert ok">
            <LuMailCheck />
            <span>Bu ünvan qeydiyyatdadırsa, bərpa keçidi göndərildi. Gələnlər qutusunu (və spam qovluğunu) yoxlayın.</span>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}

/** Supabase sends the recovery link here; the link opens a short recovery session. */
export function ResetPassword() {
  useTitle("Yeni şifrə");
  const toast = useToast();
  const { session } = useSession();
  const [pw, setPw] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (isDemo)
    return (
      <AuthLayout bubble="Bu səhifə e-poçt keçidi üçündür">
        <div className="form-grid">
          <h1>Yeni şifrə</h1>
          <p className="muted">Demo rejimində şifrə bərpa kodla edilir.</p>
          <Button onClick={() => navigate("/sifreni-unutmusunuz")}>Şifrəni bərpa et</Button>
        </div>
      </AuthLayout>
    );
  return (
    <AuthLayout mood="calm" bubble="Yeni şifrə, yeni səyahət">
      <form
        className="form-grid"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (pw !== repeat) return setError("Şifrələr eyni deyil.");
          setBusy(true);
          try {
            await backend.resetPassword({ password: pw });
            toast.ok("Şifrə yeniləndi.");
            navigate("/app", { replace: true });
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1>Yeni şifrə təyin edin</h1>
        {!session && <div className="alert warm">Keçidin vaxtı bitib və ya keçid düzgün deyil. Bərpanı yenidən başladın.</div>}
        {error && <div className="alert">{error}</div>}
        <PasswordField label="Yeni şifrə" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} hint="Ən azı 8 simvol, bir hərf və bir rəqəm." />
        <PasswordField label="Təkrarla" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        <Button type="submit" size="lg" block loading={busy} disabled={!session}>
          Yadda saxla
        </Button>
      </form>
    </AuthLayout>
  );
}

// ---------- Complete profile ----------

export function CompleteProfile() {
  useTitle("Profilin tamamlanması");
  const { query } = useLocation();
  const { profile, setProfile } = useSession();
  const toast = useToast();
  const [first, setFirst] = useState(profile?.firstName ?? "");
  const [last, setLast] = useState(profile?.lastName ?? "");
  const [currency, setCurrency] = useState(profile?.currency ?? "AZN");
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar ?? null);
  const [errors, setErrors] = useState<{ first?: string | null; form?: string }>({});
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    try {
      setAvatar(await compressImage(file, 320, 0.8));
    } catch (e) {
      toast.err(errorText(e));
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const fe = nameError(first, "Ad");
    setErrors({ first: fe });
    if (fe) return;
    setBusy(true);
    try {
      const url = avatar && avatar.startsWith("data:") ? await backend.uploadImage("avatar", avatar) : avatar;
      const p = await backend.updateProfile({ firstName: first, lastName: last, currency, avatar: url, completed: true });
      setProfile(p);
      toast.ok(`Xoş gəldin, ${p.firstName}!`);
      navigate(safeNext(query), { replace: true });
    } catch (err) {
      setErrors({ form: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout mood="happy" color="mint" bubble={first ? `Tanış olaq, ${first}!` : "Tanış olaq!"}>
      <form className="form-grid" onSubmit={submit} noValidate>
        <div>
          <div className="eyebrow mint">Son addım</div>
          <h1 style={{ marginTop: 8 }}>Profilin tamamlanması</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            Dostların səni bu adla görəcək.
          </p>
        </div>
        {errors.form && <div className="alert">{errors.form}</div>}
        <label className="avatar-pick">
          <Avatar name={[first, last].join(" ").trim() || "?"} src={avatar} size={88} />
          <span className="cam" aria-hidden>
            <LuCamera />
          </span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} aria-label="Profil şəkli seç (istəyə bağlı)" />
          <span className="faint" style={{ fontSize: 13 }}>
            Şəkil (istəyə bağlı)
          </span>
        </label>
        <div className="row-2 stack-sm">
          <TextField label="Ad" autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} error={errors.first} />
          <TextField label="Soyad" autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} />
        </div>
        <div className="row-2 stack-sm">
          <Field label="Əsas valyuta" htmlFor="cur">
            <select id="cur" className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.code} — {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Dil" htmlFor="lang" hint="Digər dillər tezliklə.">
            <select id="lang" className="input" value="az" onChange={() => {}}>
              <option value="az">Azərbaycan dili</option>
            </select>
          </Field>
        </div>
        <Button type="submit" size="lg" block loading={busy}>
          Davam et <LuArrowRight />
        </Button>
      </form>
    </AuthLayout>
  );
}
