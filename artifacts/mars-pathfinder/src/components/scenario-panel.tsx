import type { MarsEventDetail, MarsHazardEvent, MarsRoutingStatus } from '@workspace/api-client-react';
import { Zap, RotateCcw } from 'lucide-react';
import { ErrorPanel } from '@/components/shell';
import { samePathGeometry, sharedCellCount } from '@/lib/scenario';

export type Scenario = {
  events: MarsHazardEvent[];
  oldRoute: MarsRoutingStatus; // backend: pre-event path and pre-event cost
  oldPathScenarioCost: number | null; // same old path, DF summed on the updated scenario grid
  newRoute: MarsRoutingStatus; // backend: rerouted path on scenario grid
  event: MarsEventDetail;
};

export function RouteLegend({ hasScenario }: { hasScenario: boolean }) {
  return (
    <div className="rounded bg-card/95 border px-2 py-1.5 space-y-1 font-mono text-[10px] shadow-sm" data-testid="legend-routes">
      {hasScenario ? <>
        <div className="flex items-center gap-2"><svg width="28" height="8"><line x1="0" y1="4" x2="28" y2="4" stroke="#b5651d" strokeWidth="6" strokeDasharray="6 4" /></svg>previous route (dashed, wide)</div>
        <div className="flex items-center gap-2"><svg width="28" height="8"><line x1="0" y1="4" x2="28" y2="4" stroke="#006e91" strokeWidth="3" /></svg>rerouted (solid, narrow)</div>
        <div className="flex items-center gap-2"><svg width="28" height="10"><rect x="9" y="0" width="10" height="10" fill="none" stroke="#5b2a86" strokeWidth="2.5" /></svg>event origin · <svg width="10" height="10"><rect x="0" y="0" width="10" height="10" fill="none" stroke="#5b2a86" strokeDasharray="2 2" /></svg> residual cells</div>
      </> : <div className="flex items-center gap-2"><svg width="28" height="8"><line x1="0" y1="4" x2="28" y2="4" stroke="#006e91" strokeWidth="4" /></svg>experimental route</div>}
    </div>
  );
}

type Props = {
  canSimulate: boolean; disabledReason?: string; pending: boolean; error: unknown; onSimulate: () => void; onReset: () => void;
  scenario: Scenario | null;
};

