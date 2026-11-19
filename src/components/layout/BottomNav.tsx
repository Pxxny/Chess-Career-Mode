import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Crown, Grid2X2, CalendarDays, Swords, UserRound, TrendingUp, Globe2, Trophy, Users, ScrollText, Compass } from "lucide-react";
import { NAV_ITEMS, ROUTES } from "@/data/navigation";
import { Modal } from "@/components/ui";
import { translateUI } from "@/i18n/translate";

const groups = [
  { label: "Competition", destinations: [
    ["/complete?tab=calendar", "Tournament calendar", CalendarDays],
    ["/complete?tab=calendar&display=atlas", "Tournament atlas", Compass],
    ["/complete?section=match", "Matchday", Swords],
    ["/complete?tab=players", "Player directory", Users],
    ["/complete?tab=world", "World Hub", Globe2],
  ] },
  { label: "Career", destinations: [
    ["/profile", "Profile", UserRound],
    ["/profile?tab=stats", "Elo analytics", TrendingUp],
    ["/career?view=championship", "Championship path", Crown],
    ["/career?view=hall-of-fame", "Hall of Fame", Trophy],
    ["/changelog", "Changelog", ScrollText],
  ] },
] as const;

export function BottomNav() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <nav aria-label="Main" className="workspace-rail">
        <Link aria-label="Chess Career Mode" to={ROUTES.home} className="workspace-brand"><Crown size={21} aria-hidden /></Link>
        {NAV_ITEMS.map(({ id, label, path, icon: Icon }) => (
          <NavLink key={id} to={path} end={path === "/"} title={translateUI(label)} className="workspace-nav-item">
            <Icon size={20} aria-hidden />
            <span className="workspace-nav-label">{label}</span>
          </NavLink>
        ))}
        <button type="button" className="workspace-nav-item workspace-more" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
          <Grid2X2 size={20} aria-hidden />
          <span className="workspace-nav-label">More</span>
        </button>
      </nav>
      {open && <Modal open title="All menus" presentation="sheet" onClose={() => setOpen(false)}>
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map(group => <section key={group.label}>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">{group.label}</h2>
            <ul className="divide-y divide-navy-600/70">
              {group.destinations.map(([to, label, Icon]) => <li key={to}>
                <Link to={to} onClick={() => setOpen(false)} aria-current={location.pathname + location.search === to ? "page" : undefined}
                  className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm hover:bg-navy-700 aria-[current=page]:text-gold-300">
                  <Icon size={17} className="shrink-0 text-gold-300" aria-hidden /><span>{label}</span>
                </Link>
              </li>)}
            </ul>
          </section>)}
        </div>
      </Modal>}
    </>
  );
}
