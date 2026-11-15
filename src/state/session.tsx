import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { backend, type Session } from "../backend";
import type { Profile, Theme } from "../lib/types";
import { navigate } from "./router";

/** Auth session + profile, and the theme that follows the profile. */
interface SessionState {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  refresh: () => Promise<void>;
  setProfile: (p: Profile) => void;
}

const Ctx = createContext<SessionState>({ ready: false, session: null, profile: null, refresh: async () => {}, setProfile: () => {} });
export const useSession = () => useContext(Ctx);

export function applyTheme(theme: Theme) {
  try {
    localStorage.setItem("tripmate:theme", theme);
  } catch {
    /* private mode */
  }
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#12111b" : "#f3edff");
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const refresh = useCallback(async () => {
    const s = await backend.getSession();
    setSession(s);
    setProfile(s ? await backend.getProfile() : null);
  }, []);

  useEffect(() => {
    refresh()
      .catch((e) => console.error(e))
      .finally(() => setReady(true));
    return backend.onAuthChange((s, event) => {
      setSession(s);
      if (!s) setProfile(null);
      else void backend.getProfile().then(setProfile);
      if (event === "PASSWORD_RECOVERY") navigate("/sifre-yenile", { replace: true });
    });
  }, [refresh]);

  useEffect(() => {
    if (profile) applyTheme(profile.theme);
  }, [profile]);

  return <Ctx.Provider value={{ ready, session, profile, refresh, setProfile }}>{children}</Ctx.Provider>;
}
