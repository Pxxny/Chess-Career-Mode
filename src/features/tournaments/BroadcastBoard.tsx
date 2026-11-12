import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import "@/game/match/chessjs";
import { Button } from "@/components/ui";
import { engineManager } from "@/game/engine/manager";
import {
  MatchSession,
  type MatchSetup,
  type Speed,
} from "@/game/match/session";
import { buildNpcProfile } from "@/game/match/npcProfile";
import { opponentFromNpc } from "@/game/play/opponent";
import { createRng, mixSeed } from "@/game/rng";
import { hashString } from "@/utils/format";
import { useOpeningDb } from "@/store/openingStore";
import { useGameStore } from "@/store/gameStore";
import { useNpcs } from "@/hooks/useNpcs";
import { getCountry } from "@/data/world/countries";
import { MatchBoard } from "@/features/match/MatchBoard";
import { MoveList } from "@/features/match/MoveList";
import { PlayerPanel } from "@/features/match/PlayerPanel";
import {
  createGame,
  currentPosition,
  parseUci,
  makeMove,
} from "@/game/chess/rules";
import type {
  ActiveTournament,
  BroadcastGame,
  MatchSide,
  TournamentPlayer,
} from "@/types";
import type { BroadcastContext } from "@/game/competition/broadcast";
const noTargets = () => [];
const side = (p: TournamentPlayer): MatchSide => ({
  id: p.id,
  name: p.name,
  elo: p.elo,
  title: p.title,
  countryCode: p.countryCode,
  nationality: getCountry(p.countryCode)?.name ?? p.countryCode,
  flag: getCountry(p.countryCode)?.flag ?? "",
  isPlayer: false,
});
export function BroadcastBoard({
  t,
  context,
  onBack,
}: {
  t: ActiveTournament;
  context: BroadcastContext;
  onBack: () => void;
}) {
  const npcs = useNpcs(),
    db = useOpeningDb();
  const pair = t.pairings[context.round - 1][context.board];
  const white = t.players.find((p) => p.id === pair.white)!,
    black = t.players.find((p) => p.id === pair.black)!;
  const setup = useMemo(() => {
    const w = npcs.find((n) => n.id === white.id),
      b = npcs.find((n) => n.id === black.id);
    if (!w || !b) return null;
    const seed = mixSeed(
      t.seed,
      hashString(`${context.round}:${pair.white}:${pair.black}`),
    );
    return {
      white: side(white),
      black: side(black),
      playerColor: "white",
      timeControl: t.timeControl,
      rated: false,
      tournament: null,
      accuracyBonus: 0,
      mode: "simulate",
      speed: "fast",
      seed,
      profiles: {
        white: buildNpcProfile(w, opponentFromNpc(w).lines, {
          rng: createRng(seed),
          round: context.round,
          baseEloOverride: white.elo,
        }),
        black: buildNpcProfile(b, opponentFromNpc(b).lines, {
          rng: createRng(seed + 1),
          round: context.round,
          baseEloOverride: black.elo,
        }),
      },
    } as MatchSetup;
  }, [npcs, white.id, black.id, t.seed, context.round]);
  if (!setup)
    return <p>These NPCs are no longer available for a live board.</p>;
  return (
    <LiveBoard
      setup={setup}
      context={context}
      initial={pair.broadcast}
      onBack={onBack}
    />
  );
}
function ClockPanel({
  session,
  color,
}: {
  session: MatchSession;
  color: "white" | "black";
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 200);
    return () => clearInterval(id);
  }, []);
  const snap = session.getSnapshot();
  return (
    <PlayerPanel
      side={session.matchSetup[color]}
      color={color}
      remaining={session.clocks()[color]}
      active={snap.status === "running" && snap.turn === color}
      controller="auto"
      thinking={snap.thinking === color}
    />
  );
}
function LiveBoard({
  setup,
  context,
  initial,
  onBack,
}: {
  setup: MatchSetup;
  context: BroadcastContext;
  initial?: BroadcastGame;
  onBack: () => void;
}) {
  const db = useOpeningDb(),
    active = useRef<MatchSession | null>(null),
    last = useRef("");
  const session = useMemo(
    () =>
      new MatchSession({
        setup,
        db,
        engine: engineManager,
        autoAnalyze: false,
        liveEval: false,
        initialState: initial,
      }),
    [],
  );
  const snap = useSyncExternalStore(session.subscribe, session.getSnapshot);
  useEffect(() => {
    active.current = session;
    const persist = () => {
      const snapshot = session.getSnapshot();
      if (`${snapshot.game.ucis.length}:${snapshot.status}` === last.current && !snapshot.finish)
        return;
      last.current = `${snapshot.game.ucis.length}:${snapshot.status}`;
      useGameStore
        .getState()
        .broadcastCheckpoint(context, session.broadcastState());
    };
    const unsub = session.subscribe(persist);
    session.start();
    return () => {
      unsub();
      active.current = null;
      queueMicrotask(() => {
        if (active.current === session) return;
        session.pause();
        useGameStore
          .getState()
          .broadcastCheckpoint(context, session.broadcastState());
        session.dispose();
      });
    };
  }, [session]);
  const ply = snap.viewPly ?? snap.game.ucis.length,
    position = snap.game.positions[ply],
    move = snap.game.moves[ply - 1];
  return (
    <div
      className="space-y-3"
      data-testid="live-broadcast"
      data-broadcast-ply={snap.game.ucis.length}
    >
      <Button variant="secondary" onClick={onBack}>
        Back to pairings
      </Button>
      <p className="text-sm text-gold-300">
        {snap.status === "over"
          ? "Game finished"
          : snap.status === "paused"
            ? "Broadcast paused"
            : "Live simulated board"}
      </p>
      <p className="text-xs text-ink-muted">
        Both NPCs use the chess engine. Closing pauses this board; reopening
        resumes its saved moves and clocks. Your AP, Elo and calendar do not
        change.
      </p>
      <ClockPanel session={session} color="black" />
      <MatchBoard
        position={position}
        perspective="white"
        movable={null}
        checkSquare={-1}
        legalTargets={noTargets}
        onMove={() => undefined}
        lastMove={move ? { from: move.from, to: move.to } : null}
      />
      <ClockPanel session={session} color="white" />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() =>
            snap.status === "paused" ? session.resume() : session.pause()
          }
        >
          {snap.status === "paused" ? "Resume broadcast" : "Pause broadcast"}
        </Button>
        <select
          aria-label="Broadcast speed"
          className="rounded-lg bg-navy-900 p-3"
          value={snap.speed}
          onChange={(e) => session.setSpeed(e.target.value as Speed)}
        >
          <option value="brisk">Brisk</option>
          <option value="fast">Fast-forward</option>
          <option value="max">Instant</option>
        </select>
      </div>
      <MoveList
        sans={snap.game.sans}
        viewPly={snap.viewPly}
        onView={(p) => session.view(p)}
      />
    </div>
  );
}
export function RecordedBoard({
  broadcast,
  onBack,
}: {
  broadcast: BroadcastGame;
  onBack: () => void;
}) {
  const [ply, setPly] = useState<number | null>(null);
  const game = useMemo(() => {
    let game = createGame();
    for (const uci of broadcast.ucis) {
      const move = parseUci(currentPosition(game), uci);
      if (!move) break;
      game = makeMove(game, move);
    }
    return game;
  }, [broadcast]);
  const at = ply ?? game.ucis.length,
    move = game.moves[at - 1];
  return (
    <div className="space-y-3" data-testid="recorded-broadcast">
      <Button variant="secondary" onClick={onBack}>
        Back to pairings
      </Button>
      <p>
        {broadcast.result ? "Recorded board replay" : "Partial board recording"}
      </p>
      <MatchBoard
        position={game.positions[at]}
        perspective="white"
        movable={null}
        checkSquare={-1}
        legalTargets={noTargets}
        onMove={() => undefined}
        lastMove={move ? { from: move.from, to: move.to } : null}
      />
      <MoveList sans={game.sans} viewPly={ply} onView={setPly} />
    </div>
  );
}
