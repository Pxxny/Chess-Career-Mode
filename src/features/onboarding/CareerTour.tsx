import { useContext, useEffect, useState } from "react";
import Joyride, { ACTIONS, STATUS, type CallBackProps } from "react-joyride";
import { useLocation } from "react-router-dom";
import { useGameStore } from "@/store/gameStore";
import { highlightsOf } from "@/game/career/highlights";
import { LanguageContext } from "@/i18n/context";
import { translateUI as t } from "@/i18n/translate";
import { dismissTourForever, tourDismissed } from "./preferences";

export function CareerTour() {
  useContext(LanguageContext);
  const { pathname } = useLocation();
  const [run, setRun] = useState(false), [done, setDone] = useState(tourDismissed);
  useEffect(() => {
    if (done || pathname !== "/") { setRun(false); return; }
    const timer = setInterval(() => {
      const { save, seasonRunning, calendarProgress } = useGameStore.getState();
      if (tourDismissed()) { setDone(true); setRun(false); return; }
      if (!save || seasonRunning || calendarProgress || highlightsOf(save).unread.length || document.querySelector('[role="dialog"]')) return;
      if (document.querySelector('[data-tour="ratings"]')) { setRun(true); clearInterval(timer); }
    }, 1000);
    return () => clearInterval(timer);
  }, [done, pathname]);
  useEffect(() => {
    const sync = () => { if (tourDismissed()) { setDone(true); setRun(false); } };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const callback = ({ action, status }: CallBackProps) => {
    if (action === ACTIONS.CLOSE || status === STATUS.SKIPPED || status === STATUS.FINISHED) {
      dismissTourForever(); setDone(true); setRun(false);
    }
  };
  return <Joyride run={run && pathname === "/" && !done} continuous showSkipButton showProgress scrollOffset={130} callback={callback}
    steps={[
      { target: '[data-tour="ratings"]', disableBeacon: true, title: t("Welcome to your chess career"), content: t("Follow your Elo, rankings and progress here. You can close or skip this tour and it will never appear again in this browser.") },
      { target: 'nav a[href="/train"]', content: t("Train skills, manage your energy and play practice games.") },
      { target: '[data-testid="simulate-season-panel"]', content: t("Choose a season approach and learning priorities. Important career news will pause simulation automatically.") },
      { target: 'a[href="/profile?tab=stats"]', content: t("Open your statistics to explore Elo by tournament, month or year.") },
    ]}
    locale={{ back: t("Back"), close: t("Close tour"), last: t("Finish tour"), next: t("Next"), skip: t("Do not show again"), open: t("Open tour") }}
    styles={{ options: { backgroundColor: "#222d26", primaryColor: "#afc995", textColor: "#eeeae1", arrowColor: "#222d26", zIndex: 60, width: 340 }, tooltip: { borderRadius: 18, padding: 20 }, buttonNext: { color: "#151c19" }, buttonSkip: { color: "#bbc7b9" }, buttonClose: { color: "#eeeae1" } }} />;
}
