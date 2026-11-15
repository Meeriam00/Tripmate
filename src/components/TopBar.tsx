import type { ReactNode } from "react";
import { LuPlus } from "react-icons/lu";
import { useStore } from "../state/store";
import { LinkButton, Logo, cx } from "./ui";

export function TopBar({ children, className }: { children?: ReactNode; className?: string }) {
  const { trips } = useStore();
  return (
    <header className={cx("sticky top-0 z-40 border-b border-line/60 bg-paper/85 backdrop-blur-md", className)}>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <a href="#/" aria-label="Tripmate home" className="rounded-md">
          <Logo />
        </a>
        <div className="min-w-0 flex-1">{children}</div>
        <nav className="flex items-center gap-1" aria-label="Main">
          {trips.length > 0 && (
            <a
              href="#/"
              onClick={() => setTimeout(() => document.getElementById("trips")?.scrollIntoView({ behavior: "smooth" }), 60)}
              className="hidden rounded-lg px-3 py-2 text-[0.9rem] font-medium text-ink-2 hover:bg-ink/[0.05] hover:text-ink sm:block">
              Your trips
            </a>
          )}
          <LinkButton href="#/new" variant="primary" size="sm" icon={<LuPlus aria-hidden />}>
            New trip
          </LinkButton>
        </nav>
      </div>
    </header>
  );
}
