import { useSearchParams } from "react-router-dom";
import { Avatar, Card, PageHeader, Tabs } from "@/components/ui";
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
  const country = getCountry(player.country);
  const [params, setParams] = useSearchParams();
  const tab: TabId = TABS.find((t) => t.id === params.get("tab"))?.id ?? "profile";
  const setTab = (next: TabId) => setParams(next === "profile" ? {} : { tab: next });

  return (
    <>
      <PageHeader title="Profile" />
      <Card className="mb-4">
        <div className="flex items-center gap-4">
          <Avatar
            name={player.name}
            seed={player.avatarSeed}
            appearance={player.appearance}
            size="lg"
          />
          <div>
            <p className="font-display text-2xl font-bold text-ink">
              <span translate="no">{player.name}</span>
            </p>
            <p className="text-sm text-ink-muted">
              <span translate="no">{player.city.name}</span>,{" "}
              {country?.name ?? player.country}
            </p>
          </div>
        </div>
      </Card>
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
