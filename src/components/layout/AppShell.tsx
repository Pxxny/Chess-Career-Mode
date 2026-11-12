import { SeasonProgressDialog } from "@/features/career/SimulateSeason";
import { SocialGameDialog } from "@/features/world/SocialGameDialog";
import { YearReviewDialog } from "@/features/career/YearReviews";
import { CalendarProgressDialog } from "@/features/qol/CareerPanels";
import { Outlet, useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";

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
      <CalendarProgressDialog />
      <SeasonProgressDialog />
      <YearReviewDialog />
      <SocialGameDialog />
    </div>
  );
}