export function ScenarioPanel({ canSimulate, disabledReason, pending, error, onSimulate, onReset, scenario }: Props) {
  const s = scenario;
  const same = s ? samePathGeometry(s.oldRoute, s.newRoute) : false;
  const ev = s?.event;
  return (
    <section className="border-t pt-5" data-testid="panel-scenario">
      <h2 className="font-display text-xl">Simulated hazard event</h2>
      <p className="mt-2 text-xs">A hypothetical scenario, not an observation. The server picks one random cell on the current path (after start) and raises one terrain or structure factor; up to 8 neighboring cells get a smaller residual. The route is then recomputed with the same algorithm; the geometry may or may not change. Source data are never modified.</p>
      <div className="mt-3 flex gap-2">
        <button disabled={!canSimulate || pending} onClick={onSimulate} data-testid="button-simulate-event"
          className="flex-1 inline-flex justify-center items-center gap-2 rounded-md bg-[#5b2a86] text-[hsl(40_40%_97%)] py-2 text-sm disabled:opacity-50">
          <Zap className="h-4 w-4" />{pending ? 'Simulating and rerouting…' : s ? `Add random event (${s.events.length}/50)` : 'Random event on current path'}
        </button>
        {s && <button onClick={onReset} disabled={pending} data-testid="button-reset-scenario" className="inline-flex items-center gap-1 rounded-md border px-2 text-xs hover:bg-muted disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" />Reset</button>}
      </div>
      {pending && <div className="mt-2 h-0.5 bg-[#5b2a86]/60 animate-pulse" />}
      {!canSimulate && disabledReason && <p className="mt-2 text-xs text-muted-foreground" data-testid="text-event-disabled">{disabledReason}</p>}
      {!!error && <div className="mt-2"><ErrorPanel title="Event simulation failed" error={error} onRetry={onSimulate} /></div>}
      {s && ev && (
        <div className="rise mt-3 space-y-3 text-xs" data-testid="panel-scenario-result">
          <div className="rounded-md border-2 border-dashed border-[#5b2a86]/50 p-3 space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#5b2a86]">Scenario · {s.events.length} cumulative event{s.events.length === 1 ? '' : 's'} · seed {ev.seed}</p>
            <p>Latest: <b>{ev.spec.factor}</b> raised by {ev.spec.delta.toFixed(4)} at cell [{ev.spec.row}, {ev.spec.col}]; {ev.changes.length - 1} residual neighbor{ev.changes.length === 2 ? '' : 's'}.</p>
            <p className="font-mono text-[10px] break-words">{ev.formula}</p>
          </div>
          <div className={`rounded-md p-3 ${same ? 'bg-secondary' : 'bg-accent'}`} data-testid="text-reroute-outcome">
            {same
              ? <p><b>Identical geometry.</b> The rerouted path visits exactly the same cells as before; only its cost changed.{s.newRoute.path.length > 0 && ' BFS ignores DF, so it will usually keep its path.'}</p>
              : s.newRoute.available
                ? <p><b>Path changed.</b> {sharedCellCount(s.oldRoute, s.newRoute)} of {s.newRoute.path.length} new cells are shared with the previous path.</p>
                : <p><b>No model route</b> after the event. {s.newRoute.reason}</p>}
          </div>
          <table className="w-full text-left font-mono" data-testid="table-cost-compare">
            <thead className="text-muted-foreground"><tr><th className="font-normal">accumulated DF</th><th className="font-normal text-right">cost</th></tr></thead>
            <tbody>
              <tr className="border-t"><td className="py-1">pre-event route, pre-event grid</td><td className="text-right">{s.oldRoute.totalCost.toFixed(4)}</td></tr>
              <tr className="border-t"><td className="py-1">same pre-event path, after event</td><td className="text-right">{s.oldPathScenarioCost === null ? 'n/a' : s.oldPathScenarioCost.toFixed(4)}</td></tr>
              <tr className="border-t"><td className="py-1">rerouted, scenario grid</td><td className="text-right">{s.newRoute.available ? s.newRoute.totalCost.toFixed(4) : 'none'}</td></tr>
              <tr className="border-t"><td className="py-1">change vs pre-event</td><td className="text-right">{s.newRoute.available ? (s.newRoute.totalCost - s.oldRoute.totalCost >= 0 ? '+' : '') + (s.newRoute.totalCost - s.oldRoute.totalCost).toFixed(4) : 'n/a'}</td></tr>
            </tbody>
          </table>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-[10px]" data-testid="table-event-changes">
              <thead className="text-muted-foreground"><tr><th className="font-normal">cell</th><th className="font-normal">area km²</th><th className="font-normal">{ev.spec.factor}</th><th className="font-normal">DF</th><th className="font-normal">ΔDF</th></tr></thead>
              <tbody>{ev.changes.map((c) => (
                <tr key={`${c.row}:${c.col}`} className={`border-t ${c.origin ? 'font-semibold text-[#5b2a86]' : ''}`} data-testid={`row-change-${c.row}-${c.col}`}>
                  <td className="py-1">{c.origin ? 'origin ' : ''}[{c.row},{c.col}]</td>
                  <td>{c.areaKm2.toFixed(0)}</td>
                  <td>{c.factorBefore.toFixed(3)}→{c.factorAfter.toFixed(3)}</td>
                  <td>{c.dfBefore.toFixed(4)}→{c.dfAfter.toFixed(4)}</td>
                  <td>+{c.deltaDf.toFixed(4)}</td>
                </tr>))}</tbody>
            </table>
          </div>
          <p className="text-muted-foreground">{ev.warning}</p>
          <p className="text-muted-foreground">In-memory only. Reset, a new grid, new endpoints, a new algorithm, or a reload discards the scenario.</p>
        </div>)}
    </section>
  );
}
