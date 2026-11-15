import { useState, type FormEvent, type ReactNode } from "react";
import { LuCamera, LuLogOut, LuMonitor, LuMoon, LuRefreshCw, LuSun, LuTrash2 } from "react-icons/lu";
import { backend, isDemo, localBackend } from "../../backend";
import { CURRENCIES } from "../../lib/money";
import type { NotifyPrefs, Theme } from "../../lib/types";
import { nameError, passwordError } from "../../lib/validate";
import { Link, navigate, useTitle } from "../../state/router";
import { applyTheme, useSession } from "../../state/session";
import { compressImage } from "../../ui/image";
import { Avatar, Button, Field, PasswordField, Sheet, Switch, TextField, errorText, useToast } from "../../ui/kit";
import { Mascot } from "../../ui/Mascot";

function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section className="card settings-card" id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function Settings() {
  useTitle("Profil və ayarlar");
  const { profile, setProfile } = useSession();
  const toast = useToast();
  const [first, setFirst] = useState(profile!.firstName);
  const [last, setLast] = useState(profile!.lastName);
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", repeat: "" });
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  if (!profile) return null;
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ");

  async function patch(p: Parameters<typeof backend.updateProfile>[0], msg = "Yadda saxlanıldı.") {
    try {
      const next = await backend.updateProfile(p);
      setProfile(next);
      toast.ok(msg);
    } catch (e) {
      toast.err(errorText(e));
    }
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    const err = nameError(first, "Ad");
    setNameErr(err);
    if (err) return;
    setSavingProfile(true);
    await patch({ firstName: first, lastName: last }, "Profil yeniləndi.");
    setSavingProfile(false);
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    try {
      const data = await compressImage(file, 320, 0.8);
      const url = await backend.uploadImage("avatar", data);
      await patch({ avatar: url }, "Şəkil yeniləndi.");
    } catch (e) {
      toast.err(errorText(e));
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    const err = passwordError(pw.next) ?? (pw.next !== pw.repeat ? "Yeni şifrələr eyni deyil." : null);
    setPwErr(err);
    if (err) return;
    setPwBusy(true);
    try {
      await backend.changePassword(pw.current, pw.next);
      setPw({ current: "", next: "", repeat: "" });
      toast.ok("Şifrə dəyişdirildi.");
    } catch (er) {
      setPwErr(errorText(er));
    } finally {
      setPwBusy(false);
    }
  }

  function setTheme(t: Theme) {
    applyTheme(t);
    void patch({ theme: t }, t === "dark" ? "Tünd mövzu aktivdir." : t === "light" ? "Açıq mövzu aktivdir." : "Mövzu sistemə uyğunlaşır.");
  }

  function setNotify(k: keyof NotifyPrefs, v: boolean) {
    void patch({ notify: { ...profile!.notify, [k]: v } }, "Bildiriş ayarları yeniləndi.");
  }

  return (
    <main className="page narrow settings">
      <Link to="/app" className="back-link">
        ← Səfərlərim
      </Link>
      <div className="settings-hero card">
        <label className="avatar-pick">
          <Avatar name={fullName || profile.email} src={profile.avatar} size={84} />
          <span className="cam" aria-hidden>
            <LuCamera />
          </span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickPhoto(e.target.files?.[0])} aria-label="Profil şəklini dəyiş" />
        </label>
        <div>
          <h1>{fullName || "Profil"}</h1>
          <p className="muted">{profile.email}</p>
          {profile.avatar && (
            <button className="link" onClick={() => patch({ avatar: null }, "Şəkil silindi.")}>
              Şəkli sil
            </button>
          )}
        </div>
      </div>

      <Section title="Profil">
        <form className="form-grid" onSubmit={saveProfile} noValidate>
          <div className="row-2 stack-sm">
            <TextField label="Ad" value={first} onChange={(e) => setFirst(e.target.value)} error={nameErr} />
            <TextField label="Soyad" value={last} onChange={(e) => setLast(e.target.value)} />
          </div>
          <div className="row-2 stack-sm">
            <Field label="Əsas valyuta" htmlFor="set-cur" hint="Yeni səfərlər üçün təklif olunur.">
              <select id="set-cur" className="input" value={profile.currency} onChange={(e) => patch({ currency: e.target.value }, "Valyuta yeniləndi.")}>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.symbol} {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Dil" htmlFor="set-lang" hint="Digər dillər tezliklə.">
              <select id="set-lang" className="input" value="az" onChange={() => {}}>
                <option value="az">Azərbaycan dili</option>
              </select>
            </Field>
          </div>
          <Button type="submit" loading={savingProfile} style={{ justifySelf: "start" }}>
            Yadda saxla
          </Button>
        </form>
      </Section>

      <Section title="Görünüş">
        <div className="theme-pick" role="radiogroup" aria-label="Mövzu">
          {(
            [
              ["light", "Açıq", LuSun],
              ["dark", "Tünd", LuMoon],
              ["system", "Sistem", LuMonitor],
            ] as const
          ).map(([k, l, I]) => (
            <button key={k} role="radio" aria-checked={profile.theme === k} className={`theme-opt ${profile.theme === k ? "on" : ""}`} onClick={() => setTheme(k)}>
              <I /> {l}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Bildirişlər">
        <div className="toggles">
          {(
            [
              ["expenses", "Xərclər", "Yeni xərc əlavə olunanda və balansın dəyişəndə"],
              ["payments", "Ödənişlər", "Ödəniş göndəriləndə, təsdiqlənəndə və ya rədd ediləndə"],
              ["members", "İştirakçılar", "Kimsə səfərə qoşulanda"],
            ] as const
          ).map(([k, t, d]) => (
            <div key={k} className="toggle-row">
              <div>
                <b>{t}</b>
                <p className="faint small">{d}</p>
              </div>
              <Switch checked={profile.notify[k]} onChange={(v) => setNotify(k, v)} label={t} />
            </div>
          ))}
          <p className="faint small">Səfər dəvətləri həmişə göstərilir.</p>
        </div>
      </Section>

      <Section title="Şifrəni dəyiş">
        <form className="form-grid" onSubmit={changePassword} noValidate>
          {pwErr && <div className="alert">{pwErr}</div>}
          <PasswordField label="Hazırkı şifrə" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          <div className="row-2 stack-sm">
            <PasswordField label="Yeni şifrə" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            <PasswordField label="Təkrarla" autoComplete="new-password" value={pw.repeat} onChange={(e) => setPw({ ...pw, repeat: e.target.value })} />
          </div>
          <Button type="submit" variant="soft" loading={pwBusy} style={{ justifySelf: "start" }}>
            Şifrəni dəyiş
          </Button>
        </form>
      </Section>

      {isDemo && localBackend && (
        <Section title="Demo rejimi">
          <p className="muted small" style={{ marginBottom: 12 }}>
            Supabase qoşulmayıb: məlumatlar yalnız bu brauzerdə saxlanılır. Demo hesablarına keçərək iki tərəfli ödəniş təsdiqini sınaya bilərsiniz.
          </p>
          <Button
            variant="soft"
            onClick={async () => {
              await localBackend!.resetDemo();
              toast.ok("Demo məlumatları sıfırlandı.");
              navigate("/daxil-ol", { replace: true });
            }}
          >
            <LuRefreshCw /> Demo məlumatlarını sıfırla
          </Button>
        </Section>
      )}

      <section className="card settings-card account-actions">
        <Button
          variant="soft"
          onClick={async () => {
            await backend.signOut();
            navigate("/daxil-ol", { replace: true });
          }}
        >
          <LuLogOut /> Çıxış
        </Button>
        <Button variant="danger" onClick={() => setDeleting(true)}>
          <LuTrash2 /> Hesabı sil
        </Button>
      </section>

      <Sheet
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Hesab silinsin?"
        footer={
          <>
            <Button variant="soft" onClick={() => setDeleting(false)}>
              İmtina
            </Button>
            <Button
              variant="danger"
              disabled={confirmText.trim().toLocaleUpperCase("az") !== "SİL"}
              loading={delBusy}
              onClick={async () => {
                setDelBusy(true);
                try {
                  await backend.deleteAccount();
                  navigate("/", { replace: true });
                } catch (e) {
                  toast.err(errorText(e));
                  setDelBusy(false);
                }
              }}
            >
              Hesabı birdəfəlik sil
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <Mascot mood="worried" color="peach" size={72} still />
            <p className="muted">
              Hesabınız və bildirişləriniz silinəcək. Dostlarınızın səfər hesabları pozulmasın deyə, xərclər və ödənişlər adınızla səfərlərdə qalacaq.
            </p>
          </div>
          <TextField label="Təsdiq üçün SİL yazın" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
        </div>
      </Sheet>
    </main>
  );
}
