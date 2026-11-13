import { Link } from 'wouter';
import { ArrowUpRight } from 'lucide-react';
import { PageHead, WithCatalog, LinkBtn, Sev, Cite } from '@/components/kit';
import { CATALOG_URL, fmtBytes } from '@/lib/catalog';

export default function Overview() {
  return (
    <WithCatalog>
      {(c) => {
        const s = c.summary;
        const stats: [string, string, string][] = [
          ['Files', String(s.fileCount), '/inventory'],
          ['Folders', String(s.folderCount), '/inventory'],
          ['Archive size', fmtBytes(s.totalBytes).split('  ')[0], '/inventory'],
          ['Layers', String(s.layerCount), '/layers'],
          ['Records (per layer, summed)', s.recordCount.toLocaleString(), '/layers'],
          ['PDF pages', String(s.pdfPages), '/documents'],
        ];
        const formats = Object.entries(c.inventory.reduce<Record<string, number>>((a, f) => { a[f.format || 'unknown'] = (a[f.format || 'unknown'] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
        return (
          <div>
            <PageHead eyebrow="Overview / extracted archive" title={c.title || 'SIM 3292 archive'}>
              <LinkBtn href={CATALOG_URL} download data-testid="button-download-catalog">Download catalog.json</LinkBtn>
              <Link href="/exports" className="inline-flex items-center gap-1.5 rounded-sm border border-primary bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground" data-testid="link-exports">All exports</Link>
            </PageHead>
            {c.description && <p className="rise mb-8 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">{c.description}</p>}

            <section className="rise mb-10 grid grid-cols-2 border-l border-t border-border md:grid-cols-3 xl:grid-cols-6">
              {stats.map(([k, v, h]) => (
                <Link key={k} href={h} className="group border-b border-r border-border bg-card p-4 transition-colors hover:bg-muted/50" data-testid={`stat-${k.toLowerCase().replace(/\W+/g, '-')}`}>
                  <div className="eyebrow">{k}</div>
                  <div className="mt-2 font-mono text-2xl tabular-nums">{v}</div>
                </Link>
              ))}
            </section>
            <p className="-mt-8 mb-10 font-mono text-[10.5px] text-muted-foreground">Record total sums layer counts as reported; overlapping source versions are not deduplicated and do not represent unique features.</p>

            <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
              <section>
                <div className="eyebrow mb-3">Layers by source</div>
                <div className="divide-y divide-border border-y border-border">
                  {c.layers.length === 0 && <p className="py-4 text-sm text-muted-foreground">No layers in catalog.</p>}
                  {c.layers.map((l) => (
                    <Link key={l.id} href={`/layers/${encodeURIComponent(l.id)}`} className="group flex items-center gap-3 py-2.5 hover:bg-muted/40" data-testid={`link-layer-${l.id}`}>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium group-hover:text-primary">{l.name}</div>
                        <Cite file={l.source} loc={`layer ${l.name}`} />
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">{l.geometryType}</span>
                      <span className="w-20 text-right font-mono text-xs tabular-nums">{l.count}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  ))}
                </div>
              </section>
              <aside className="space-y-8">
                <section>
                  <div className="eyebrow mb-3">Formats in inventory</div>
                  <div className="flex flex-wrap gap-1.5">
                    {formats.map(([f, n]) => (
                      <Link key={f} href={`/inventory?format=${encodeURIComponent(f)}`} className="rounded-sm border border-border bg-card px-2 py-1 font-mono text-[11px] hover:border-primary" data-testid={`link-format-${f}`}>{f} <span className="text-muted-foreground">{n}</span></Link>
                    ))}
                  </div>
                </section>
                <section>
                  <div className="eyebrow mb-3">Open issues ({c.issues.length})</div>
                  <div className="space-y-2">
                    {c.issues.slice(0, 5).map((i, k) => (
                      <div key={k} className="rounded-sm border border-border bg-card p-2.5 text-xs">
                        <div className="mb-1 flex items-center gap-2"><Sev s={i.severity} /><Cite file={i.source} loc={i.locator} /></div>
                        {i.message}
                      </div>
                    ))}
                    {c.issues.length > 5 && <Link href="/issues" className="font-mono text-xs text-primary" data-testid="link-all-issues">View all {c.issues.length}</Link>}
                  </div>
                </section>
                <section>
                  <div className="eyebrow mb-3">Documents</div>
                  {c.documents.map((d, i) => (
                    <Link key={d.name} href={`/documents/${i}`} className="block border-b border-border py-2 text-sm hover:text-primary" data-testid={`link-doc-${i}`}>{d.name} <span className="font-mono text-[11px] text-muted-foreground">{d.pageCount} pp</span></Link>
                  ))}
                </section>
              </aside>
            </div>
          </div>
        );
      }}
    </WithCatalog>
  );
}
