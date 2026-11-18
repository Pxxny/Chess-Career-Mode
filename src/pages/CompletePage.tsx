import { CareerHealthCard } from "@/features/career/CareerHealthCard";
import { competitionHealthIssue } from "@/game/career/health";
import { useGameStore } from "@/store/gameStore";
import { useNpcStore } from "@/store/npcStore";
import { buildMatchSetup } from "@/game/match/setup";
import { useOpeningDb } from "@/store/openingStore";
import { TaleOfTape } from "@/features/prediction/TaleOfTape";
import { RankingsHub } from "@/features/world/RankingsHub";
import { AnnualTournaments } from "@/features/tournaments/AnnualTournaments";
import { EsportsPanel } from "@/features/esports/EsportsPanel";
import { SectionMenu } from "@/components/ui/SectionMenu";
import { useLocation, useSearchParams } from "react-router-dom";
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
  | "history"
  | "world"
  | "players"
  | "calendar"
  | "event-history";

function landingTab(value: string | null): Tab | undefined {
  return value === "calendar" || value === "world" || value === "players" || value === "rankings" ? value : undefined;
}

export function CompletePage() {
  const save = useSave();
  const db=useOpeningDb();
  const [params] = useSearchParams();
  const route = useLocation();
  const [circuit, setCircuit] = useState<"traditional" | "esports">(
    params.get("circuit") === "esports" ? "esports" : "traditional",
  );
  const player = usePlayer();
  const ranked = useRankedNpcs();
  const [selected, setSelected] = useState<Npc | null>(null);
  const [tab, setTab] = useState<Tab>(() => landingTab(params.get("tab")) ?? "tournament");
  const [federationView,setFederationView]=useState<"federation"|"teams">("teams");
  const [active, setActive] = useState<MatchSetup | null>(() => save.pendingMatch?.resume?.setup ?? null);
  const [queued, setQueued] = useState<MatchSetup|null>(null);
  const previewStart = (setup: MatchSetup) => {
    if ((setup.rated || setup.tournament || setup.esports) && competitionHealthIssue(save)) return;
    if (setup.prediction) setQueued(setup);
    else setActive(setup);
  };
  useEffect(() => {
    const linkedTab = landingTab(params.get("tab"));
    if (params.get("section") === "match") {
      setTab("tournament");
      setCircuit("traditional");
    }
    setTab(linkedTab ?? "tournament");
    if (params.get("section") === "teams") {setCircuit("traditional");setTab("tournament");setFederationView("teams");setTimeout(()=>document.getElementById("federation-teams")?.scrollIntoView({block:"start"}),100);return;}
    if (params.get("section") === "registrations") {
      setCircuit("traditional");
      setTab("tournament");
      return;
    }
    if (params.get("circuit") === "esports") {
      setCircuit("esports");
      setTab("tournament");
    }
  }, [params, route.key]);

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
      {queued?.prediction && <TaleOfTape setup={queued} prediction={queued.prediction} onClose={()=>setQueued(null)} onStart={()=>{const current=useGameStore.getState().save!,id=queued.playerColor==="white"?queued.black.id:queued.white.id,npc=useNpcStore.getState().npcs.find(n=>n.id===id);setActive(npc?{...queued,...buildMatchSetup({save:current,npc,playerColor:queued.playerColor,timeControl:queued.timeControl,rated:queued.rated,mode:queued.mode,speed:queued.speed,tournament:queued.tournament,seed:queued.seed,db}),social:queued.social,esports:queued.esports}:queued);setQueued(null);}}/>}
      <CareerHealthCard />
      <PageHeader
        title="Tournament"

      />
      <Tabs
        label="Tournament sections"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "tournament", label: "Tournament" },
          { id: "calendar", label: "Annual calendar" },
          { id: "world", label: "World Hub" },
          { id: "players", label: "Player directory" },
          { id: "event-history", label: "Tournament history" },
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
              <EsportsPanel onStart={previewStart} />
            ) : (
              <>
                <TournamentPanel onStart={previewStart} />
                <details open={params.get("section") === "match" ? true : undefined}>
                  <summary className="cursor-pointer rounded-lg bg-navy-800 p-3 text-gold-400">
                    Individual match / free play
                  </summary>
                  <div className="mt-3">
                    <MatchSetupPanel onStart={previewStart} />
                  </div>
                </details>
                <details id="federation-teams" open={params.get("section")==="teams"?true:undefined}>
                  <summary className="cursor-pointer rounded-lg bg-navy-800 p-3 text-gold-400">
                    Federation & national teams
                  </summary>
                  <div className="mt-3 space-y-4">
                    <div className="flex flex-wrap gap-2"><button className="rounded-xl bg-navy-800 p-3 text-sm" aria-pressed={federationView==="teams"} onClick={()=>setFederationView("teams")}>Team selection & boards</button><button className="rounded-xl bg-navy-800 p-3 text-sm" aria-pressed={federationView==="federation"} onClick={()=>setFederationView("federation")}>Membership & federations</button></div><WorldHub view={federationView} />
                  </div>
                </details>
              </>
            )}
          </div>
        )}
        {tab === "world" && <WorldHub view="overview" />}
        {tab === "players" && <NpcDirectory />}
        {tab === "calendar" && <AnnualTournaments />}
        {tab === "event-history" && <AnnualTournaments history />}
        {tab === "swiss" && <TournamentPanel onStart={previewStart} swissOnly />}
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
          <RankingsHub onSelect={setSelected}>
            <Card className="mb-4">
              <CardTitle>Players near your rating</CardTitle>
              <NpcTable npcs={nearby} onSelect={setSelected} />
            </Card>
            <Card className="mb-4">
              <CardTitle>Player directory</CardTitle>
              <NpcDirectory />
            </Card>
          </RankingsHub>
        )}
      </Tabs>
      <NpcProfileModal npc={selected} onClose={() => setSelected(null)} />
    </>
  );
}
