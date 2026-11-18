import { Link, NavLink, useLocation } from "react-router-dom";
import { Crown, ScrollText, UserRound } from "lucide-react";
import { NAV_ITEMS, ROUTES } from "@/data/navigation";
import { cn } from "@/utils/cn";

const destinations = [
  ["/career?view=championship", "Championship path"],
  ["/complete?section=match", "Matchday"],
  ["/career?view=hall-of-fame", "Hall of Fame"],
  ["/profile?tab=stats", "Elo analytics"],
  ["/complete?tab=players", "Player directory"],
  ["/complete?tab=world", "World Hub"],
  ["/complete?tab=calendar", "Tournament calendar"],
] as const;

export function BottomNav() {
  const location = useLocation();
  return (
    <nav
      aria-label="Main"
      className="main-navigation fixed inset-x-0 bottom-0 z-30 border-t border-navy-600 bg-navy-900/95 pb-[env(safe-area-inset-bottom)] shadow-xl backdrop-blur-xl lg:inset-y-0 lg:left-0 lg:right-auto lg:flex lg:w-[246px] lg:flex-col lg:rounded-none lg:border-0 lg:border-r lg:border-white/[0.07] lg:bg-navy-900 lg:overflow-y-auto lg:p-5 lg:shadow-none"
    >
      <div className="mb-6 mt-3 hidden items-center gap-3 px-2 lg:flex" aria-label="Chess Career Mode">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-500 text-navy-950"><Crown size={25} strokeWidth={1.7} aria-hidden /></span>
        <span><span className="block font-display text-lg tracking-tight text-gold-300">Grandmaster Elite</span><span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-faint">Chess Career Mode</span></span>
      </div>

      <ul className="mx-auto grid w-full grid-cols-4 gap-1 lg:grid-cols-1 lg:gap-2">
        {NAV_ITEMS.map(({ id, label, path, icon: Icon }) => (
          <li key={id}>
            <NavLink
              to={path}
              end={path === "/"}
              className={({ isActive }) =>
                cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 py-3 text-[11px] font-semibold transition-colors sm:text-xs lg:flex-row lg:justify-start lg:gap-3 lg:px-4 lg:text-sm",
                  isActive ? "bg-navy-700 ring-1 ring-inset ring-gold-500/40 text-gold-300" : "text-ink-muted hover:bg-white/5 hover:text-ink",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-0 h-0.5 w-8 rounded-full bg-gold-500 transition-opacity lg:inset-y-4 lg:left-0 lg:h-auto lg:w-0.5",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <Icon size={22} aria-hidden />
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
      <NavLink to="/profile" className={({ isActive }) => `mt-5 hidden min-h-12 items-center gap-3 rounded-xl border-t border-white/10 px-4 py-4 text-sm font-semibold lg:flex ${isActive ? "text-gold-300" : "text-ink-muted hover:text-ink"}`}><UserRound size={21} aria-hidden />Profile</NavLink>
      <NavLink to={ROUTES.changelog} className={({ isActive }) => `mt-1 hidden min-h-12 items-center gap-3 rounded-xl px-4 py-4 text-sm font-semibold lg:flex ${isActive ? "text-gold-300" : "text-ink-muted hover:text-ink"}`}><ScrollText size={21} aria-hidden />Changelog</NavLink>
      <ul className="mt-3 hidden space-y-1 border-t border-navy-600 pt-3 lg:block">
        {destinations.map(([to, label]) => {
          const active = location.pathname + location.search === to;
          return <li key={to}><Link to={to} aria-current={active ? "page" : undefined}
            className={`flex min-h-10 items-center rounded-xl px-4 text-sm transition-colors hover:bg-navy-700 ${active ? "bg-navy-700 text-gold-300" : "text-ink-muted"}`}>{label}</Link></li>;
        })}
      </ul>
    </nav>
  );
}
