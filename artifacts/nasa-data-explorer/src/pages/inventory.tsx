import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { PageHead, WithCatalog, SearchBox, Pager, Btn, Empty } from '@/components/kit';
import { downloadJson, fmtBytes, type Catalog } from '@/lib/catalog';

const PER = 100;

function Inner({ c }: { c: Catalog }) {
  const init = new URLSearchParams(window.location.search).get('format') ?? '';
  const [q, setQ] = useState('');
  const [fmt, setFmt] = useState(init);
  const [page, setPage] = useState(0);
  const formats = useMemo(() => Array.from(new Set(c.inventory.map((f) => f.format || 'unknown'))).sort(), [c]);
  const rows = useMemo(() => {
    const t = q.toLowerCase();
    return c.inventory.filter((f) => (!fmt || (f.format || 'unknown') === fmt) && (!t || `${f.path} ${f.name} ${f.format} ${f.mimeType} ${f.status}`.toLowerCase().includes(t)));
  }, [c, q, fmt]);
  const pages = Math.ceil(rows.length / PER);
  const view = rows.slice(page * PER, page * PER + PER);
  return (
    <>
      <PageHead eyebrow="Inventory / recursive folder tree" title="File inventory">
        <Btn onClick={() => downloadJson('inventory-filtered.json', rows)} data-testid="button-download-inventory">Download filtered JSON</Btn>
      </PageHead>
      <div className="mb-3 flex flex-wrap gap-2">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(0); }} placeholder="Search path, name, format, mime, status" testId="input-search-inventory" />
        <select value={fmt} onChange={(e) => { setFmt(e.target.value); setPage(0); }} className="rounded-sm border border-input bg-card px-2 font-mono text-xs" data-testid="select-format">
          <option value="">All formats</option>
          {formats.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      {rows.length === 0 ? <Empty title="No matching files" hint="Adjust search or format filter." /> : (
        <>
          <div className="overflow-x-auto rounded-sm border border-border bg-card">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-muted font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-3 py-2">Path</th><th className="px-3 py-2">Format</th><th className="px-3 py-2">MIME</th><th className="px-3 py-2 text-right">Size</th><th className="px-3 py-2">Status</th><th className="px-3 py-2" /></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {view.map((f) => {
                  const depth = (f.path.match(/\//g) || []).length;
                  return (
                    <tr key={f.id} className="hover:bg-muted/40" data-testid={`row-file-${f.id}`}>
                      <td className="px-3 py-1.5 font-mono"><span className="text-muted-foreground">{'· '.repeat(Math.min(depth, 6))}</span>{f.path}</td>
                      <td className="px-3 py-1.5 font-mono">{f.format}</td>
                      <td className="px-3 py-1.5 font-mono text-muted-foreground">{f.mimeType}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono tabular-nums">{fmtBytes(f.size).split('  ')[0]}</td>
                      <td className="px-3 py-1.5">{f.status}</td>
                      <td className="px-3 py-1.5">{f.webViewLink && <a href={f.webViewLink} target="_blank" rel="noreferrer" className="text-primary" data-testid={`link-file-${f.id}`}><ExternalLink className="h-3.5 w-3.5" /></a>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager page={page} pages={pages} setPage={setPage} total={rows.length} />
        </>
      )}
    </>
  );
}

export default function Inventory() {
  return <WithCatalog>{(c) => <Inner c={c} />}</WithCatalog>;
}
