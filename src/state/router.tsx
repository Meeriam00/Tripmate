import { useEffect, useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from "react";

/**
 * A small History-API router. Clean URLs (/app/sefer/…), and vercel.json
 * rewrites every path to index.html so a refresh on any page works.
 */

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
if (typeof window !== "undefined") window.addEventListener("popstate", emit);

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}
const snapshot = () => window.location.pathname + window.location.search;

export function navigate(to: string, opts: { replace?: boolean; keepScroll?: boolean } = {}) {
  if (to === snapshot()) return;
  if (opts.replace) history.replaceState(null, "", to);
  else history.pushState(null, "", to);
  emit();
  if (!opts.keepScroll) window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
}

export function useLocation() {
  const full = useSyncExternalStore(subscribe, snapshot, () => "/");
  const [path, search = ""] = full.split("?");
  return { path: path.replace(/\/+$/, "") || "/", query: new URLSearchParams(search) };
}

/** Match "/app/sefer/:id/:tab?" style patterns. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split("/").filter(Boolean);
  const s = path.split("/").filter(Boolean);
  const out: Record<string, string> = {};
  let i = 0;
  for (; i < p.length; i++) {
    const seg = p[i];
    if (seg === "*") {
      out["*"] = s.slice(i).join("/");
      return out;
    }
    const optional = seg.endsWith("?");
    const name = seg.replace(/^:/, "").replace(/\?$/, "");
    if (s[i] === undefined) {
      if (optional) continue;
      return null;
    }
    if (seg.startsWith(":")) out[name] = decodeURIComponent(s[i]);
    else if (seg !== s[i]) return null;
  }
  return s.length > p.length ? null : out;
}

export function Link({ to, replace, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; replace?: boolean }) {
  return (
    <a
      href={to}
      {...rest}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || rest.target === "_blank") return;
        e.preventDefault();
        navigate(to, { replace });
      }}
    />
  );
}

export function Redirect({ to }: { to: string }) {
  useEffect(() => navigate(to, { replace: true }), [to]);
  return null;
}

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · TRIPMATE` : "TRIPMATE — səfər xərclərini dostlarla asan bölüşün";
  }, [title]);
}

/** Keep a "next" target only if it is a path on this site. */
export function safeNext(q: URLSearchParams, fallback = "/app") {
  const n = q.get("next");
  return n && n.startsWith("/") && !n.startsWith("//") ? n : fallback;
}
