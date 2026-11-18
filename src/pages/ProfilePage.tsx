import { EliteHero, EliteStats, eliteLink } from "@/features/elite/ElitePresentation";
import { Link } from "react-router-dom";
import { useSave } from "@/hooks/useGame";
import { useRankedNpcs } from "@/hooks/useNpcs";
import { computeRankings } from "@/game/world/standings";
import { getTitleStatus } from "@/game/career/titles";
import { useSearchParams } from "react-router-dom";
import { Avatar, PageHeader, Tabs } from "@/components/ui";
import { getCountry } from "@/data/world/countries";
import { ProfileTab } from "@/features/profile/tabs/ProfileTab";
import { SkillsTab } from "@/features/profile/tabs/SkillsTab";
import { StatsTab } from "@/features/profile/tabs/StatsTab";
import { TrophiesTab } from "@/features/profile/tabs/TrophiesTab";
import { usePlayer } from "@/hooks/useGame";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "skills", label: "Skills" },
  { id: "stats", label: "Stats" },
  { id: "trophies", label: "Trophies" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ProfilePage() {
  const player = usePlayer();
  const save = useSave();
  const ranked = useRankedNpcs();
  const rank = computeRankings(player, ranked).world.rank;
  const title = getTitleStatus(player, save.history).currentLabel;
  const country = getCountry(player.country);
  const [params, setParams] = useSearchParams();
  const tab: TabId = TABS.find((t) => t.id === params.get("tab"))?.id ?? "profile";
  const setTab = (next: TabId) => setParams(next === "profile" ? {} : { tab: next });

  return (
    <>
      <PageHeader title="Career Profile" eyebrow="Player identity" />
      <div className="mb-5 space-y-4">
        <EliteHero title={player.name} label={title} artwork={<Avatar name={player.name} appearance={player.appearance} seed={player.avatarSeed} size="lg" />}>
          <p className="text-sm text-ink-muted">{player.age} · {country?.name ?? player.country} · World #{rank}</p>
        </EliteHero>
        <EliteStats items={[["Classical Elo", player.rating], ["Rapid Elo · shared", player.rating], ["Online Blitz", save.practice.blitzRating], ["Career titles", save.history.titles.length]]} />
        <p className="text-xs text-ink-muted">Classical and Rapid career games share one Elo. Online Blitz has its own rating.</p>
        <div className="flex flex-wrap gap-2">
          <Link className={eliteLink} to="/profile?tab=stats">Rating history</Link>
          <Link className={eliteLink} to="/profile?tab=trophies">Achievements</Link>
          <Link className={eliteLink} to="/career?view=championship">Championship progress</Link>
        </div>
      </div>
      <Tabs
        tabs={[...TABS]}
        active={tab}
        onChange={setTab}
        label="Profile sections"
      >
        {tab === "profile" && <ProfileTab />}
        {tab === "skills" && <SkillsTab />}
        {tab === "stats" && <StatsTab />}
        {tab === "trophies" && <TrophiesTab />}
      </Tabs>
    </>
  );
}
