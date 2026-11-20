import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { LoadingReveal, SplashScreen } from "@/components/layout/SplashScreen";
import { ROUTES } from "@/data/navigation";
import { useStoreHydration } from "@/hooks/useStoreHydration";
import { useWorldSync } from "@/hooks/useWorldSync";
import { SaveSlotsPage } from "@/pages/SaveSlotsPage";
import { useGameStore } from "@/store/gameStore";
import { useNpcStore } from "@/store/npcStore";
import { useOpeningStore } from "@/store/openingStore";
import { useLoadingStatus } from "@/store/loadingStatus";
import { useSlotUi } from "@/store/slotUi";
import { syncNpcSaveNames } from "@/game/npc/saveNames";

// Download each screen only when the player opens it.
const AppShell = lazy(() => import("@/components/layout/AppShell").then(module => ({ default: module.AppShell })));
const CareerPage = lazy(() => import("@/pages/CareerPage").then(module => ({ default: module.CareerPage })));
const CharacterCreationPage = lazy(() => import("@/pages/CharacterCreationPage").then(module => ({ default: module.CharacterCreationPage })));
const CompletePage = lazy(() => import("@/pages/CompletePage").then(module => ({ default: module.CompletePage })));
const HomePage = lazy(() => import("@/pages/HomePage").then(module => ({ default: module.HomePage })));
const ProfilePage = lazy(() => import("@/pages/ProfilePage").then(module => ({ default: module.ProfilePage })));
const TrainPage = lazy(() => import("@/pages/TrainPage").then(module => ({ default: module.TrainPage })));
const ChangelogPage = lazy(() => import("@/pages/ChangelogPage").then(module => ({ default: module.ChangelogPage })));

export default function App() {
  const location = useLocation();
  const hydrated = useStoreHydration();
  const represented = useGameStore((s) => s.save?.player.country);
  const homeCity = useGameStore((s) => s.save?.player.city.name);
  const cohortYear = useGameStore((s) => {
    const save = s.save,
      last = save?.qol?.moves.at(-1);
    return last ? Math.floor(last.day / 364) : save?.career.startYear;
  });
  const career = useGameStore((s) => s.save?.career ?? null);
  const npcOrder = useGameStore((s) => s.save?.npcOrder);
  const npcsReady = useNpcStore(
    (s) => s.status === "ready" && s.careerId === (career?.id ?? null),
  );
  const loadDatabase = useNpcStore((s) => s.loadDatabase);
  const openingsReady = useOpeningStore((s) => s.status === "ready");
  const loadOpenings = useOpeningStore((s) => s.load);
  // NPC count contributes only to the current career. Reserve later milestones for
  // database persistence, repertoire, match recovery and the screen itself.
  const playerProgress = useLoadingStatus(state =>
    state.careerId === career?.id && state.total > 0
      ? Math.max(0, Math.min(1, state.done / state.total)) : 0
  );
  const creatingSlot = useSlotUi((s) => s.creatingSlot);
  const [recoveredCareer, setRecoveredCareer] = useState<string | null>(null);

  // Load the NPC database that belongs to the saved career.
  useEffect(() => {
    if (hydrated && career) void loadDatabase(career, npcOrder);
  }, [hydrated, career, npcOrder, loadDatabase]);

  // Recover a current-home cohort too when an older or partially restored NPC world is opened.
  useEffect(() => {
    if (!npcsReady || !career || !represented || !homeCity || !cohortYear)
      return;
    void useNpcStore
      .getState()
      .ensureLocalPool(career.id, represented, homeCity, cohortYear)
      .then(() => {
        const current = useGameStore.getState().save;
        if (
          current?.career.id === career.id &&
          useNpcStore.getState().careerId === career.id
        ) {
          const renamed = syncNpcSaveNames(
            current,
            useNpcStore.getState().npcs,
          );
          if (renamed !== current) useGameStore.setState({ save: renamed });
          void useNpcStore.getState().syncWorld({
            ...current.world.date,
            alternateHistory: current.world.alternateHistory,
          });
        }
      });
  }, [npcsReady, career, represented, homeCity, cohortYear]);

  // Games use the saved repertoire too, including when Openings has not been visited.
  useEffect(() => {
    if (hydrated && career) void loadOpenings();
  }, [hydrated, career, loadOpenings]);

  useEffect(() => {
    if (!hydrated || !career || !openingsReady || recoveredCareer === career.id)
      return;
    useGameStore.getState().recoverPracticeGame(useOpeningStore.getState().db);
    useGameStore.getState().recoverMatch(useOpeningStore.getState().db);
    setRecoveredCareer(career.id);
  }, [hydrated, career, openingsReady, recoveredCareer]);

  useWorldSync();

  if (!hydrated) return <SplashScreen phase="Reading saved careers…" percent={5} />;
  // No open character: pick one of the saved characters, or create one in an empty slot.
  if (!career)
    return creatingSlot !== null ? (
      <Suspense fallback={<SplashScreen phase="Opening character creation…" percent={95} />}>
        <LoadingReveal key={creatingSlot}><CharacterCreationPage slot={creatingSlot} /></LoadingReveal>
      </Suspense>
    ) : (
      <SaveSlotsPage />
    );
  if (!npcsReady || !openingsReady || recoveredCareer !== career.id)
    return <SplashScreen
      phase={!npcsReady ? "Reading player database…" : !openingsReady ? "Loading opening repertoire…" : "Restoring your career…"}
      percent={!npcsReady ? 15 + Math.floor(50 * playerProgress) : !openingsReady ? 75 : 85}
      showWorker={!npcsReady}
    />;

  return (
    <Suspense fallback={<SplashScreen phase="Opening game screen…" percent={95} />}>
      <LoadingReveal key={career.id}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path={ROUTES.train} element={<TrainPage />} />
            <Route path={ROUTES.complete} element={<CompletePage />} />
            <Route path={ROUTES.career} element={<CareerPage />} />
            <Route path={ROUTES.profile} element={<ProfilePage />} />
            <Route path={ROUTES.changelog} element={<ChangelogPage />} />
            <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
          </Route>
        </Routes>
      </LoadingReveal>
    </Suspense>
  );
}
