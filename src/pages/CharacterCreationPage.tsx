import { CharacterWizard } from "@/features/creation/CharacterWizard";
import { LanguageSelector } from "@/i18n/LanguageSelector";

export function CharacterCreationPage({ slot }: { slot: number }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-4 flex justify-end">
        <LanguageSelector />
      </div>
      <CharacterWizard slot={slot} />
    </main>
  );
}
