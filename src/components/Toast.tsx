import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LuCircleCheck, LuInfo, LuTriangleAlert, LuX } from "react-icons/lu";

type Tone = "success" | "info" | "error";
interface Toast {
  id: number;
  message: string;
  tone: Tone;
  action?: { label: string; run: () => void };
  duration: number;
}

interface ToastApi {
  show: (message: string, opts?: { tone?: Tone; action?: Toast["action"]; duration?: number }) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback<ToastApi["show"]>((message, opts = {}) => {
    const id = ++seq.current;
    const toast: Toast = {
      id,
      message,
      tone: opts.tone ?? "success",
      action: opts.action,
      duration: opts.duration ?? (opts.action ? 7000 : 3500),
    };
    setToasts((t) => [...t.slice(-2), toast]);
  }, []);
  const api = useMemo(() => ({ show }), [show]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[70] flex flex-col items-center gap-2 px-4 md:bottom-6"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDone={() => dismiss(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastItem({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  const [paused, setPaused] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => done.current(), toast.duration);
    return () => clearTimeout(t);
  }, [paused, toast.duration]);
  const Icon = toast.tone === "error" ? LuTriangleAlert : toast.tone === "info" ? LuInfo : LuCircleCheck;
  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="toast-in pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl bg-forest-2 py-2.5 pr-2 pl-4 text-[0.9rem] text-paper shadow-lift"
    >
      <Icon className={toast.tone === "error" ? "shrink-0 text-[#F4A38F]" : "shrink-0 text-signal"} aria-hidden />
      <span className="min-w-0 flex-1">{toast.message}</span>
      {toast.action && (
        <button
          className="rounded-md px-2.5 py-1.5 font-semibold text-signal hover:bg-white/10 focus-visible:outline-signal"
          onClick={() => {
            toast.action!.run();
            onDone();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button aria-label="Dismiss" className="rounded-md p-1.5 text-paper/60 hover:bg-white/10 hover:text-paper" onClick={onDone}>
        <LuX aria-hidden />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast outside ToastProvider");
  return c;
}
