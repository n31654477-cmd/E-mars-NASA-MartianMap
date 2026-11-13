import { useMemo, useState } from 'react';
import { Link, useParams } from 'wouter';
import { ArrowLeft, Download, ExternalLink } from 'lucide-react';
import { PageHead, WithCatalog, SearchBox, Btn, LinkBtn, Empty, Cite } from '@/components/kit';
import { dataUrl, downloadJson, type Catalog } from '@/lib/catalog';

function snippet(text: string, t: string) {
  const i = text.toLowerCase().indexOf(t);
  if (i < 0) return text.slice(0, 160);
  const s = Math.max(0, i - 70);
  return (
    <>
      {s > 0 && '…'}{text.slice(s, i)}<mark className="bg-chart-3/40 text-foreground">{text.slice(i, i + t.length)}</mark>{text.slice(i + t.length, i + t.length + 90)}…
    </>
  );
}

function Index({ c }: { c: Catalog }) {
  const [q, setQ] = useState('');
  const t = q.trim().toLowerCase();
  const hits = useMemo(() => {
    if (t.length < 2) return [];
    const out: { d: number; name: string; page: number; text: string }[] = [];
    c.documents.forEach((d, di) => d.pages.forEach((p) => { if (p.text.toLowerCase().includes(t)) out.push({ d: di, name: d.name, page: p.page, text: p.text }); }));
    return out;
  }, [c, t]);
  return (
    <>
      <PageHead eyebrow="Documents / full extracted text" title="PDF documents" />
      <div className="mb-5"><SearchBox value={q} onChange={setQ} placeholder="Search every page of every PDF" testId="input-search-documents" /></div>
      {t.length >= 2 ? (
        <div>
          <div className="eyebrow mb-2">{hits.length} page hits</div>
          {hits.length === 0 ? <Empty title="No pages match" /> : (
            <div className="divide-y divide-border border-y border-border">
              {hits.slice(0, 300).map((h, i) => (
                <Link key={i} href={`/documents/${h.d}?page=${h.page}`} className="block py-2.5 hover:bg-muted/40" data-testid={`link-hit-${i}`}>
                  <Cite file={h.name} loc={`p. ${h.page}`} />
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{snippet(h.text, t)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : c.documents.length === 0 ? <Empty title="No PDF documents in catalog" /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {c.documents.map((d, i) => (
            <Link key={d.name} href={`/documents/${i}`} className="group rounded-sm border border-border bg-card p-4 transition-colors hover:border-primary" data-testid={`card-doc-${i}`}>
              <div className="font-medium group-hover:text-primary">{d.name}</div>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">{d.pageCount} pages · {d.pages.length} text pages extracted</div>
              <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{d.pages[0]?.text}</p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function Reader({ c, idx }: { c: Catalog; idx: number }) {
  const d = c.documents[idx];
  const init = Number(new URLSearchParams(window.location.search).get('page')) || 1;
  const [page, setPage] = useState(init);
  const [img, setImg] = useState(false);
  if (!d) return <Empty title="Document not found" />;
  const p = d.pages.find((x) => x.page === page) ?? d.pages[0];
  const pageNums = d.pages.map((x) => x.page);
  const pos = pageNums.indexOf(p?.page ?? 1);
  return (
    <>
      <Link href="/documents" className="mb-4 inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-primary" data-testid="link-back-documents"><ArrowLeft className="h-3 w-3" />documents</Link>
      <PageHead eyebrow={`PDF · ${d.pageCount} pages`} title={d.name}>
        <Btn onClick={() => downloadJson(`${d.name}.pages.json`, d)} data-testid="button-download-doc-text"><Download className="h-3.5 w-3.5" />All page text JSON</Btn>
        {d.sourceUrl && <LinkBtn href={d.sourceUrl} target="_blank" rel="noreferrer" data-testid="link-doc-source"><ExternalLink className="h-3.5 w-3.5" />Original PDF</LinkBtn>}
      </PageHead>
      {d.notes.length > 0 && <ul className="mb-5 list-disc rounded-sm border-l-2 border-chart-3 bg-muted/40 py-2 pl-8 pr-3 text-xs">{d.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
      <div className="grid gap-5 lg:grid-cols-[120px_1fr]">
        <div className="flex gap-1 overflow-x-auto lg:max-h-[75vh] lg:flex-col lg:overflow-y-auto">
          {pageNums.map((n) => (
            <button key={n} onClick={() => setPage(n)} className={`shrink-0 rounded-sm border px-2 py-1 text-left font-mono text-[11px] ${n === p?.page ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary'}`} data-testid={`button-page-${n}`}>p. {n}</button>
          ))}
        </div>
        {p ? (
          <article className="rise min-w-0" key={p.page}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <Cite file={d.name} loc={`p. ${p.page} of ${d.pageCount}`} href={d.sourceUrl} />
              <div className="flex gap-1">
                {p.imageUrl && <Btn onClick={() => setImg(!img)} data-testid="button-toggle-image">{img ? 'Hide' : 'Show'} page image</Btn>}
                <Btn onClick={() => setPage(pageNums[pos - 1])} disabled={pos <= 0} data-testid="button-prev-page">Prev</Btn>
                <Btn onClick={() => setPage(pageNums[pos + 1])} disabled={pos >= pageNums.length - 1} data-testid="button-next-page">Next</Btn>
              </div>
            </div>
            {img && p.imageUrl && <img src={dataUrl(p.imageUrl)} alt={`${d.name} page ${p.page}`} className="mb-4 w-full rounded-sm border border-border" />}
            <pre className="whitespace-pre-wrap break-words rounded-sm border border-border bg-card p-5 font-mono text-[12px] leading-relaxed" data-testid="text-page-content">{p.text || '(no extractable text on this page)'}</pre>
          </article>
        ) : <Empty title="No pages extracted" />}
      </div>
    </>
  );
}

export function DocumentsIndex() {
  return <WithCatalog>{(c) => <Index c={c} />}</WithCatalog>;
}
export function DocumentReader() {
  const p = useParams<{ idx: string }>();
  return <WithCatalog>{(c) => <Reader c={c} idx={Number(p.idx)} />}</WithCatalog>;
}
