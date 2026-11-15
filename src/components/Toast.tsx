import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LuCircleCheck, LuX } from "react-icons/lu";

interface Toast {
  id: number;
  message: string;
}

const Ctx = createContext<{ show: (message: string) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback((message: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-1), { id, message }]);
  }, []);
  const api = useMemo(() => ({ show }), [show]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        role="region"
        aria-label="Bildirişlər"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] z-[70] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDone={() => dismiss(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastItem({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => done.current(), 3000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div role="status" className="toast-in pointer-events-auto flex items-center gap-3 rounded-full bg-ink py-2.5 pr-2 pl-4 text-[0.9rem] text-white shadow-lg">
      <LuCircleCheck className="shrink-0 text-sun" aria-hidden />
      <span>{toast.message}</span>
      <button aria-label="Bağla" onClick={onDone} className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
        <LuX aria-hidden />
      </button>
    </div>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast outside ToastProvider");
  return c;
}
