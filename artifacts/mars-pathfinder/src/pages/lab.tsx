import { useState } from 'react';
import { useRunMarsAlgorithm, MarsLabInputAlgorithm, MarsLabInputFixture } from '@workspace/api-client-react';
import type { MarsLabInputAlgorithm as Alg, MarsLabInputFixture as Fix } from '@workspace/api-client-react';
import { FlaskConical, Play } from 'lucide-react';
import { ErrorPanel, Sk } from '@/components/shell';

export default function LabPage() {
  const [alg, setAlg] = useState<Alg>('dijkstra');
  const [fix, setFix] = useState<Fix>('weighted');
  const run = useRunMarsAlgorithm();
  const r = run.data;
  const go = () => run.mutate({ data: { algorithm: alg, fixture: fix } });
  const pathIdx = new Map((r?.path ?? []).map((p, i) => [`${p.row},${p.col}`, i]));
  const maxDf = Math.max(1, ...(r?.cells ?? []).map((c) => c.df));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 md:px-8 py-8">
      <div className="rounded-lg border-2 border-dashed border-chart-4/60 bg-chart-4/5 px-4 py-3 text-sm flex gap-2 items-start" data-testid="text-synthetic-banner">
        <FlaskConical className="h-4 w-4 mt-0.5 text-chart-4 shrink-0" />
        <span><b>Synthetic fixtures.</b> These grids are hand-built test cases for verifying algorithm behaviour. They are not scientific measurements, have no geographic location, and never appear on the Mars map.</span>
      </div>
      <h1 className="font-display text-4xl mt-8">Algorithm laboratory</h1>
      <div className="mt-6 grid md:grid-cols-[280px_1fr] gap-8">
        <aside className="space-y-6">
          <Choice label="Algorithm" value={alg} options={Object.values(MarsLabInputAlgorithm)} onChange={(v) => setAlg(v as Alg)} />
          <Choice label="Fixture" value={fix} options={Object.values(MarsLabInputFixture)} onChange={(v) => setFix(v as Fix)} />
          <button onClick={go} disabled={run.isPending} data-testid="button-run-lab"
            className="w-full inline-flex justify-center items-center gap-2 rounded-md bg-primary text-primary-foreground py-2 font-medium disabled:opacity-60 active:scale-[.98] transition-transform">
            <Play className="h-4 w-4" />{run.isPending ? 'Running…' : 'Run fixture'}
          </button>
        </aside>
        <section>
          {run.isError && <ErrorPanel title="Lab run failed" error={run.error} onRetry={go} />}
          {run.isPending && <Sk className="aspect-square max-w-md" />}
          {!r && !run.isPending && !run.isError && (
            <div className="h-72 rounded-lg border border-dashed grid place-items-center text-muted-foreground text-sm">Pick an algorithm and fixture, then run.</div>
          )}
          {r && !run.isPending && (
            <div className="rise space-y-5">
              <div className="flex flex-wrap gap-2 font-mono text-xs">
                <Stat k="found" v={String(r.found)} />
                <Stat k="total cost" v={r.totalCost.toFixed(3)} />
                <Stat k="avg safety" v={r.avgSafetyScore.toFixed(3)} />
                <Stat k="min safety" v={r.minSafetyScore.toFixed(3)} />
                <Stat k="path cells" v={String(r.visitedPathCells)} />
                <Stat k="synthetic" v={String(r.synthetic)} />
              </div>
              <div className="inline-grid gap-px bg-border p-px rounded" style={{ gridTemplateColumns: `repeat(${r.columns}, minmax(0, 2.25rem))` }} data-testid="grid-lab">
                {r.cells.map((c) => {
                  const k = `${c.row},${c.col}`; const pi = pathIdx.get(k);
                  return (
                    <div key={k} title={`r${c.row} c${c.col} df=${c.df}${c.blocked ? ' blocked' : ''}`}
                      className={`aspect-square grid place-items-center font-mono text-[10px] ${c.blocked ? 'bg-foreground/80 text-background' : ''}`}
                      style={c.blocked ? undefined : { background: `hsl(200 30% ${94 - (c.df / maxDf) * 40}%)` }}>
                      {pi !== undefined ? <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground grid place-items-center">{pi}</span> : c.blocked ? '×' : c.df}
                    </div>);
                })}
              </div>
              <p className="text-sm text-muted-foreground">{r.warning}</p>
              <p className="font-mono text-xs text-muted-foreground">path: {r.path.length ? r.path.map((p) => `(${p.row},${p.col})`).join(' → ') : 'none'}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Choice({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">{options.map((o) => (
        <button key={o} onClick={() => onChange(o)} data-testid={`button-${label.toLowerCase()}-${o}`}
          className={`px-3 py-1 rounded-md border text-sm font-mono ${value === o ? 'bg-secondary border-secondary-foreground/30' : 'hover:bg-muted'}`}>{o}</button>))}</div>
    </div>
  );
}
function Stat({ k, v }: { k: string; v: string }) {
  return <span className="rounded border bg-card px-2 py-1"><span className="text-muted-foreground">{k}</span> {v}</span>;
}
