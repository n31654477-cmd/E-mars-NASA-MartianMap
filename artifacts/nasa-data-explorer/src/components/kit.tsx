import { type ReactNode } from 'react';
import { AlertTriangle, ExternalLink, RotateCw, Search } from 'lucide-react';
import { useCatalog, type Catalog } from '@/lib/catalog';
import { cn } from '@/lib/utils';

export function PageHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <header className="rise mb-6 border-b border-border pb-5">
      <div className="eyebrow mb-2">{eyebrow}</div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-4xl leading-none md:text-5xl" data-testid="text-page-title">{title}</h1>
        {children && <div className="flex flex-wrap gap-2">{children}</div>}
      </div>
    </header>
  );
}

export function Cite({ file, loc, href }: { file: string; loc?: string; href?: string }) {
  const body = (
    <>
      <span className="text-primary">src</span> {file}
      {loc ? <span className="text-muted-foreground"> · {loc}</span> : null}
    </>
  );
  const cls = 'inline-flex max-w-full items-center gap-1 truncate rounded-sm border border-dashed border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10.5px]';
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={cn(cls, 'hover:border-primary')} data-testid="link-citation">
      {body}<ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
    </a>
  ) : <span className={cls}>{body}</span>;
}

export function Btn({ children, className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...p} className={cn('inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40', className)}>{children}</button>;
}
export function LinkBtn({ children, className, ...p }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...p} className={cn('inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-primary hover:text-primary', className)}>{children}</a>;
}

export function SearchBox({ value, onChange, placeholder, testId }: { value: string; onChange: (v: string) => void; placeholder: string; testId: string }) {
  return (
    <label className="flex min-w-0 flex-1 items-center gap-2 rounded-sm border border-input bg-card px-2.5 py-1.5 focus-within:border-primary">
      <Search className="h-3.5 w-3.5 text-muted-foreground" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground" data-testid={testId} />
    </label>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-sm border border-dashed border-border bg-card/50 px-6 py-10 text-center">
      <div className="strata mx-auto mb-4 h-2.5 w-16 opacity-60" />
      <div className="display text-2xl">{title}</div>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SkeletonBlock({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-7 animate-pulse rounded-sm bg-muted" style={{ opacity: 1 - i * 0.1 }} />)}
    </div>
  );
}

export function ErrorPanel({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-5" data-testid="status-error">
      <div className="flex items-center gap-2 font-medium text-destructive"><AlertTriangle className="h-4 w-4" />Could not load data</div>
      <p className="mt-1 font-mono text-xs text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
      <p className="mt-1 text-xs text-muted-foreground">The extracted catalog may still be in preparation.</p>
      {onRetry && <Btn className="mt-3" onClick={onRetry} data-testid="button-retry"><RotateCw className="h-3.5 w-3.5" />Retry</Btn>}
    </div>
  );
}

export function WithCatalog({ children }: { children: (c: Catalog) => ReactNode }) {
  const q = useCatalog();
  if (q.isLoading) return <SkeletonBlock rows={10} />;
  if (q.error || !q.data) return <ErrorPanel error={q.error ?? 'Empty catalog'} onRetry={() => q.refetch()} />;
  return <>{children(q.data)}</>;
}

export function Pager({ page, pages, setPage, total }: { page: number; pages: number; setPage: (n: number) => void; total: number }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2 font-mono text-[11px] text-muted-foreground">
      <span data-testid="text-result-count">{total.toLocaleString()} rows</span>
      <div className="flex items-center gap-1">
        <Btn onClick={() => setPage(0)} disabled={page === 0} data-testid="button-first">First</Btn>
        <Btn onClick={() => setPage(page - 1)} disabled={page === 0} data-testid="button-prev">Prev</Btn>
        <span className="px-2">{pages ? page + 1 : 0} / {pages}</span>
        <Btn onClick={() => setPage(page + 1)} disabled={page >= pages - 1} data-testid="button-next">Next</Btn>
        <Btn onClick={() => setPage(pages - 1)} disabled={page >= pages - 1} data-testid="button-last">Last</Btn>
      </div>
    </div>
  );
}

export function Pre({ children }: { children: ReactNode }) {
  return <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-sm border border-border bg-muted/50 p-3 font-mono text-[11px] leading-relaxed">{children}</pre>;
}

export function Sev({ s }: { s: string }) {
  const l = s.toLowerCase();
  const c = /err|high|crit/.test(l) ? 'bg-destructive text-destructive-foreground' : /warn|med/.test(l) ? 'bg-chart-3 text-foreground' : 'bg-secondary text-secondary-foreground';
  return <span className={cn('rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider', c)}>{s}</span>;
}
