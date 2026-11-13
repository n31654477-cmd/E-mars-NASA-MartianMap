import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { PageHead, SearchBox, LinkBtn, Empty, SkeletonBlock, ErrorPanel } from '@/components/kit';
import { dataUrl, fmtBytes } from '@/lib/catalog';

type ExportItem = { name: string; url: string; size?: number | string; description?: string };

export default function Exports() {
  const [q, setQ] = useState('');
  const eq = useQuery({
    queryKey: ['export-index'],
    queryFn: async () => {
      const u = dataUrl('data/export-index.json');
      const r = await fetch(u);
      if (!r.ok) throw new Error(`HTTP ${r.status} while loading ${u}`);
      const j = await r.json();
      return (Array.isArray(j) ? j : []) as ExportItem[];
    },
    staleTime: Infinity,
    retry: 1,
  });
  const t = q.toLowerCase();
  const list = (eq.data ?? []).filter((e) => !t || `${e.name} ${e.url} ${e.description ?? ''}`.toLowerCase().includes(t));

  return (
    <>
      <PageHead eyebrow="Exports / supplementary extractions" title="Exports">
        <LinkBtn href={dataUrl('data/NASA-extracted-data.zip')} download data-testid="link-zip-extracted"><Download className="h-3.5 w-3.5" />Extracted data ZIP</LinkBtn>
        <LinkBtn href={dataUrl('data/NASA-original-sources.zip')} download data-testid="link-zip-sources"><Download className="h-3.5 w-3.5" />Original sources ZIP</LinkBtn>
      </PageHead>
      <div className="mb-5 rounded-sm border-l-2 border-primary bg-muted/50 px-4 py-3 text-xs leading-relaxed" data-testid="text-precision-caveat">
        <div className="eyebrow mb-1 text-primary">Source precision caveat</div>
        The fixed-width DBF lexical JSON is authoritative for the exact decimal spelling of attribute values as stored in the source files. The regular record JSON is the typed representation produced by the reader, and its numeric spelling may differ from the stored text.
      </div>
      <div className="mb-3"><SearchBox value={q} onChange={setQ} placeholder="Search exports by name, path, description" testId="input-search-exports" /></div>
      {eq.isLoading ? <SkeletonBlock rows={10} /> : eq.error ? <ErrorPanel error={eq.error} onRetry={() => eq.refetch()} /> : list.length === 0 ? <Empty title="No exports found" /> : (
        <>
          <div className="eyebrow mb-2">{list.length} of {eq.data?.length ?? 0} files</div>
          <div className="divide-y divide-border rounded-sm border border-border bg-card">
            {list.map((e, i) => (
              <div key={`${e.url}-${i}`} className="flex flex-wrap items-center gap-3 px-3 py-2 hover:bg-muted/40" data-testid={`row-export-${i}`}>
                <div className="min-w-0 flex-1">
                  <div className="break-all font-mono text-xs font-medium">{e.name}</div>
                  {e.description && <div className="text-xs text-muted-foreground">{e.description}</div>}
                  <div className="break-all font-mono text-[10.5px] text-muted-foreground">{e.url}</div>
                </div>
                <span className="whitespace-nowrap font-mono text-[11px] tabular-nums text-muted-foreground">{fmtBytes(e.size).split('  ')[0]}</span>
                <LinkBtn href={dataUrl(e.url)} download data-testid={`link-export-${i}`}><Download className="h-3.5 w-3.5" />Download</LinkBtn>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
