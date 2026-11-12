import { NavLink } from "react-router-dom";
import { Crown, UserRound } from "lucide-react";
import { NAV_ITEMS } from "@/data/navigation";
import { cn } from "@/utils/cn";

export function BottomNav() {
  return (
    <nav
      aria-label="Main"
      className="main-navigation fixed inset-x-3 bottom-3 z-30 rounded-2xl border border-white/10 bg-navy-900/95 pb-[env(safe-area-inset-bottom)] shadow-xl backdrop-blur-xl lg:inset-y-0 lg:left-0 lg:right-auto lg:flex lg:w-60 lg:flex-col lg:rounded-none lg:border-0 lg:border-r lg:border-white/[0.07] lg:bg-navy-900 lg:p-5 lg:shadow-none"
    >
      <div className="mb-12 mt-3 hidden items-center gap-3 px-2 lg:flex" aria-label="Chess Career Mode">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-500 text-navy-950"><Crown size={25} strokeWidth={1.7} aria-hidden /></span>
        <span><span className="block text-xl font-bold tracking-tight text-ink">Chess</span><span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-faint">Career mode</span></span>
      </div>
      <p className="mb-3 hidden px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint lg:block">Your workspace</p>
      <ul className="mx-auto grid w-full grid-cols-4 gap-1 lg:grid-cols-1 lg:gap-2">
        {NAV_ITEMS.map(({ id, label, path, icon: Icon }) => (
          <li key={id}>
            <NavLink
              to={path}
              end={path === "/"}
              className={({ isActive }) =>
                cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 py-3 text-[11px] font-semibold transition-colors sm:text-xs lg:flex-row lg:justify-start lg:gap-3 lg:px-4 lg:text-sm",
                  isActive ? "bg-gold-500/10 text-gold-300" : "text-ink-muted hover:bg-white/5 hover:text-ink",
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
      <div className="mt-auto hidden rounded-2xl border border-gold-500/10 bg-gold-500/5 p-4 lg:block">
        <Crown size={20} className="mb-3 text-gold-400" aria-hidden />
        <p className="text-sm font-semibold text-ink">One move at a time.</p>
        <p className="mt-1 text-xs text-ink-faint">Build your own chess story.</p>
      </div>
    </nav>
  );
}
