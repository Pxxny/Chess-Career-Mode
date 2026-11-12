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

  return (
    <div className="app-shell flex min-h-dvh flex-col lg:pl-60">
      <TopBar wakeStatus={wakeStatus} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-7 sm:pt-8 lg:pb-12">
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
