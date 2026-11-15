import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { LuChevronDown, LuX } from "react-icons/lu";
import { avatarColor, initials } from "../lib/avatars";
import { formatMoney } from "../lib/money";
import type { Participant } from "../lib/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ---------------------------------------------------------------- Buttons */

type Variant = "primary" | "signal" | "secondary" | "ghost" | "danger" | "quiet";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-forest text-paper hover:bg-forest-3 active:bg-forest-2 shadow-btn",
  signal: "bg-signal text-forest-2 hover:bg-signal-2 active:brightness-95 shadow-btn",
  secondary: "bg-card text-ink ring-1 ring-line ring-inset hover:bg-paper-2/60 hover:ring-ink/25 active:bg-paper-2",
  ghost: "text-ink hover:bg-ink/[0.06] active:bg-ink/10",
  quiet: "text-ink-2 hover:text-ink hover:bg-ink/[0.05]",
  danger: "bg-owe text-white hover:brightness-110 active:brightness-95 shadow-btn",
};
const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[0.82rem] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-[0.9rem] gap-2 rounded-[0.6rem]",
  lg: "h-12 px-6 text-base gap-2.5 rounded-xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        "inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-[background-color,box-shadow,color,transform] duration-150 select-none active:translate-y-px disabled:pointer-events-none disabled:opacity-45",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

