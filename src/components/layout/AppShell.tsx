import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { TopBar } from './TopBar';

export function AppShell() {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6">
        <div key={pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
