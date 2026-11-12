import { SkillEffects } from "@/features/training/SkillEffects";
import { WorkPanel } from "@/features/qol/CareerPanels";
import { useSearchParams } from "react-router-dom";
import { useState } from "react";
import { Card, CardTitle, PageHeader, Tabs } from "@/components/ui";
import { getArchetype } from "@/data/archetypes";
import { ArchetypeSummary } from "@/features/creation/ArchetypeSummary";
import { GamesTab } from "@/features/training/GamesTab";
import { OpeningsTab } from "@/features/training/OpeningsTab";
import { SessionsTab } from "@/features/training/SessionsTab";
import { usePlayer } from "@/hooks/useGame";

const TABS = [
  { id: "sessions", label: "Sessions" },
  { id: "games", label: "Games" },
  { id: "openings", label: "Openings" },
  { id: "work", label: "Work" },
  { id: "effects", label: "Skill effects" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function TrainPage() {
  const player = usePlayer();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<TabId>(
    params.get("tab") === "work" ? "work" : "sessions",
  );

  return (
    <>
      <PageHeader
        title="Train"
        description="Plan your day: train, rest and recover to improve the skills that decide your games."
      />
      <Tabs
        tabs={[...TABS]}
        active={tab}
        onChange={setTab}
        label="Training sections"
      >
        {tab === "sessions" && <SessionsTab />}
        {tab === "effects" && <SkillEffects />}
        {tab === "games" && <GamesTab />}
        {tab === "work" && <WorkPanel />}
        {tab === "openings" && <OpeningsTab />}
      </Tabs>
      {tab === "sessions" && (
        <Card className="mt-4">
          <CardTitle>
            Your archetype: {getArchetype(player.archetype).label}
          </CardTitle>
          <ArchetypeSummary
            archetype={getArchetype(player.archetype)}
            tendencies={player.tendencies}
          />
          <p className="mt-4 text-xs text-ink-faint">
            Your archetype is a starting point. Every skill can be trained, and
            your tendencies change as you play.
          </p>
        </Card>
      )}
    </>
  );
}
