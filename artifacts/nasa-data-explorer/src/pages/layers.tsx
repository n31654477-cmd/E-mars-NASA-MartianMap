import { useMemo, useState } from 'react';
import { Link, useParams } from 'wouter';
import { ArrowLeft, Download, ExternalLink } from 'lucide-react';
import { PageHead, WithCatalog, SearchBox, Pager, Btn, LinkBtn, Empty, Cite, Pre, SkeletonBlock, ErrorPanel } from '@/components/kit';
import { dataUrl, display, downloadJson, useRecords, type Catalog, type Layer, type RecordRow } from '@/lib/catalog';

export function LayersIndex() {
  const [q, setQ] = useState('');
  return (
    <WithCatalog>
      {(c) => {
        const t = q.toLowerCase();
        const ls = c.layers.filter((l) => !t || `${l.name} ${l.source} ${l.geometryType} ${l.format}`.toLowerCase().includes(t));
        return (
          <>
            <PageHead eyebrow="Layers / distinct source versions" title="Layer explorer" />
            <div className="mb-4"><SearchBox value={q} onChange={setQ} placeholder="Filter layers by name, source file, geometry" testId="input-search-layers" /></div>
            {ls.length === 0 ? <Empty title="No layers" /> : (
              <div className="overflow-x-auto rounded-sm border border-border bg-card">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2">Layer</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Format</th><th className="px-3 py-2">Geometry</th><th className="px-3 py-2 text-right">Records</th><th className="px-3 py-2 text-right">Fields</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {ls.map((l) => (
                      <tr key={l.id} className="hover:bg-muted/40">
                        <td className="px-3 py-2"><Link href={`/layers/${encodeURIComponent(l.id)}`} className="font-medium hover:text-primary" data-testid={`link-layer-${l.id}`}>{l.name}</Link></td>
                        <td className="px-3 py-2"><Cite file={l.source} loc={`layer ${l.name}`} /></td>
                        <td className="px-3 py-2 font-mono">{l.format}</td>
                        <td className="px-3 py-2 font-mono">{l.geometryType}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{l.count}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{l.fields.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        );
      }}
    </WithCatalog>
  );
}

const PER = 50;

function Records({ layer }: { layer: Layer }) {
  const rq = useRecords(layer.recordsUrl);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<RecordRow | null>(null);
  const cols = useMemo(() => {
    const fromFields = layer.fields.map((f) => f.name);
    const first = rq.data?.[0];
    const extra = first ? Object.keys(first).filter((k) => k !== '_source' && !fromFields.includes(k)) : [];
    return [...fromFields, ...extra];
  }, [layer, rq.data]);
  const rows = useMemo(() => {
    const d = rq.data ?? [];
    const t = q.toLowerCase();
    if (!t) return d;
    return d.filter((r) => cols.some((k) => display(r[k]).toLowerCase().includes(t)) || display(r._source?.featureId).toLowerCase().includes(t));
  }, [rq.data, q, cols]);
  if (!layer.recordsUrl) return <Empty title="No records file" hint="This layer has no recordsUrl in the catalog." />;
  if (rq.isLoading) return <SkeletonBlock rows={12} />;
  if (rq.error) return <ErrorPanel error={rq.error} onRetry={() => rq.refetch()} />;
  const pages = Math.ceil(rows.length / PER);
  const view = rows.slice(page * PER, page * PER + PER);
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(0); }} placeholder={`Search ${rq.data?.length ?? 0} original records`} testId="input-search-records" />
        <Btn onClick={() => downloadJson(`${layer.id}-filtered.json`, rows)} data-testid="button-download-filtered"><Download className="h-3.5 w-3.5" />Filtered JSON</Btn>
      </div>
      {rows.length === 0 ? <Empty title="No matching records" /> : (
        <>
          <div className="max-h-[70vh] overflow-auto rounded-sm border border-border bg-card">
            <table className="w-full text-left text-[11px]">
              <thead className="sticky top-0 z-10 bg-muted font-mono text-[10px] text-muted-foreground">
                <tr><th className="sticky left-0 bg-muted px-2 py-2">featureId</th>{cols.map((k) => <th key={k} className="whitespace-nowrap px-2 py-2">{k}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {view.map((r, i) => (
                  <tr key={i} onClick={() => setSel(r)} className="cursor-pointer hover:bg-accent/50" data-testid={`row-record-${page * PER + i}`}>
                    <td className="sticky left-0 bg-card px-2 py-1 text-primary">{display(r._source?.featureId)}</td>
                    {cols.map((k) => <td key={k} className="max-w-[260px] truncate whitespace-nowrap px-2 py-1" title={display(r[k])}>{display(r[k])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} pages={pages} setPage={setPage} total={rows.length} />
        </>
      )}
      {sel && (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={() => setSel(null)}>
          <div className="absolute inset-0 bg-foreground/30" />
          <div className="rise relative h-full w-full max-w-lg overflow-auto border-l border-border bg-background p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><div className="eyebrow">Original record</div><Btn onClick={() => setSel(null)} data-testid="button-close-record">Close</Btn></div>
            <Cite file={sel._source?.filename ?? layer.source} loc={`layer ${sel._source?.layer ?? layer.name} · feature ${display(sel._source?.featureId)}`} />
            <dl className="mt-4 divide-y divide-border border-y border-border">
              {Object.entries(sel).filter(([k]) => k !== '_source').map(([k, v]) => (
                <div key={k} className="grid grid-cols-[40%_60%] gap-2 py-1.5 text-xs"><dt className="font-mono text-muted-foreground">{k}</dt><dd className="break-words font-mono">{display(v)}</dd></div>
              ))}
            </dl>
            <Btn className="mt-4" onClick={() => downloadJson(`${layer.id}-${display(sel._source?.featureId)}.json`, sel)} data-testid="button-download-record">Download record JSON</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ c, id }: { c: Catalog; id: string }) {
  const l = c.layers.find((x) => x.id === id);
  const [tab, setTab] = useState<'records' | 'schema' | 'crs'>('records');
  if (!l) return <Empty title="Layer not found" hint={id} />;
  return (
    <>
      <Link href="/layers" className="mb-4 inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-primary" data-testid="link-back-layers"><ArrowLeft className="h-3 w-3" />layers</Link>
      <PageHead eyebrow={`${l.format} · ${l.geometryType}`} title={l.name}>
        {l.recordsUrl && <LinkBtn href={dataUrl(l.recordsUrl)} download data-testid="link-download-records"><Download className="h-3.5 w-3.5" />Records JSON</LinkBtn>}
        {l.geometryUrl && <LinkBtn href={dataUrl(l.geometryUrl)} download data-testid="link-download-geometry"><Download className="h-3.5 w-3.5" />Geometry WKB</LinkBtn>}
        {l.sourceUrl && <LinkBtn href={l.sourceUrl} target="_blank" rel="noreferrer" data-testid="link-layer-source"><ExternalLink className="h-3.5 w-3.5" />Source file</LinkBtn>}
      </PageHead>
      <div className="mb-5 grid gap-px overflow-hidden rounded-sm border border-border bg-border text-xs sm:grid-cols-2 lg:grid-cols-4">
        {[['Citation', <Cite key="c" file={l.source} loc={`layer ${l.name}`} />], ['Records', <span key="r" className="font-mono">{l.count}</span>], ['Units', <span key="u" className="font-mono">{l.units || '—'}</span>], ['Extent', <span key="e" className="break-all font-mono">{l.extent.length ? l.extent.map(display).join(', ') : '—'}</span>]].map(([k, v]) => (
          <div key={k as string} className="bg-card p-3"><div className="eyebrow mb-1">{k}</div>{v}</div>
        ))}
      </div>
      {l.notes.length > 0 && <ul className="mb-5 list-disc space-y-1 rounded-sm border-l-2 border-chart-3 bg-muted/40 py-2 pl-8 pr-3 text-xs">{l.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
      <div className="mb-3 flex gap-1 border-b border-border">
        {(['records', 'schema', 'crs'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-3 py-2 font-mono text-xs uppercase tracking-wider ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`} data-testid={`tab-${t}`}>{t === 'crs' ? 'CRS WKT' : t}</button>
        ))}
      </div>
      {tab === 'records' && <Records layer={l} />}
      {tab === 'schema' && (
        <div className="overflow-x-auto rounded-sm border border-border bg-card">
          <table className="w-full text-left font-mono text-xs"><thead className="bg-muted text-[10px] uppercase text-muted-foreground"><tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Field</th><th className="px-3 py-2">Type</th></tr></thead>
            <tbody className="divide-y divide-border">{l.fields.map((f, i) => <tr key={f.name}><td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td><td className="px-3 py-1.5">{f.name}</td><td className="px-3 py-1.5">{f.type}</td></tr>)}</tbody></table>
        </div>
      )}
      {tab === 'crs' && <Pre>{l.crs || 'No CRS recorded.'}</Pre>}
    </>
  );
}

export function LayerDetail() {
  const p = useParams<{ id: string }>();
  return <WithCatalog>{(c) => <Detail c={c} id={decodeURIComponent(p.id ?? '')} />}</WithCatalog>;
}
