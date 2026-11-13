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
          The source geologic map is compiled at 1:20,000,000. At that scale a single line width spans kilometres. Nothing here is a rover navigation guarantee, and unmeasured terrain is never treated as traversable.
        </p>
      </section>
      {q.isLoading && <div className="space-y-3"><Sk className="h-6 w-1/2" /><Sk className="h-40" /></div>}
      {q.isError && <ErrorPanel title="Data unavailable: summary could not be loaded" error={q.error} onRetry={() => q.refetch()} />}
      {s && (
        <>
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
