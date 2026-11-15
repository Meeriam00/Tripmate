import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { LuCircleAlert, LuCircleCheck, LuEye, LuEyeOff, LuX } from "react-icons/lu";
import { CATEGORY } from "../lib/categories";
import type { Category } from "../lib/types";
import { CategoryIcon } from "./icons";
import { Mascot, type MascotColor, type MascotMood } from "./Mascot";

// ---------- Button ----------

type BtnVariant = "primary" | "warm" | "ink" | "soft" | "ghost" | "danger" | "success";
export function Button({
  variant = "primary",
  size,
  block,
  loading,
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "lg"; block?: boolean; loading?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      aria-busy={loading || undefined}
      className={`btn btn-${variant} ${size ? `btn-${size}` : ""} ${block ? "btn-block" : ""} ${className}`}
    >
      {loading ? <span className="spinner" aria-hidden /> : null}
      {children}
    </button>
  );
}

// ---------- Logo ----------

export function Logo({ size = 34, word = true }: { size?: number; word?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
        <defs>
          <linearGradient id="tm-logo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#a586f3" />
            <stop offset="1" stopColor="#ff9a4a" />
          </linearGradient>
        </defs>
        <path d="M20 3c9 0 15 6 16 15 .6 6 .8 10 0 13-1.4 5.5-7.5 7-16 7s-14.6-1.5-16-7c-.8-3-.6-7 0-13C5 9 11 3 20 3Z" fill="url(#tm-logo)" />
        <ellipse cx="14.5" cy="18" rx="3.2" ry="3.8" fill="#1f1736" />
        <ellipse cx="25.5" cy="18" rx="3.2" ry="3.8" fill="#1f1736" />
        <circle cx="15.6" cy="16.6" r="1.2" fill="#fff" />
        <circle cx="26.6" cy="16.6" r="1.2" fill="#fff" />
        <path d="M17 25q3 2.6 6 0" stroke="#1f1736" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
      {word && <span style={{ fontWeight: 900, letterSpacing: "0.04em", fontSize: size * 0.56 }}>TRIPMATE</span>}
    </span>
  );
}

// ---------- Fields ----------

export function Field({ label, error, hint, children, htmlFor }: { label?: ReactNode; error?: string | null; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {error ? (
        <div className="field-error" role="alert">
          {error}
        </div>
      ) : hint ? (
        <div className="field-hint">{hint}</div>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  error,
  hint,
  suffix,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; error?: string | null; hint?: ReactNode; suffix?: ReactNode }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} htmlFor={rest.id ?? id}>
      <div className="input-wrap">
        <input id={rest.id ?? id} className={`input ${suffix ? "has-suffix" : ""}`} aria-invalid={error ? true : undefined} {...rest} />
        {suffix && <span className="suffix">{suffix}</span>}
      </div>
    </Field>
  );
}

export function PasswordField({ label = "Şifrə", error, hint, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string | null; hint?: ReactNode }) {
  const [show, setShow] = useState(false);
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} htmlFor={id}>
      <div className="input-wrap">
        <input id={id} className="input has-suffix" type={show ? "text" : "password"} aria-invalid={error ? true : undefined} {...rest} />
        <button type="button" className="icon-btn flat toggle-eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Şifrəni gizlət" : "Şifrəni göstər"}>
          {show ? <LuEyeOff /> : <LuEye />}
        </button>
      </div>
    </Field>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <span className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span />
    </span>
  );
}

// ---------- Avatar ----------

const AV_COLORS: [string, string][] = [
  ["#efe7ff", "#5b31b8"],
  ["#ffe8d4", "#b4520f"],
  ["#dcf7ec", "#0e7a55"],
  ["#fde4f1", "#b02a6a"],
  ["#e1f0fc", "#1f6aa8"],
  ["#fff2cf", "#8a5a10"],
];
function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}
export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toLocaleUpperCase("az");
}
export function Avatar({ name, src, size = 40, ghost, title }: { name: string; src?: string | null; size?: number; ghost?: boolean; title?: string }) {
  const [bg, ink] = AV_COLORS[hash(name) % AV_COLORS.length];
  return (
    <span
      className={`avatar ${ghost ? "ghost" : ""}`}
      style={{ ["--s" as string]: `${size}px`, ["--av-bg" as string]: bg, ["--av-ink" as string]: ink }}
      title={title ?? name}
      aria-label={title ?? name}
      role="img"
    >
      {src ? <img src={src} alt="" /> : size < 34 ? initials(name).slice(0, 1) : initials(name)}
    </span>
  );
}
export function AvatarStack({ people, size = 32, max = 5 }: { people: { name: string; avatar?: string | null; id?: string }[]; size?: number; max?: number }) {
  const shown = people.slice(0, max);
  return (
    <span className="avatar-stack" style={{ ["--s" as string]: `${size}px` }}>
      {shown.map((p, i) => (
        <Avatar key={p.id ?? i} name={p.name} src={p.avatar} size={size} />
      ))}
      {people.length > max && <span className="more">+{people.length - max}</span>}
    </span>
  );
}

