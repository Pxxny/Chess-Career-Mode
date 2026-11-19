import { temporaryCareer } from "@/utils/temporaryCareer";
import { Link } from "react-router-dom";
import { useGameStore } from "@/store/gameStore";
import { lazy, Suspense } from "react";
import { tourDismissed } from "@/features/onboarding/preferences";
import { CareerNewsDialog } from "@/features/news/CareerNews";
import { SeasonProgressDialog } from "@/features/career/SimulateSeason";
import { SocialGameDialog } from "@/features/world/SocialGameDialog";
import { YearReviewDialog } from "@/features/career/YearReviews";
import { CalendarProgressDialog } from "@/features/qol/CareerPanels";
import { Outlet, useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";
import { useScreenWakeLock } from "@/hooks/useScreenWakeLock";

const CareerTour = lazy(() => import("@/features/onboarding/CareerTour").then((module) => ({ default: module.CareerTour })));
export function AppShell() {
  const { pathname } = useLocation();
  const wakeStatus = useScreenWakeLock();
  const pending = useGameStore(s=>s.save?.pendingMatch);

  return (
    <div className="app-shell flex min-h-dvh flex-col lg:pl-[72px]">
      <TopBar wakeStatus={wakeStatus} />
      {temporaryCareer && <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-600 bg-navy-800 px-4 py-2 text-xs text-gold-300">
        <span>Temporary career · Export a backup before leaving.</span>
        <a className="inline-flex min-h-10 items-center underline" href="/">Return to saved careers</a>
      </div>}
      <main className="phone-content mx-auto w-full max-w-[1370px] min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-8 sm:pt-8 lg:pb-12">
        {pending&&pathname!=="/complete"&&<Link to="/complete" className="mb-4 flex items-center justify-between rounded-xl border border-gold-500/30 bg-gold-500/10 p-3 text-sm font-semibold text-gold-300"><span>Match in progress · {pending.ucis.length} plies</span><span>Resume match →</span></Link>}
        <div key={pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
      <BottomNav />
      <CalendarProgressDialog />
      <SeasonProgressDialog />
      <CareerNewsDialog />
      {!tourDismissed() && <Suspense fallback={null}><CareerTour /></Suspense>}
      <YearReviewDialog />
      <SocialGameDialog />
    </div>
  );
}
