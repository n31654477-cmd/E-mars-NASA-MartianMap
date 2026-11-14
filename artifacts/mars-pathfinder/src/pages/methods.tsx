import { useGetMarsSummary } from '@workspace/api-client-react';
import { ErrorPanel, Sk } from '@/components/shell';

export default function MethodsPage() {
  const q = useGetMarsSummary();
  const s = q.data;
  return (
    <div className="mx-auto w-full max-w-5xl px-4 md:px-8 py-10 space-y-12">
      <section className="rise">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Scientific limits</p>
        <h1 className="font-display text-4xl md:text-5xl mt-2 max-w-3xl">What this map knows, and the larger set of things it refuses to guess.</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          The source geologic map is compiled at 1:20,000,000. Experimental routing assumes covered cells can be crossed, but this is not measured traversability or a rover navigation guarantee.
        </p>
      </section>
      {q.isLoading && <div className="space-y-3"><Sk className="h-6 w-1/2" /><Sk className="h-40" /></div>}
      {q.isError && <ErrorPanel title="Data unavailable: summary could not be loaded" error={q.error} onRetry={() => q.refetch()} />}
      {s && (
        <>
          <section className="space-y-5" data-testid="risk-formula-methods">
            <h2 className="font-display text-3xl">Experimental risk formula</h2>
            <p className="rounded-md border bg-secondary p-4 font-mono">{s.riskModel.formula}</p>
            <p className="border-l-4 border-primary pl-4">{s.riskModel.calibration}</p>
            <p>{s.riskModel.warning}</p>
            <p>{s.riskModel.spatialPolicy}</p>
            <p>Each category score is normalized from 0 to 1 and multiplied by its factor weight. The weights sum to 100. Rules are evaluated in the order shown; the first matching terrain rule wins. If multiple polygons or structures apply, take the maximum within that factor—never add duplicate source versions. Scores are not empirically calibrated. A geological category is not a measurement of roughness, ice, soil strength, slope or present weather.</p>
            {s.riskModel.factors.map(f=><section key={f.id} className="rounded-md border bg-card p-4 space-y-3">
              <h3 className="font-display text-xl">{f.name} · {f.weight} maximum points</h3><p>{f.rationale}</p>
              <div className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th>Category</th><th>Raw score</th><th>Contribution</th><th>Rule</th></tr></thead>
                <tbody>{f.rules.map((r,i)=><tr key={i} className="border-t"><td className="py-2 pr-3">{r.name}</td><td>{r.score}</td><td>{(r.score*f.weight).toFixed(2)}</td><td>{r.match}</td></tr>)}</tbody>
              </table></div>
            </section>)}
            <h3 className="font-display text-xl">Worked example</h3>
            <p>Basin/lowland T=0.3, a mapped scarp M=1, and geology present U=7/8: R = 45×0.3 + 35×1 + 20×0.875 = <strong>66</strong>. Inverse model score = 34. DF = 1.66. This example is arithmetic, not a measured location or a 66% chance of harm.</p>
            <h3 className="font-display text-xl">How the route uses this formula</h3><p>{s.riskModel.routingPolicy}</p>
            <p>DF includes a unit step cost. Therefore Dijkstra/A* minimize accumulated step-plus-model-risk cost, not raw total risk alone, shortest kilometers, or actual mission failure probability. This is an explicit new input-cost policy requested for this model; the original prototype algorithms and original ComputeDF implementation remain unchanged. Changing grid resolution changes structural intersections and routes. No cost is charged for entering the starting cell; safety averages include it, as in the prototype.</p>
            <section className="rounded-md border-2 border-dashed p-4 space-y-3" data-testid="methods-hazard-event">
              <h3 className="font-display text-xl">Simulated hazard events (hypothetical scenarios)</h3>
              <p>The map's random-event button runs a what-if scenario. It does not modify source observations, the original algorithms, or the risk formula. The server chooses one random eligible cell on the current path (after the start cell) and one factor that is not yet saturated: terrain T or structure M. Uncertainty U, source geometry, and unknown traversability stay unchanged.</p>
              <p className="rounded-md border bg-secondary p-3 font-mono text-sm">origin: f' = min(1, f + δ),  δ ~ Uniform[min(0.05, 1−f), min(0.25, 1−f)]<br />neighbor: Δf = min(1−f, δ · 0.5 / (1 + A/10000) / √(dr² + dc²))<br />R = 45T + 35M + 20U,  DF = 1 + R/100</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Factor scores are bounded in [0, 1]; values are capped at 1. The delta range [0.05, 0.25] was chosen by the analyst and has no empirical calibration.</li>
                <li>Only the same factor changes, and only in the origin cell and up to 8 covered neighboring cells (one ring). Nothing beyond that ring changes.</li>
                <li>A is each receiving cell's area in km²: A = r² × Δλ × |sin(φN) − sin(φS)|, with angles in radians and Mars-sphere radius r = 3396.190 km. The reference area is 10,000 km². Larger cells get a smaller residual. dr/dc are row/column offsets, so diagonal neighbors have an additional √2 attenuation.</li>
                <li>The guarantee is about added danger: ΔDF of a neighbor &lt; ΔDF of the origin. It does not mean the neighbor's total score ends up lower than the origin's.</li>
                <li>Events stack, up to 50. Each new event starts from the current event list and the current rerouted path. Reset restores the source-derived grid and original pre-scenario route; Clear route also removes the route.</li>
                <li>Optional traveler position: before pressing the event button you may place a traveler on a waypoint of the current path (map click within about 18 screen pixels of a cell center, or the step slider). Positions snap to modeled cell centers; they are not continuous sub-cell positions or GPS fixes, and the destination cell cannot be chosen. Choosing a position calls nothing. The event is then drawn only from entered cells after the traveler, the previous route shown is the remaining suffix, and the reroute runs from that cell center to B, so old and new costs compare the same remaining stretch. Later events start from that effective origin even if the selection is cleared; only Reset returns to A. Without a traveler the full A-to-B behavior is unchanged.</li>
                <li>The original BFS, Dijkstra and A* code is unchanged. BFS ignores DF, so it often keeps the same path, and the app reports identical geometry when that happens.</li>
              </ul>
              <h4 className="font-display text-lg">Worked example</h4>
              <p>δ = 0.2, A = 10,000 km². Orthogonal neighbor: 0.2 × 0.5 / 2 / 1 = <strong>0.05</strong>. Diagonal neighbor: 0.05 / √2 = <strong>0.035355</strong>. If the factor is terrain (weight 45): origin ΔDF = 45 × 0.2 / 100 = <strong>0.09</strong>; orthogonal ΔDF = 45 × 0.05 / 100 = <strong>0.0225</strong>.</p>
              <h4 className="font-display text-lg">Route display: exact dots and cell centers</h4>
              <p>Routing operates on cell centers only. The plotted A and B dots (or a traveler cell center) are joined to the first and last path centers with dotted within-cell display links. These links are schematic: they add no cost, no distance and no step, and no sub-cell hazard check is made along them. The original algorithms, DF costs and center-to-center distance are not altered. A route that starts and ends in one cell is drawn as two links meeting at that cell's center; coincident points draw no link.</p>
              <p className="text-sm text-muted-foreground">Scope: selections are rectangles only and cannot cross the antimeridian. Scenarios are kept in memory only. Nothing is saved, and reloading the page discards them.</p>
            </section>
            <h3 className="font-display text-xl">Excluded inputs and unresolved limits</h3>
            <ul className="list-disc pl-5">{s.riskModel.exclusions.map(x=><li key={x}>{x}</li>)}</ul>
            <h3 className="font-display text-xl">Evidence and interpretation</h3>
            {s.riskModel.references.map(r=><p key={r.url}><a className="text-primary underline" href={r.url} target="_blank" rel="noreferrer">{r.title}</a><span className="block text-sm">{r.locator}</span></p>)}
            <p className="font-mono text-xs">Model version: {s.riskModel.version}</p>
          </section>
          <section className="grid md:grid-cols-[1fr_2fr] gap-6">
            <h2 className="font-display text-2xl">Limitation</h2>
            <p className="border-l-2 border-primary pl-4" data-testid="text-limitation">{s.limitation}</p>
          </section>
          <section className="grid md:grid-cols-[1fr_2fr] gap-6">
            <h2 className="font-display text-2xl">Methods</h2>
            <ol className="space-y-2 list-decimal pl-5">{s.methods.map((m, i) => <li key={i}>{m}</li>)}</ol>
          </section>
          <section className="grid md:grid-cols-[1fr_2fr] gap-6">
            <h2 className="font-display text-2xl">Missing measurements</h2>
            <div className="flex flex-wrap gap-2">{s.missingMeasurements.map((m) => <span key={m} className="hatch border border-dashed rounded px-2 py-1 font-mono text-xs">{m}: unknown</span>)}</div>
          </section>
          <section className="grid md:grid-cols-[1fr_2fr] gap-6">
            <h2 className="font-display text-2xl">Algorithms</h2>
            <div className="space-y-4">{s.algorithms.map((a) => (
              <div key={a.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-baseline justify-between"><span className="font-medium">{a.name}</span><span className="font-mono text-xs text-muted-foreground">{a.id}</span></div>
                <p className="text-sm mt-1"><span className="text-muted-foreground">Objective:</span> {a.objective}</p>
                <p className="text-sm text-muted-foreground mt-1">{a.description}</p>
                <p className="font-mono text-[11px] mt-2 break-all">{a.source}</p>
              </div>))}</div>
          </section>
          <section>
            <h2 className="font-display text-2xl mb-4">Full layer inventory · {s.layers.length} layers · {s.sourceCount} sources</h2>
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-sm">
                <thead className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/50"><tr>{['id', 'name', 'file', 'count', 'units', 'crs', 'role', 'display'].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
                <tbody>{s.layers.map((l) => (
                  <tr key={l.id} className="border-t" data-testid={`row-layer-${l.id}`}>
                    <td className="px-3 py-2 font-mono text-xs">{l.id}</td>
                    <td className="px-3 py-2"><a href={l.sourceUrl} target="_blank" rel="noreferrer" className="underline decoration-dotted hover:text-primary">{l.name}</a></td>
                    <td className="px-3 py-2 font-mono text-xs">{l.filename}</td>
                    <td className="px-3 py-2 font-mono text-xs">{l.count}</td>
                    <td className="px-3 py-2 text-xs">{l.units}</td>
                    <td className="px-3 py-2 font-mono text-xs">{l.crs}</td>
                    <td className="px-3 py-2 text-xs">{l.role}</td>
                    <td className="px-3 py-2 text-xs">{l.displayAvailable ? <span className="text-chart-2">rendered</span> : <span className="text-muted-foreground">inventory only</span>}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