// ---------- Category ----------

export function CategoryTile({ category, size = 46 }: { category: Category; size?: number }) {
  const c = CATEGORY[category];
  return (
    <span className="cat-tile" style={{ ["--tint" as string]: c.tint, ["--tone" as string]: c.color, width: size, height: size }} title={c.label}>
      <CategoryIcon category={category} />
    </span>
  );
}

// ---------- Sheet / modal ----------

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => {
      const first = ref.current?.querySelector<HTMLElement>("[data-autofocus], input:not([type=hidden]):not([type=checkbox]), select, textarea, button");
      first?.focus({ preventScroll: true });
    }, 60);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`sheet ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy ?? titleId}>
        <div className="grabber" />
        <div className="sheet-head">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-btn flat" onClick={onClose} aria-label="Bağla">
            <LuX />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
  mood = "worried",
}: {
  open: boolean;
  title: string;
  text: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
  mood?: MascotMood;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="soft" onClick={onClose}>
            İmtina
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <Mascot mood={mood} color="peach" size={72} still />
        <div className="muted">{text}</div>
      </div>
    </Sheet>
  );
}

// ---------- Empty / loading / error ----------

export function Empty({
  title,
  text,
  mood = "sleepy",
  color = "lilac",
  action,
  size = 120,
}: {
  title: string;
  text?: ReactNode;
  mood?: MascotMood;
  color?: MascotColor;
  action?: ReactNode;
  size?: number;
}) {
  return (
    <div className="empty rise">
      <Mascot mood={mood} color={color} size={size} />
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ h = 20, w = "100%", r }: { h?: number; w?: number | string; r?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} />;
}

export function PageLoading() {
  return (
    <div style={{ display: "grid", gap: 16, padding: "8px 0" }} aria-busy="true" aria-label="Yüklənir">
      <Skeleton h={220} r={28} />
      <Skeleton h={90} r={24} />
      <Skeleton h={180} r={24} />
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Empty
      mood="shocked"
      color="peach"
      title="Nəsə alınmadı"
      text={message}
      action={
        onRetry && (
          <Button variant="soft" onClick={onRetry}>
            Yenidən cəhd et
          </Button>
        )
      }
    />
  );
}

// ---------- Toasts ----------

interface ToastItem {
  id: number;
  kind: "ok" | "err";
  text: string;
}
const ToastCtx = createContext<{ ok: (t: string) => void; err: (t: string) => void }>({ ok: () => {}, err: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((kind: ToastItem["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-2), { id, kind, text }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), kind === "err" ? 5200 : 3200);
  }, []);
  const api = useRef({ ok: (t: string) => push("ok", t), err: (t: string) => push("err", t) });
  return (
    <ToastCtx.Provider value={api.current}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.kind === "ok" ? <LuCircleCheck /> : <LuCircleAlert />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** Message of any thrown value, for toasts and inline errors. */
export function errorText(e: unknown): string {
  if (e && typeof e === "object" && "message" in e && typeof (e as Error).message === "string") {
    const m = (e as Error).message;
    if (/[əğıöüşçƏĞİÖÜŞÇ]/.test(m)) return m;
  }
  console.error(e);
  return "Gözlənilməz xəta baş verdi. Yenidən cəhd edin.";
}

// ---------- Budget gauge (the arc behind the mascot) ----------

export function Gauge({ ratio, tone = "lilac", size = 260 }: { ratio: number | null; tone?: "lilac" | "peach" | "rose"; size?: number }) {
  const r = 110;
  const c = Math.PI * r;
  const p = ratio === null ? 0 : Math.min(1, Math.max(0, ratio));
  const angle = Math.PI * (1 - p);
  const kx = 130 + r * Math.cos(angle);
  const ky = 130 - r * Math.sin(angle);
  const color = tone === "peach" ? "#ff8a3d" : tone === "rose" ? "#e5486b" : "#8b5cf6";
  return (
    <svg width={size} height={size / 2 + 16} viewBox="0 0 260 146" aria-hidden style={{ overflow: "visible" }}>
      <path d={`M20 130 A${r} ${r} 0 0 1 240 130`} fill="none" stroke="var(--track, rgba(120,110,160,.16))" strokeWidth="10" strokeLinecap="round" />
      {ratio !== null && (
        <>
          <path
            d={`M20 130 A${r} ${r} 0 0 1 240 130`}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - p)}
            style={{ transition: "stroke-dashoffset 1s var(--ease)" }}
          />
          <circle cx={kx} cy={ky} r="11" fill="var(--surface)" stroke={color} strokeWidth="5" style={{ transition: "all 1s var(--ease)" }} />
        </>
      )}
    </svg>
  );
}

export { LuX as CloseIcon };
