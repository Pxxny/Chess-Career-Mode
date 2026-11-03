import { useEffect } from 'react';
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
import { ProfilePage } from '@/pages/ProfilePage';
import { TrainPage } from '@/pages/TrainPage';
import { useGameStore } from '@/store/gameStore';
import { useNpcStore } from '@/store/npcStore';

export default function App() {
  const hydrated = useStoreHydration();
  const career = useGameStore((s) => s.save?.career ?? null);
  const npcsReady = useNpcStore((s) => s.status === 'ready' && s.careerId === (career?.id ?? null));
  const loadDatabase = useNpcStore((s) => s.loadDatabase);

  // Load the NPC database that belongs to the saved career.
  useEffect(() => {
    if (hydrated && career) void loadDatabase(career);
  }, [hydrated, career, loadDatabase]);

  useWorldSync();

  if (!hydrated) return <SplashScreen />;
  if (!career) return <CharacterCreationPage />;
  if (!npcsReady) return <SplashScreen />;

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