export function LinkButton({
  href,
  variant = "secondary",
  size = "md",
  icon,
  className,
  children,
}: { href: string; variant?: Variant; size?: Size; icon?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className={cx(
        "inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-[background-color,box-shadow,color,transform] duration-150 active:translate-y-px",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {icon}
      {children}
    </a>
  );
}

export function IconButton({
  label,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-ink/[0.06] hover:text-ink active:bg-ink/10 disabled:opacity-40",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- Avatars */

export function Avatar({
  person,
  size = 32,
  ring = false,
  className,
}: {
  person: Pick<Participant, "name" | "color">;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  const c = avatarColor(person.color);
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-[-0.01em] select-none",
        ring && "ring-2 ring-card",
        className,
      )}
      style={{ width: size, height: size, background: c.bg, color: c.fg, fontSize: Math.round(size * 0.38) }}
    >
      {initials(person.name)}
    </span>
  );
}

export function AvatarStack({ people, size = 28, max = 6 }: { people: Participant[]; size?: number; max?: number }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="inline-flex items-center" aria-label={people.map((p) => p.name).join(", ")}>
      {shown.map((p, i) => (
        <Avatar key={p.id} person={p} size={size} ring className={i ? "-ml-1.5" : ""} />
      ))}
      {rest > 0 && (
        <span
          className="-ml-2 inline-flex items-center justify-center rounded-full bg-paper-2 text-[0.7rem] font-semibold text-ink-2 ring-2 ring-card"
          style={{ width: size, height: size }}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}

/* ---------------------------------------------------------------- Money */

export function Money({
  value,
  currency,
  signed,
  tone,
  className,
}: {
  value: number;
  currency: string;
  signed?: boolean;
  tone?: "auto" | "none";
  className?: string;
}) {
  const color = tone === "auto" ? (value > 0 ? "text-gain" : value < 0 ? "text-owe" : "text-ink-3") : "";
  return <span className={cx("tabular", color, className)}>{formatMoney(value, currency, { signed })}</span>;
}

/* ---------------------------------------------------------------- Forms */

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  className,
  optional,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
  optional?: boolean;
}) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[0.84rem] font-semibold text-ink">
        {label}
        {optional && <span className="ml-1.5 font-normal text-ink-3">optional</span>}
      </label>
      {children}
      {error ? (
        <p className="text-[0.8rem] font-medium text-owe" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[0.8rem] text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputBase =
  "h-11 rounded-[0.6rem] bg-card px-3.5 text-[0.95rem] text-ink ring-1 ring-line ring-inset placeholder:text-ink-3 transition-shadow hover:ring-ink/25 focus:ring-2 focus:ring-forest focus:outline-none aria-[invalid=true]:ring-owe";

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function TextInput({ className, invalid, ...rest }, ref) {
    return <input ref={ref} aria-invalid={invalid || undefined} className={cx(inputBase, "w-full", className)} {...rest} />;
  },
);

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cx("relative", className)}>
      <select className={cx(inputBase, "w-full appearance-none pr-9")} {...rest}>
        {children}
      </select>
      <LuChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-3" />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[0.7rem] bg-paper-2 p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              const i = options.findIndex((x) => x.value === value);
              const next = options[(i + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
              onChange(next.value);
              (e.currentTarget.parentElement?.querySelectorAll("button")[options.indexOf(next)] as HTMLElement)?.focus();
            }}
            tabIndex={on ? 0 : -1}
            className={cx(
              "rounded-lg font-semibold transition-all duration-150",
              size === "sm" ? "px-2.5 py-1 text-[0.8rem]" : "px-3.5 py-1.5 text-[0.86rem]",
              on ? "bg-card text-ink shadow-[0_1px_2px_rgba(23,36,30,.12)]" : "text-ink-2 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- Dialogs */

/**
 * Modal built on the native <dialog> element: real focus trapping, Esc to
 * close and an inert page behind it for free. "drawer" slides in from the
 * right on desktop and becomes a bottom sheet on phones.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = "center",
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  variant?: "center" | "drawer";
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const autoId = useId();
  const titleId = labelledBy ?? autoId;
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      document.documentElement.classList.add("modal-open");
    }
    if (!open && d.open) {
      d.close();
      document.documentElement.classList.remove("modal-open");
    }
    return () => document.documentElement.classList.remove("modal-open");
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cx("tm-dialog", variant === "drawer" ? "tm-drawer" : "tm-center")}
    >
      {open && (
        <div className="flex max-h-full min-h-0 flex-col">
          <header className="flex items-start gap-4 px-5 pt-5 pb-3 sm:px-7 sm:pt-6">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="font-display text-[1.6rem] leading-tight font-medium text-ink">
                {title}
              </h2>
              {description && <p className="mt-1 text-[0.9rem] text-ink-2">{description}</p>}
            </div>
            <IconButton label="Close" onClick={onClose} className="-mt-1 -mr-2">
              <LuX className="size-5" aria-hidden />
            </IconButton>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-7">{children}</div>
          {footer && (
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line/80 bg-card px-5 py-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:px-7">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  tone = "danger",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={tone}
            autoFocus
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-[0.95rem] text-ink-2">{body}</div>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- Misc */

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 28 28" className="size-7" aria-hidden>
        {/* A luggage tag: the product's one mark. */}
        <path
          d="M9 3h10a3 3 0 0 1 3 3v15.5a3.5 3.5 0 0 1-3.5 3.5h-9A3.5 3.5 0 0 1 6 21.5V6a3 3 0 0 1 3-3Z"
          fill={light ? "#F3F0E7" : "#173B2F"}
        />
        <circle cx="14" cy="8.5" r="2" fill={light ? "#173B2F" : "#F3F0E7"} />
        <path d="M10 15h8M10 19h5" stroke="#F2B33D" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <span className={cx("font-display text-[1.35rem] leading-none font-semibold tracking-[-0.02em]", light ? "text-paper" : "text-forest")}>
        Tripmate
      </span>
    </span>
  );
}

export function EmptyState({
  title,
  body,
  action,
  art,
}: {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  art?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {art}
      <h3 className="font-display text-2xl font-medium text-ink">{title}</h3>
      {body && <p className="mt-2 max-w-sm text-[0.95rem] text-ink-2">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Panel({ children, className, as: As = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  return <As className={cx("rounded-2xl bg-card ring-1 ring-line/70 shadow-card", className)}>{children}</As>;
}
