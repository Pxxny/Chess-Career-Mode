import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { SplashScreen } from '@/components/layout/SplashScreen';
import { ROUTES } from '@/data/navigation';
import { useStoreHydration } from '@/hooks/useStoreHydration';
import { useWorldSync } from '@/hooks/useWorldSync';
import { CareerPage } from '@/pages/CareerPage';
import { CharacterCreationPage } from '@/pages/CharacterCreationPage';
import { CompletePage } from '@/pages/CompletePage';
import { HomePage } from '@/pages/HomePage';
import { SaveSlotsPage } from '@/pages/SaveSlotsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { TrainPage } from '@/pages/TrainPage';
import { useGameStore } from '@/store/gameStore';
import { useNpcStore } from '@/store/npcStore';
import { useOpeningStore } from '@/store/openingStore';
import { useSlotUi } from '@/store/slotUi';

export default function App() {
  const hydrated = useStoreHydration();
  const career = useGameStore((s) => s.save?.career ?? null);
  const npcsReady = useNpcStore((s) => s.status === 'ready' && s.careerId === (career?.id ?? null));
  const loadDatabase = useNpcStore((s) => s.loadDatabase);
  const openingsReady = useOpeningStore((s) => s.status === 'ready');
  const loadOpenings = useOpeningStore((s) => s.load);
  const creatingSlot = useSlotUi((s) => s.creatingSlot);
  const [recoveredCareer, setRecoveredCareer] = useState<string | null>(null);

  // Load the NPC database that belongs to the saved career.
  useEffect(() => {
    if (hydrated && career) void loadDatabase(career);
  }, [hydrated, career, loadDatabase]);

  // Games use the saved repertoire too, including when Openings has not been visited.
  useEffect(() => {
    if (hydrated && career) void loadOpenings();
  }, [hydrated, career, loadOpenings]);

  useEffect(() => {
    if (!hydrated || !career || !openingsReady || recoveredCareer === career.id) return;
    useGameStore.getState().recoverPracticeGame(useOpeningStore.getState().db);
    useGameStore.getState().recoverMatch(useOpeningStore.getState().db);
    setRecoveredCareer(career.id);
  }, [hydrated, career, openingsReady, recoveredCareer]);

  useWorldSync();

  if (!hydrated) return <SplashScreen />;
  // No open character: pick one of the saved characters, or create one in an empty slot.
  if (!career) return creatingSlot !== null ? <CharacterCreationPage slot={creatingSlot} /> : <SaveSlotsPage />;
  if (!npcsReady || !openingsReady || recoveredCareer !== career.id) return <SplashScreen />;

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
