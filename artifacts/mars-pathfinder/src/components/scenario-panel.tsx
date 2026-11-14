import type { MarsEventDetail, MarsHazardEvent, MarsRoutingStatus } from '@workspace/api-client-react';
import { Zap, RotateCcw, Footprints } from 'lucide-react';
import { ErrorPanel } from '@/components/shell';
import { samePathGeometry, sharedCellCount } from '@/lib/scenario';

export type Scenario = {
  events: MarsHazardEvent[];
  oldRoute: MarsRoutingStatus; // backend: pre-event path and pre-event cost
  oldPathScenarioCost: number | null; // same old path, DF summed on the updated scenario grid
  newRoute: MarsRoutingStatus; // backend: rerouted path on scenario grid
  event: MarsEventDetail;
  /** Effective route origin for later requests: exact A until a traveler-positioned event, then that cell center. */
  origin: { lat: number; lng: number };
  /** True once any event rerouted from a traveler position; A is then no longer the reroute start. */
  moved: boolean;
};

const Dot = ({ c, label }: { c: string; label: string }) => <svg width="14" height="14"><circle cx="7" cy="7" r="5" fill={c} stroke="#f6efe2" strokeWidth="2" /><text x="7" y="9.5" fontSize="6" textAnchor="middle" fill="#f6efe2">{label}</text></svg>;
const Diamond = ({ fill }: { fill: string }) => <svg width="14" height="14"><rect x="3" y="3" width="8" height="8" transform="rotate(45 7 7)" fill={fill} stroke="#1f2633" strokeWidth="1.8" /></svg>;

export function RouteLegend({ hasScenario, moved, hasTraveler }: { hasScenario: boolean; moved?: boolean; hasTraveler?: boolean }) {
  return (
    <div className="rounded bg-card/95 border px-2 py-1.5 space-y-1 font-mono text-[10px] shadow-sm max-w-[250px]" data-testid="legend-routes">
      {hasScenario ? <>
        <div className="flex items-center gap-2"><svg width="28" height="8"><line x1="0" y1="4" x2="28" y2="4" stroke="#b5651d" strokeWidth="6" strokeDasharray="6 4" /></svg>previous {moved ? 'remaining ' : ''}route (dashed, wide)</div>
        <div className="flex items-center gap-2"><svg width="28" height="8"><line x1="0" y1="4" x2="28" y2="4" stroke="#006e91" strokeWidth="3" /></svg>rerouted (solid, narrow)</div>
        <div className="flex items-center gap-2"><svg width="28" height="10"><rect x="9" y="0" width="10" height="10" fill="none" stroke="#5b2a86" strokeWidth="2.5" /></svg>event origin · <svg width="10" height="10"><rect x="0" y="0" width="10" height="10" fill="none" stroke="#5b2a86" strokeDasharray="2 2" /></svg> residual cells</div>
      </> : <div className="flex items-center gap-2"><svg width="28" height="8"><line x1="0" y1="4" x2="28" y2="4" stroke="#006e91" strokeWidth="4" /></svg>experimental route (cell centers)</div>}
      <div className="flex items-center gap-2"><svg width="28" height="8"><line x1="0" y1="4" x2="28" y2="4" stroke="#1f2633" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="0.1 5" /></svg>within-cell display link, uncosted</div>
      <div className="flex items-center gap-2"><Dot c="#2f7a6a" label="A" /><Dot c="#a8432a" label="B" />exact plotted points</div>
      {moved && <div className="flex items-center gap-2"><Diamond fill="#f6efe2" />reroute origin (cell center); A no longer start</div>}
      {hasTraveler && <div className="flex items-center gap-2"><Diamond fill="#d9a03a" />traveler (snapped cell center)</div>}
    </div>
  );
}

