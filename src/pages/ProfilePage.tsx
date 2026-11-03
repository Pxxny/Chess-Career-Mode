import { Avatar, Card, CardTitle, PageHeader } from '@/components/ui';
import { getArchetype } from '@/data/archetypes';
import { getEra } from '@/data/eras';
import { getCountry } from '@/data/world/countries';
import { AlternateHistoryToggle } from '@/features/profile/AlternateHistoryToggle';
import { ProfileForm } from '@/features/profile/ProfileForm';
import { ResetSaveButton } from '@/features/profile/ResetSaveButton';
import { usePlayer, useWorld } from '@/hooks/useGame';
import { formatMoney } from '@/utils/format';

export function ProfilePage() {
  const player = usePlayer();
  const world = useWorld();
  const country = getCountry(player.country);
  const details = [
    ['Age', String(player.age)],
    ['Archetype', getArchetype(player.archetype).label],
    ['Career started', `${player.careerStartYear} (${getEra(player.careerStartYear).name})`],
    ['Rated games', String(player.ratedGames)],
    ['Morale', String(player.morale)],
    ['Nationality', `${country?.flag ?? ''} ${country?.nationality ?? player.country}`],
    ['City', player.city.name],
    ['Federation', country ? `${country.federation.name} (${country.federation.code})` : '–'],
    ['Continent', country?.continent ?? '–'],
    ['Rating', String(player.rating)],
    ['Money', formatMoney(player.money)],
  ];

  return (
    <>
      <PageHeader title="Profile" />
      <Card className="mb-4">
        <div className="flex items-center gap-4">
          <Avatar name={player.name} seed={player.avatarSeed} appearance={player.appearance} size="lg" />
          <div>
            <p className="font-display text-2xl font-bold text-ink">{player.name}</p>
            <p className="text-sm text-ink-muted">
              {player.city.name}, {country?.name ?? player.country}
            </p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {details.map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-ink-muted">{label}</dt>
              <dd className="font-semibold text-ink">{value}</dd>
            </div>
          ))}
        </dl>
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
