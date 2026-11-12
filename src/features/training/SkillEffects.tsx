import { useState } from "react";
import { Card, CardTitle } from "@/components/ui";
import { useSave } from "@/hooks/useGame";
import { STAT_LABELS } from "@/data/stats";
import { TRAINING_SESSIONS } from "@/data/trainingSessions";
import { STAT_EFFECTS, trainingImpact } from "@/game/training/impact";
import type { StatKey } from "@/types";
export function SkillEffects() {
  const save = useSave(),
    p = save.player,
    impact = trainingImpact(p);
  const [selected, setSelected] = useState<StatKey>("tactics");
  const last = save.history.sessions.at(-1);
  return (
    <div className="space-y-4" data-testid="skill-effects">
      <Card>
        <CardTitle>How training affects play</CardTitle>
        <p className="text-sm text-ink-muted">
          Skills change simulated decisions, clock use and forecasts. When you
          play yourself, your moves remain under your control. Training does not
          directly add rated Elo.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt>Training strength bonus</dt>
            <dd className="font-bold text-gold-300">
              {impact.skillBonus >= 0 ? "+" : ""}
              {impact.skillBonus}
            </dd>
          </div>
          <div>
            <dt>Simulator clock skill</dt>
            <dd>{Math.round(impact.clockSkill * 100)}%</dd>
          </div>
          <div>
            <dt>Extra prepared half-moves</dt>
            <dd>{impact.extraBookPlies}</dd>
          </div>
          <div>
            <dt>Fatigue penalty per point</dt>
            <dd>{impact.fatigueFactor.toFixed(2)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-ink-muted">
          These are simulator modifiers, not guaranteed wins or official rating
          gains.
        </p>
      </Card>
      <Card>
        <CardTitle>Choose a skill to understand</CardTitle>
        <select
          aria-label="Skill effect"
          className="w-full rounded-lg bg-navy-900 p-3"
          value={selected}
          onChange={(e) => setSelected(e.target.value as StatKey)}
        >
          {Object.entries(STAT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <p className="mt-3">{STAT_EFFECTS[selected]}</p>
        <h3 className="mt-4 font-semibold">Sessions that train this skill</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {TRAINING_SESSIONS.filter((s) =>
            s.effects.some((e) => e.stat === selected),
          ).map((s) => (
            <li key={s.id}>
              {s.name} · {s.hours} h · {s.ap} AP
            </li>
          ))}
        </ul>
      </Card>
      {last && (
        <Card data-testid="training-changes">
          <CardTitle>Last session improvements</CardTitle>
          <p>{last.name}</p>
          <ul className="mt-2 text-sm">
            {last.gains.map((g) => (
              <li key={g.stat}>
                {STAT_LABELS[g.stat]}: {g.value - g.levels} → {g.value} · +
                {g.xp} XP
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
