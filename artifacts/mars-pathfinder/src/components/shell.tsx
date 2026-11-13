import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { AlertTriangle, RotateCw, ExternalLink } from 'lucide-react';

const NAV = [
  { href: '/', label: 'Map' },
  { href: '/lab', label: 'Algorithm lab' },
  { href: '/methods', label: 'Methods & limits' },
];

export function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="border-b bg-sidebar/80 backdrop-blur sticky top-0 z-40">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 md:px-6 py-3">
          <Link href="/" className="flex items-baseline gap-2" data-testid="link-home">
            <span className="font-display text-xl text-primary">Mars</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Surface Analysis · MARS:2000</span>
          </Link>
          <nav className="flex gap-1 text-sm">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} data-testid={`link-nav-${n.label.split(' ')[0].toLowerCase()}`}
                className={`px-3 py-1.5 rounded-md transition-colors ${loc === n.href ? 'bg-primary text-primary-foreground' : 'hover:bg-sidebar-accent'}`}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex gap-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {/* Intentionally cross-artifact absolute links */}
            <a href="/" data-testid="link-source-explorer" className="hover:text-primary inline-flex items-center gap-1">Source explorer <ExternalLink className="h-3 w-3" /></a>
            <a href="/exports" data-testid="link-exports" className="hover:text-primary inline-flex items-center gap-1">Downloads <ExternalLink className="h-3 w-3" /></a>
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}

export function ErrorPanel({ title, error, onRetry }: { title: string; error: unknown; onRetry: () => void }) {
  const msg = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm" data-testid="status-error">
      <div className="flex items-center gap-2 font-medium text-destructive"><AlertTriangle className="h-4 w-4" />{title}</div>
      <p className="mt-1 font-mono text-xs text-muted-foreground break-words">{msg}</p>
      <button onClick={onRetry} data-testid="button-retry" className="mt-3 inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs hover:bg-muted">
        <RotateCw className="h-3 w-3" /> Retry
      </button>
    </div>
  );
}

export function Unknown({ label = 'unknown' }: { label?: string }) {
  return <span className="hatch rounded px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground border border-dashed">{label}</span>;
}

export function Sk({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}
