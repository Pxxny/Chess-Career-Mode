import { useMemo, useState } from "react";
import { Card, CardTitle } from "@/components/ui";
import { EliteStats } from "@/features/elite/ElitePresentation";
import { useSave } from "@/hooks/useGame";
import { buildFinance } from "@/game/career/overview";
import { sponsorsOf, sponsorProgress } from "@/game/career/business";
import { annualEvents } from "@/game/competition/worldCalendar";
import { travelQuote } from "@/game/competition/travel";
import { dateLabel, stampFromIndex, stampIndex } from "@/game/competition/catalog";
import { dayStamp, gameDay } from "@/game/competition/agenda";
import { formatMoney } from "@/utils/format";

export function FinancePanel() {
  const save = useSave();
  const finance = buildFinance(save);
  const [period, setPeriod] = useState<"week" | "month">("week");
  const cashflow = useMemo(() => {
    const buckets = new Map<string, { income: number; expenses: number }>();
    for (const entry of save.history.ledger) {
      const month = new Date(Date.UTC(entry.year, 0, (entry.week - 1) * 7 + (entry.day ?? 1))).getUTCMonth() + 1;
      const key = `${entry.year}-${String(period === "week" ? entry.week : month).padStart(2, "0")}`;
      const total = buckets.get(key) ?? { income: 0, expenses: 0 };
      total.income += Math.max(0, entry.amount);
      total.expenses += Math.max(0, -entry.amount);
      buckets.set(key, total);
    }
    return [...buckets].sort(([a], [b]) => b.localeCompare(a)).slice(0, 12);
  }, [save.history.ledger, period]);
  const planned = useMemo(() => {
    const queue = save.careerSystems?.queue.filter(entry => entry.status === "waiting") ?? [];
    const wages = (save.careerSystems?.contracts ?? []).flatMap(contract => {
      const dueDay = (contract.paidWeek + 1) * 7;
      return dueDay > gameDay(save) && dueDay <= contract.end ? [{
        id: `wage:${contract.npcId}`, name: "Esports contract wages", cost: contract.salary, date: dayStamp(dueDay),
      }] : [];
    });
    if (!queue.length) return wages;
    const year = save.world.date.year;
    const events = [...annualEvents(save, year), ...annualEvents(save, year + 1)];
    const bookings = queue.flatMap(entry => {
      const event = events.find(candidate => candidate.id === entry.eventId);
      return event ? [{ id: entry.eventId, name: event.name, cost: event.entryFee + travelQuote(save, event).cost, date: event }] : [];
    });
    return [...bookings, ...wages].sort((a, b) => stampIndex(a.date) - stampIndex(b.date));
  }, [save]);
  const contract = sponsorsOf(save).active;
  const progress = sponsorProgress(save);
  const games = progress ? Math.max(0, progress.needGames - progress.games) : 0;
  const sessions = progress ? Math.max(0, 8 - progress.sessions) : 0;
  const reviewIn = contract ? Math.max(0, contract.nextPayment - stampIndex(save.world.date)) : 0;
  return <section data-testid="career-finance" className="space-y-4">
    <EliteStats items={[["Balance", formatMoney(finance.balance)], ["Recorded income", formatMoney(finance.income)], ["Recorded expenses", formatMoney(finance.expenses)], ["Upcoming costs", formatMoney(planned.reduce((sum, entry) => sum + entry.cost, 0))]]} />
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <Card>
        <CardTitle>Cash flow</CardTitle>
        <div className="mb-3 flex flex-wrap gap-2">
          <button className="section-tab" aria-pressed={period === "week"} onClick={() => setPeriod("week")}>Weekly</button>
          <button className="section-tab" aria-pressed={period === "month"} onClick={() => setPeriod("month")}>Monthly</button>
        </div>
        {cashflow.length ? <table className="w-full break-words text-right text-xs sm:text-sm">
          <thead><tr><th className="text-left">Period</th><th>Income</th><th>Expenses</th><th>Net</th></tr></thead>
          <tbody>{cashflow.map(([key, total]) => <tr key={key} className="border-t border-navy-600">
            <th scope="row" className="py-2 text-left font-normal">{period === "week" ? key.replace("-", " / W") : key}</th>
            <td>{formatMoney(total.income)}</td><td>{formatMoney(total.expenses)}</td>
            <td className={total.income < total.expenses ? "text-rose-300" : "text-emerald-300"}>{formatMoney(total.income - total.expenses)}</td>
          </tr>)}</tbody>
        </table> : <p className="text-sm text-ink-muted">No cash flow recorded yet.</p>}
      </Card>
      <div className="space-y-4">
        <Card>
          <CardTitle>Upcoming expenses</CardTitle>
          {planned.length ? <ul className="divide-y divide-navy-600">{planned.map(entry => <li key={entry.id} className="flex justify-between gap-3 py-2 text-sm"><span>{entry.name} · {dateLabel(entry.date)}</span><strong className="shrink-0">{formatMoney(entry.cost)}</strong></li>)}</ul>
            : <p className="text-sm text-ink-muted">No unpaid tournament bookings or contract wages.</p>}
          <p className="mt-3 text-xs text-ink-muted">Queued entry and travel costs are estimates. Confirmed tournament entries are paid when booked.</p>
        </Card>
        <Card>
          <CardTitle>Sponsor risk</CardTitle>
          {contract ? <>
            <p className={games || sessions ? "font-semibold text-rose-300" : "font-semibold text-emerald-300"}>{games || sessions ? reviewIn <= 1 ? "At risk · review within one week" : "Targets still due" : "Targets met"}</p>
            <p className="text-sm text-ink-muted">{games} rated games · {sessions} training sessions remaining</p>
            <p className="mt-2 text-sm">Next review {dateLabel(stampFromIndex(contract.nextPayment))}</p>
          </> : <p className="text-sm text-ink-muted">No active sponsorship.</p>}
        </Card>
      </div>
    </div>
  </section>;
}
