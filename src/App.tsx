import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { SplashScreen } from "@/components/layout/SplashScreen";
import { ROUTES } from "@/data/navigation";
import { useStoreHydration } from "@/hooks/useStoreHydration";
import { useWorldSync } from "@/hooks/useWorldSync";
import { CareerPage } from "@/pages/CareerPage";
import { CharacterCreationPage } from "@/pages/CharacterCreationPage";
import { CompletePage } from "@/pages/CompletePage";
import { HomePage } from "@/pages/HomePage";
import { SaveSlotsPage } from "@/pages/SaveSlotsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { TrainPage } from "@/pages/TrainPage";
import { useGameStore } from "@/store/gameStore";
import { useNpcStore } from "@/store/npcStore";
import { useOpeningStore } from "@/store/openingStore";
import { useSlotUi } from "@/store/slotUi";
import { syncNpcSaveNames } from "@/game/npc/saveNames";

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
  const npcsReady = useNpcStore(
    (s) => s.status === "ready" && s.careerId === (career?.id ?? null),
  );
  const loadDatabase = useNpcStore((s) => s.loadDatabase);
  const openingsReady = useOpeningStore((s) => s.status === "ready");
  const loadOpenings = useOpeningStore((s) => s.load);
  const creatingSlot = useSlotUi((s) => s.creatingSlot);
  const [recoveredCareer, setRecoveredCareer] = useState<string | null>(null);

  // Load the NPC database that belongs to the saved career.
  useEffect(() => {
    if (hydrated && career) void loadDatabase(career);
  }, [hydrated, career, loadDatabase]);

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

  if (!hydrated) return <SplashScreen />;
  // No open character: pick one of the saved characters, or create one in an empty slot.
  if (!career)
    return creatingSlot !== null ? (
      <CharacterCreationPage slot={creatingSlot} />
    ) : (
      <SaveSlotsPage />
    );
  if (!npcsReady || !openingsReady || recoveredCareer !== career.id)
    return <SplashScreen />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path={ROUTES.train} element={<TrainPage />} />
        <Route path={ROUTES.complete} element={<CompletePage />} />
        <Route path={ROUTES.career} element={<CareerPage />} />
        <Route path={ROUTES.profile} element={<ProfilePage />} />
        <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
      </Route>
    </Routes>
  );
}