type Props = {
  canSimulate: boolean; disabledReason?: string; pending: boolean; error: unknown; onSimulate: () => void; onReset: () => void;
  scenario: Scenario | null;
  /** Selectable waypoints on the current active path (destination excluded). */
  selectableCount: number;
  traveler: number | null; onTravelerChange: (i: number | null) => void;
  picking: boolean; onTogglePick: () => void;
  travelerCell?: { row: number; col: number; centerLat: number; centerLng: number };
};

export function ScenarioPanel({ canSimulate, disabledReason, pending, error, onSimulate, onReset, scenario, selectableCount, traveler, onTravelerChange, picking, onTogglePick, travelerCell }: Props) {
  const s = scenario;
  const same = s ? samePathGeometry(s.oldRoute, s.newRoute) : false;
  const ev = s?.event;
  return (
    <section className="border-t pt-5" data-testid="panel-scenario">
      <h2 className="font-display text-xl">Simulated hazard event</h2>
      <p className="mt-2 text-xs">A hypothetical scenario, not an observation. The server picks one random cell on the current path (after start) and raises one terrain or structure factor; up to 8 neighboring cells get a smaller residual. The route is then recomputed with the same algorithm; the geometry may or may not change. Source data are never modified.</p>
      <div className="mt-3 rounded-md border bg-card p-3 space-y-2 text-xs" data-testid="panel-traveler">
        <label className="flex items-center gap-2 font-medium">
          <input type="checkbox" checked={traveler !== null} disabled={pending || selectableCount < 1} data-testid="checkbox-traveler"
            onChange={(e) => onTravelerChange(e.target.checked ? 0 : null)} className="accent-[#d9a03a]" />
          <Footprints className="h-3.5 w-3.5" />Place traveler on current path (optional)
        </label>
        {traveler !== null && selectableCount > 0 && <>
          <div className="flex items-center gap-2">
            <input type="range" min={0} max={selectableCount - 1} step={1} value={traveler} disabled={pending}
              aria-label="Traveler waypoint index" data-testid="slider-traveler"
              onChange={(e) => onTravelerChange(Number(e.target.value))} className="flex-1 accent-[#d9a03a]" />
            <span className="font-mono w-16 text-right" data-testid="text-traveler-index">{traveler} / {selectableCount - 1}</span>
          </div>
          <button onClick={onTogglePick} disabled={pending} data-testid="button-pick-traveler"
            className={`w-full rounded border px-2 py-1 ${picking ? 'bg-[#d9a03a] text-[#1f2633]' : 'hover:bg-muted'} disabled:opacity-50`}>{picking ? 'Click a route waypoint on the map… (click to stop)' : 'Pick waypoint on map'}</button>
          {travelerCell && <p className="font-mono text-[10px]" data-testid="text-traveler-cell">cell [{travelerCell.row}, {travelerCell.col}] center {travelerCell.centerLat.toFixed(4)}°, {travelerCell.centerLng.toFixed(4)}°</p>}
        </>}
        <p className="text-muted-foreground">Positions snap to modeled grid-cell centers on the current path, not continuous sub-cell or GPS positions. The destination cell cannot be chosen. Choosing a position does not run anything; the next event is drawn only from cells after it, and the reroute starts from that cell center toward B. Leave unchecked for the full-route behavior.</p>
      </div>
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
              <tr className="border-t"><td className="py-1">pre-event {s.moved ? 'remaining ' : ''}route, pre-event grid</td><td className="text-right">{s.oldRoute.totalCost.toFixed(4)}</td></tr>
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
          {s.moved && <p className="border-l-2 border-[#d9a03a] pl-2" data-testid="text-moved-origin">Traveler-positioned: the previous route and the cost comparison cover only the remaining path from the reroute origin ({s.origin.lat.toFixed(4)}°, {s.origin.lng.toFixed(4)}°, a cell center) to B. The original A is no longer the start; Reset restores the A route.</p>}
          <p className="text-muted-foreground">In-memory only. Reset, a new grid, new endpoints, a new algorithm, or a reload discards the scenario.</p>
        </div>)}
    </section>
  );
}
