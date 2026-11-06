import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '@/data/navigation';
import { cn } from '@/utils/cn';

export function BottomNav() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/5 bg-navy-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-5xl grid-cols-4">
        {NAV_ITEMS.map(({ id, label, path, icon: Icon }) => (
          <li key={id}>
            <NavLink
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-col items-center gap-1 py-3 text-xs font-semibold transition-colors',
                  isActive ? 'text-gold-400' : 'text-ink-faint hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden
                    className={cn(
                      'absolute top-0 h-0.5 w-8 rounded-full bg-gold-500 transition-opacity',
                      isActive ? 'opacity-100' : 'opacity-0',
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
    </nav>
  );
}
