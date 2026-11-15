import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { LuX } from "react-icons/lu";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ---------------------------------------------------------------- Buttons */

type Variant = "sun" | "dark" | "soft" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  sun: "bg-sun text-ink hover:bg-sun-2 active:bg-sun-2",
  dark: "bg-ink text-white hover:bg-black",
  soft: "bg-mist text-ink hover:bg-line",
  ghost: "text-ink-2 hover:bg-mist hover:text-ink",
  danger: "bg-owe text-white hover:brightness-110",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "md" | "lg";
  icon?: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-colors duration-150 select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "sun", size = "md", icon, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(base, VARIANTS[variant], size === "lg" ? "h-14 px-7 text-[1rem]" : "h-11 px-5 text-[0.92rem]", className)}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

export function LinkButton({
  href,
  variant = "sun",
  size = "md",
  icon,
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: "md" | "lg";
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a href={href} className={cx(base, VARIANTS[variant], size === "lg" ? "h-14 px-7 text-[1rem]" : "h-11 px-5 text-[0.92rem]", className)}>
      {icon}
      {children}
    </a>
  );
}

export function IconButton({ label, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/[0.06] disabled:opacity-30",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- Tiles */

/** The reference's icon tile: rounded square, soft orange rim, cream fill. */
export function Tile({ children, size = 44, className }: { children: ReactNode; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-[14px] border-2 border-sun-soft bg-cream-2 font-semibold text-ink",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
    >
      {children}
    </span>
  );
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toLocaleUpperCase("az") + parts[0].slice(1, 2).toLocaleLowerCase("az");
  return (parts[0][0] + parts[parts.length - 1][0]).toLocaleUpperCase("az");
}

export function PersonTile({ name, size = 44 }: { name: string; size?: number }) {
  return <Tile size={size}>{initials(name)}</Tile>;
}

/* ---------------------------------------------------------------- Forms */

export function Field({
  label,
  htmlFor,
  error,
  hint,
  optional,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string | null;
  hint?: ReactNode;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <label htmlFor={htmlFor} className="text-[0.86rem] font-semibold text-ink">
        {label}
        {optional && <span className="ml-1.5 font-normal text-ink-3">(istəyə bağlı)</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-[0.8rem] font-medium text-owe">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[0.8rem] text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "h-12 w-full rounded-2xl border border-line bg-white px-4 text-[0.95rem] text-ink placeholder:text-ink-3 transition-colors hover:border-ink-3/60 focus:border-sun focus:ring-4 focus:ring-sun/25 focus:outline-none aria-[invalid=true]:border-owe";

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function TextInput({ className, invalid, ...rest }, ref) {
    return <input ref={ref} aria-invalid={invalid || undefined} className={cx(inputClass, className)} {...rest} />;
  },
);

/** A pill toggle used for "who paid" (radio) and "who took part" (checkbox). */
export function Chip({
  selected,
  onClick,
  children,
  role,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  role: "radio" | "checkbox";
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      className={cx(
        "inline-flex h-11 items-center gap-2 rounded-full border-2 px-4 text-[0.9rem] font-medium transition-colors",
        selected ? "border-sun bg-sun text-ink" : "border-line bg-white text-ink-2 hover:border-sun-soft hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- Section header */

/** Mirrors the reference's date row: label left, small figure right, orange rule below. */
export function SectionHead({ title, aside, id }: { title: string; aside?: ReactNode; id?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b-2 border-sun px-5 pt-5 pb-3 sm:px-7">
      <h2 id={id} className="text-[1rem] font-semibold text-ink">
        {title}
      </h2>
      {aside && <span className="text-[0.8rem] font-medium text-ink-2">{aside}</span>}
    </div>
  );
}

/* ---------------------------------------------------------------- Dialogs */

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
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
      className="tm-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="flex min-h-0 flex-col">
          <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-line sm:hidden" aria-hidden />
          <header className="flex items-center justify-between gap-4 px-6 pt-4 pb-2 sm:pt-6">
            <h2 id={titleId} className="text-[1.25rem] font-semibold">
              {title}
            </h2>
            <IconButton label="Bağla" onClick={onClose} className="-mr-2 text-ink-2">
              <LuX className="size-5" aria-hidden />
            </IconButton>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-2 pb-6">{children}</div>
          {footer && (
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
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
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Ləğv et
          </Button>
          <Button
            variant="danger"
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
      <p className="text-[0.95rem] text-ink-2">{body}</p>
    </Dialog>
  );
}
