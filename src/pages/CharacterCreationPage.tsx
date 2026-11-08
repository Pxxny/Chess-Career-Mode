import { CharacterWizard } from '@/features/creation/CharacterWizard';

export function CharacterCreationPage({ slot }: { slot: number }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <CharacterWizard slot={slot} />
    </main>
  );
}
