// Browser-wide preference: never reset by save slots, backup restore or a tour version change.
export const TOUR_DISMISSED_KEY = "chess-career-tour-dismissed";
let dismissedThisSession = false;
export function tourDismissed(): boolean {
  try { return dismissedThisSession || localStorage.getItem(TOUR_DISMISSED_KEY) === "yes"; }
  catch { return dismissedThisSession; }
}
export function dismissTourForever(): void {
  dismissedThisSession = true;
  try { localStorage.setItem(TOUR_DISMISSED_KEY, "yes"); } catch { /* Session preference still works when storage is disabled. */ }
}
