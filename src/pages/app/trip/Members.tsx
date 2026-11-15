import { useState, type FormEvent } from "react";
import { LuCrown, LuUserMinus, LuUserPlus } from "react-icons/lu";
import { backend } from "../../../backend";
import { formatDay, localISO } from "../../../lib/dates";
import type { Member } from "../../../lib/types";
import { emailError, nameError } from "../../../lib/validate";
import { Avatar, Button, ConfirmDialog, Sheet, TextField, errorText, useToast } from "../../../ui/kit";
import { useTripCtx } from "./context";

function AddMember({ onClose }: { onClose: () => void }) {
  const c = useTripCtx();
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ name?: string | null; email?: string | null; form?: string }>({});
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = { name: nameError(name, "Ad"), email: email.trim() ? emailError(email) : null };
    setErrors(errs);
    if (errs.name || errs.email) return;
    setBusy(true);
    try {
      await backend.addMember(c.bundle.trip.id, name, email.trim() || undefined);
      toast.ok(`${name.trim()} əlavə olundu.`);
      onClose();
    } catch (err) {
      setErrors({ form: errorText(err) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      open
      onClose={onClose}
      title="İştirakçı əlavə et"
      footer={
        <>
          <Button variant="soft" onClick={onClose}>
            İmtina
          </Button>
          <Button type="submit" form="add-member" loading={busy}>
            Əlavə et
          </Button>
        </>
      }
    >
      <form id="add-member" className="form-grid" onSubmit={submit} noValidate>
        {errors.form && <div className="alert">{errors.form}</div>}
        <TextField label="Ad" placeholder="Kamran" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={40} />
        <TextField
          label="E-poçt (istəyə bağlı)"
          type="email"
          placeholder="kamran@nümunə.az"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          hint="TRIPMATE hesabı varsa, dəvət bildirişi alacaq."
        />
        <p className="faint small">Yeni iştirakçı əvvəl yazılmış xərclərə avtomatik daxil edilmir.</p>
      </form>
    </Sheet>
  );
}

export function Members({ onInvite }: { onInvite: () => void }) {
  const c = useTripCtx();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
  const { members } = c.bundle;
  const active = members.filter((m) => m.status === "active");
  const removed = members.filter((m) => m.status === "removed");

  function row(m: Member) {
    const b = c.balances.get(m.id)!;
    const canRemove = c.isAdmin && !c.readOnly && m.status === "active" && m.id !== c.me.id && m.userId !== c.bundle.trip.createdBy;
    return (
      <div key={m.id} className={`member-card ${m.status === "removed" ? "removed" : ""}`}>
        <Avatar name={m.name} src={m.avatar} size={52} />
        <div className="grow">
          <div className="member-name">
            <b>{m.name}</b>
            {m.id === c.me.id && <span className="faint"> (sən)</span>}
          </div>
          <div className="member-badges">
            {m.role === "admin" ? (
              <span className="badge lav">
                <LuCrown /> Admin
              </span>
            ) : (
              <span className="badge">Üzv</span>
            )}
            {m.status === "removed" ? (
              <span className="badge rose">Çıxarılıb</span>
            ) : !m.userId ? (
              <span className="badge warm">Hesabı qoşulmayıb</span>
            ) : null}
          </div>
          <div className="sub faint">Qoşulub: {formatDay(localISO(m.joinedAt))}</div>
        </div>
        <div className="member-money">
          <div className="faint small">Ödəyib</div>
          <div className="num strong">{c.money(b.paid)}</div>
          <div className={`num small strong ${b.outstanding > 0 ? "pos" : b.outstanding < 0 ? "neg" : "faint"}`}>{c.money(b.outstanding, { signed: true })}</div>
        </div>
        {canRemove && (
          <button className="icon-btn flat" aria-label={`${m.name} adlı iştirakçını çıxar`} onClick={() => setRemoving(m)}>
            <LuUserMinus />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="members">
      <div className="page-head">
        <div>
          <h2 className="page-title">İştirakçılar</h2>
          <p className="muted">{active.length} nəfər · hər kəs bütün xərcləri və balansları görür</p>
        </div>
        {!c.readOnly && (
          <div className="head-actions">
            <Button variant="soft" onClick={onInvite}>
              Dəvət linki
            </Button>
            {c.isAdmin && (
              <Button onClick={() => setAdding(true)}>
                <LuUserPlus /> Əlavə et
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="member-list">{active.map(row)}</div>
      {removed.length > 0 && (
        <>
          <h3 className="section-title small">Çıxarılmış iştirakçılar</h3>
          <p className="faint small" style={{ marginBottom: 10 }}>
            Keçmiş xərcləri və ödənişləri tarixçədə qalır.
          </p>
          <div className="member-list">{removed.map(row)}</div>
        </>
      )}
      <section className="card flat roles">
        <h3>Rollar</h3>
        <div className="roles-grid">
          <div>
            <span className="badge lav">
              <LuCrown /> Admin
            </span>
            <p className="muted small">Səfəri dəyişir və arxivləyir, iştirakçı əlavə edir və çıxarır, bütün xərcləri idarə edir.</p>
          </div>
          <div>
            <span className="badge">Üzv</span>
            <p className="muted small">Xərc əlavə edir, öz xərclərini dəyişir, balanslara baxır və ödənişləri qeyd edir.</p>
          </div>
        </div>
      </section>
      {adding && <AddMember onClose={() => setAdding(false)} />}
      <ConfirmDialog
        open={!!removing}
        title="İştirakçı çıxarılsın?"
        text={
          <>
            <b>{removing?.name}</b> səfərdən çıxarılacaq. Onun keçmiş xərcləri və ödənişləri silinmir. Açıq borcu varsa, əvvəlcə hesablaşmaq lazımdır.
          </>
        }
        confirmLabel="Çıxar"
        danger
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          try {
            await backend.removeMember(c.bundle.trip.id, removing!.id);
            toast.ok(`${removing!.name} çıxarıldı.`);
          } catch (e) {
            toast.err(errorText(e));
          }
        }}
      />
    </div>
  );
}
