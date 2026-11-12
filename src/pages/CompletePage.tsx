import { EsportsPanel } from "@/features/esports/EsportsPanel";
import { SectionMenu } from "@/components/ui/SectionMenu";
import { useSearchParams } from "react-router-dom";
import { PreparePanel } from "@/features/competition/PreparePanel";
import { competitionOf } from "@/game/competition/preparation";
import {
  TournamentStandings,
  PairingHistory,
} from "@/features/match/TournamentPanel";
import { useSave } from "@/hooks/useGame";
import { WorldHub } from "@/features/expansion/WorldHub";
import { useMemo, useState, useEffect } from "react";
import { Card, CardTitle, PageHeader, Tabs } from "@/components/ui";
import { MatchHistory } from "@/features/match/MatchHistory";
import { MatchSetupPanel } from "@/features/match/MatchSetupPanel";
import { MatchViewer } from "@/features/match/MatchViewer";
import { TournamentPanel } from "@/features/match/TournamentPanel";
import { NpcDirectory } from "@/features/world/NpcDirectory";
import { NpcProfileModal } from "@/features/world/NpcProfileModal";
import { NpcTable } from "@/features/world/NpcTable";
import { usePlayer } from "@/hooks/useGame";
import { useRankedNpcs } from "@/hooks/useNpcs";
import type { MatchSetup } from "@/game/match/session";
import type { Npc } from "@/types";

const NEARBY_COUNT = 8;
type Tab =
  | "tournament"
  | "swiss"
  | "prepare"
  | "rankings"
  | "league"
  | "history";

export function CompletePage() {
  const save = useSave();
  const [params] = useSearchParams();
  const [circuit, setCircuit] = useState<"traditional" | "esports">(
    params.get("circuit") === "esports" ? "esports" : "traditional",
  );
  const player = usePlayer();
  const ranked = useRankedNpcs();
  const [selected, setSelected] = useState<Npc | null>(null);
  const [tab, setTab] = useState<Tab>("tournament");
  const [active, setActive] = useState<MatchSetup | null>(null);
  useEffect(() => {
    if (params.get("circuit") === "esports") {
      setCircuit("esports");
      setTab("tournament");
    }
  }, [params]);

  const nearby = useMemo(
    () =>
      [...ranked]
        .sort(
          (a, b) =>
            Math.abs(a.currentElo - player.rating) -
            Math.abs(b.currentElo - player.rating),
        )
        .slice(0, NEARBY_COUNT)
        .sort((a, b) => b.currentElo - a.currentElo),
    [ranked, player.rating],
  );

  if (active) {
    return (
      <>
        <PageHeader
          title="Match"
          description="Play it yourself, or let the simulator play and take control whenever you like."
        />
        <MatchViewer
          key={active.seed}
          setup={active}
          onExit={() => setActive(null)}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Tournament"
        description="Rated games, tournaments and matches against the players of your world."
      />
      <Tabs
        label="Tournament sections"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "tournament", label: "Tournament" },
          { id: "swiss", label: "Swiss" },
          { id: "prepare", label: "Prepare" },
          { id: "rankings", label: "Rankings" },
          { id: "league", label: "League" },
          { id: "history", label: "History" },
        ]}
      >
        {tab === "tournament" && (
          <div className="space-y-4">
            <SectionMenu
              label="Competition circuits"
              active={circuit}
              onChange={setCircuit}
              items={[
                { id: "traditional", label: "Chess tournaments" },
                { id: "esports", label: "Esports" },
              ]}
            />
            {circuit === "esports" ? (
              <EsportsPanel onStart={setActive} />
            ) : (
              <>
                <TournamentPanel onStart={setActive} />
                <details>
                  <summary className="cursor-pointer rounded-lg bg-navy-800 p-3 text-gold-400">
                    Individual match / free play
                  </summary>
                  <div className="mt-3">
                    <MatchSetupPanel onStart={setActive} />
                  </div>
                </details>
                <details>
                  <summary className="cursor-pointer rounded-lg bg-navy-800 p-3 text-gold-400">
                    Federation & national teams
                  </summary>
                  <div className="mt-3 space-y-4">
                    <WorldHub view="federation" />
                    <WorldHub view="teams" />
                  </div>
                </details>
              </>
            )}
          </div>
        )}
        {tab === "swiss" && <TournamentPanel onStart={setActive} swissOnly />}
        {tab === "prepare" && <PreparePanel />}
        {tab === "league" && (
          <Card>
            <CardTitle>Your league</CardTitle>
            <p className="text-sm text-ink">
              {player.league} · Elo {player.rating}
            </p>
            <p className="mt-3 text-sm text-ink-muted">
              League follows your career rating tier. Some invitations require
              an elite league, a chess title and previous qualification.
              Tournament and Swiss results contribute to your career through
              rated games.
            </p>
          </Card>
        )}
        {tab === "history" && (
          <div className="space-y-4">
            <MatchHistory />
            {[...competitionOf(save).archive].reverse().map((t) => (
              <details key={t.eventId} className="rounded-lg bg-navy-800 p-4">
                <summary className="cursor-pointer text-gold-400">
                  {t.name} · final rank {t.finalRank}
                </summary>
                <div className="mt-3">
                  <TournamentStandings t={t} />
                  <PairingHistory t={t} />
                </div>
              </details>
            ))}
            <WorldHub view="news" />
          </div>
        )}
        {tab === "rankings" && (
          <>
            <Card className="mb-4">
              <CardTitle>Players near your rating</CardTitle>
              <NpcTable npcs={nearby} onSelect={setSelected} />
            </Card>
            <Card className="mb-4">
              <CardTitle>Player directory</CardTitle>
              <NpcDirectory />
            </Card>
          </>
        )}
      </Tabs>
      <NpcProfileModal npc={selected} onClose={() => setSelected(null)} />
    </>
  );
}
