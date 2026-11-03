import { Card, CardTitle } from '@/components/ui';
import { getArchetype } from '@/data/archetypes';
import { describeAppearance } from '@/data/appearance';
import { getEra } from '@/data/eras';
import { getCountry } from '@/data/world/countries';
import { getTitleStatus } from '@/game/career/titles';
import { AlternateHistoryToggle } from '@/features/profile/AlternateHistoryToggle';
import { ProfileForm } from '@/features/profile/ProfileForm';
import { ResetSaveButton } from '@/features/profile/ResetSaveButton';
import { useSave } from '@/hooks/useGame';
import type { PlayerGender } from '@/types';

const GENDER: Record<PlayerGender, string> = { male: 'Male', female: 'Female', nonbinary: 'Non-binary', undisclosed: 'Not specified' };

export function ProfileTab() {
  const { player, world, history } = useSave();
  const country = getCountry(player.country);
  const title = getTitleStatus(player, history);
  const details: Array<[string, string]> = [
    ['Full name', player.name],
    ['Nationality', country ? `${country.flag} ${country.nationality}` : player.country],
    ['City', player.city.name],
    ['Gender', GENDER[player.gender] ?? player.gender],
    ['Age', String(player.age)],
    ['Chess archetype', getArchetype(player.archetype).label],
    ['Current Elo', String(player.rating)],
    ['Current title', title.currentLabel],
    ['Career start year', `${player.careerStartYear} (${getEra(player.careerStartYear).name})`],
    ['Federation', country ? `${country.federation.name} (${country.federation.code})` : '–'],
  ];
  return (
    <>
      <Card className="mb-4">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {details.map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-ink-muted">{label}</dt>
              <dd className="font-semibold text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 border-t border-white/5 pt-4">
          <p className="text-sm text-ink-muted">Appearance</p>
          <p className="text-sm text-ink">{describeAppearance(player.appearance)}</p>
        </div>
      </Card>
      <Card className="mb-4">
        <CardTitle>Edit profile</CardTitle>
        <ProfileForm key={player.name} currentName={player.name} />
      </Card>
      <Card className="mb-4">
        <CardTitle>World settings</CardTitle>
        <AlternateHistoryToggle enabled={world.alternateHistory} />
      </Card>
      <Card>
        <CardTitle>Save data</CardTitle>
        <p className="mb-4 text-sm text-ink-muted">Your career and the NPC world are saved automatically in this browser.</p>
        <ResetSaveButton />
      </Card>
    </>
  );
}
