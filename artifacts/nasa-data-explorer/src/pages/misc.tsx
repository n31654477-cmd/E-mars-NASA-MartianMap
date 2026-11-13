import { useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import { PageHead, WithCatalog, SearchBox, Btn, LinkBtn, Empty, Cite, Pre, Sev } from '@/components/kit';
import { display, downloadJson } from '@/lib/catalog';

export function Rasters() {
  return (
    <WithCatalog>
      {(c) => (
        <>
          <PageHead eyebrow="Rasters / source metadata and pixel summaries" title="Raster metadata" />
          <p className="mb-5 max-w-3xl text-xs text-muted-foreground">Header metadata is retained as read. Band min/max, valid-pixel counts and histograms are separately computed from full scans of the original pixels. No elevation is inferred from shaded-relief products.</p>
          {c.rasters.length === 0 ? <Empty title="No rasters in catalog" /> : (
            <div className="space-y-5">
              {c.rasters.map((r, i) => (
                <section key={i} className="rounded-sm border border-border bg-card p-4" data-testid={`card-raster-${i}`}>
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div><div className="font-medium">{r.name}</div><Cite file={r.source} loc="raster header / full-band pixel scan" href={r.sourceUrl} /></div>
                    <Btn onClick={() => downloadJson(`${r.name}.metadata.json`, r)} data-testid={`button-download-raster-${i}`}><Download className="h-3.5 w-3.5" />JSON</Btn>
                  </div>
                  <dl className="divide-y divide-border border-y border-border">
                    {Object.entries(r.metadata).map(([k, v]) => (
                      <div key={k} className="grid gap-2 py-1.5 text-xs md:grid-cols-[220px_1fr]">
                        <dt className="font-mono text-muted-foreground">{k}</dt>
                        <dd className="min-w-0">{typeof v === 'string' && v.length > 200 ? <Pre>{v}</Pre> : typeof v === 'object' && v !== null ? <Pre>{JSON.stringify(v, null, 2)}</Pre> : <span className="break-words font-mono">{display(v)}</span>}</dd>
                      </div>
                    ))}
                  </dl>
                  {r.notes.length > 0 && <ul className="mt-3 list-disc pl-5 text-xs text-muted-foreground">{r.notes.map((n, j) => <li key={j}>{n}</li>)}</ul>}
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </WithCatalog>
  );
}

export function Metadata() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<number | null>(0);
  return (
    <WithCatalog>
      {(c) => {
        const t = q.toLowerCase();
        const list = c.metadata.map((m, i) => ({ m, i })).filter(({ m }) => !t || `${m.name} ${m.text}`.toLowerCase().includes(t));
        return (
          <>
            <PageHead eyebrow="Metadata / original text" title="Source metadata" />
            <div className="mb-4"><SearchBox value={q} onChange={setQ} placeholder="Search metadata files and text" testId="input-search-metadata" /></div>
            {list.length === 0 ? <Empty title="No metadata matches" /> : (
              <div className="divide-y divide-border border-y border-border">
                {list.map(({ m, i }) => (
                  <section key={i} className="py-3">
                    <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-2 text-left" data-testid={`button-toggle-meta-${i}`}>
                      <span className="font-medium hover:text-primary">{m.name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{m.text.length.toLocaleString()} chars {open === i ? '−' : '+'}</span>
                    </button>
                    {open === i && (
                      <div className="rise mt-2 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <Cite file={m.name} loc="full text" />
                          {m.sourceUrl && <LinkBtn href={m.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" />Source</LinkBtn>}
                          <Btn onClick={() => downloadJson(`${m.name}.json`, m)} data-testid={`button-download-meta-${i}`}><Download className="h-3 w-3" />JSON</Btn>
                        </div>
                        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-sm border border-border bg-card p-4 font-mono text-[11.5px] leading-relaxed">{m.text}</pre>
                      </div>
                    )}
                  </section>
                ))}
              </div>
            )}
          </>
        );
      }}
    </WithCatalog>
  );
}

export function Issues() {
  const [sev, setSev] = useState('');
  return (
    <WithCatalog>
      {(c) => {
        const sevs = Array.from(new Set(c.issues.map((i) => i.severity)));
        const list = c.issues.filter((i) => !sev || i.severity === sev);
        return (
          <>
            <PageHead eyebrow="Ambiguities / methodology" title="Issues & methods">
              <Btn onClick={() => downloadJson('issues.json', c.issues)} data-testid="button-download-issues"><Download className="h-3.5 w-3.5" />Issues JSON</Btn>
            </PageHead>
            <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
              <section>
                <div className="mb-3 flex flex-wrap gap-1">
                  <Btn onClick={() => setSev('')} className={!sev ? 'border-primary text-primary' : ''} data-testid="button-sev-all">All {c.issues.length}</Btn>
                  {sevs.map((s) => <Btn key={s} onClick={() => setSev(s)} className={sev === s ? 'border-primary text-primary' : ''} data-testid={`button-sev-${s}`}>{s}</Btn>)}
                </div>
                {list.length === 0 ? <Empty title="No issues recorded" /> : (
                  <div className="space-y-2">
                    {list.map((i, k) => (
                      <div key={k} className="rounded-sm border border-border bg-card p-3 text-sm" data-testid={`card-issue-${k}`}>
                        <div className="mb-1.5 flex flex-wrap items-center gap-2"><Sev s={i.severity} /><Cite file={i.source} loc={i.locator} /></div>
                        <p className="leading-relaxed">{i.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <section>
                <div className="eyebrow mb-3">Extraction methods</div>
                {c.methods.length === 0 ? <Empty title="No methods listed" /> : (
                  <ol className="space-y-2">
                    {c.methods.map((m, i) => (
                      <li key={i} className="grid grid-cols-[28px_1fr] gap-2 text-sm"><span className="font-mono text-xs text-primary">{String(i + 1).padStart(2, '0')}</span><span className="leading-relaxed">{m}</span></li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          </>
        );
      }}
    </WithCatalog>
  );
}
