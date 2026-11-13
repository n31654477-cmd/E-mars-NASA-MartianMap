import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { AlertTriangle, BookOpen, Database, FileText, FolderTree, Grid3x3, Layers, Menu, ScrollText, X, Download, Package } from 'lucide-react';
import { CATALOG_URL, useCatalog } from '@/lib/catalog';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Overview', icon: Grid3x3, k: '' },
  { href: '/inventory', label: 'File inventory', icon: FolderTree, k: 'inv' },
  { href: '/layers', label: 'Layers', icon: Layers, k: 'lay' },
  { href: '/documents', label: 'Documents', icon: FileText, k: 'doc' },
  { href: '/rasters', label: 'Raster metadata', icon: Database, k: 'ras' },
  { href: '/metadata', label: 'Source metadata', icon: ScrollText, k: 'met' },
  { href: '/issues', label: 'Ambiguities & methods', icon: AlertTriangle, k: 'iss' },
  { href: '/exports', label: 'Exports', icon: Package, k: '' },
];

export function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const [open, setOpen] = useState(false);
  const { data } = useCatalog();
  const counts: Record<string, number | undefined> = data ? { inv: data.inventory.length, lay: data.layers.length, doc: data.documents.length, ras: data.rasters.length, met: data.metadata.length, iss: data.issues.length } : {};

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((n) => {
        const active = n.href === '/' ? loc === '/' : loc.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} onClick={() => setOpen(false)} data-testid={`link-nav-${n.label.toLowerCase().replace(/\W+/g, '-')}`}
            className={cn('group flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-[13px] transition-colors', active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/70 hover:text-sidebar-foreground')}>
            <span className={cn('h-4 w-0.5 rounded-full transition-colors', active ? 'bg-sidebar-primary' : 'bg-transparent')} />
            <n.icon className="h-3.5 w-3.5" />
            <span className="flex-1">{n.label}</span>
            {n.k && counts[n.k] !== undefined && <span className="font-mono text-[10px] opacity-60">{counts[n.k]}</span>}
          </Link>
        );
      })}
    </nav>
  );

  const side = (
    <div className="flex h-full flex-col gap-6 p-4">
      <div>
        <div className="strata mb-3 h-2.5 w-10" />
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/50">Archive workbench</div>
        <div className="display text-2xl leading-tight text-sidebar-foreground">SIM 3292</div>
        <div className="mt-1 line-clamp-2 text-[11px] text-sidebar-foreground/60">{data?.title || 'Mars source archive'}</div>
      </div>
      {nav}
      <div className="mt-auto space-y-2 border-t border-sidebar-border pt-4">
        <a href={CATALOG_URL} download className="flex items-center gap-2 font-mono text-[11px] text-sidebar-foreground/70 hover:text-sidebar-primary" data-testid="link-download-catalog"><Download className="h-3 w-3" />catalog.json</a>
        {data?.folderUrl && <a href={data.folderUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-mono text-[11px] text-sidebar-foreground/70 hover:text-sidebar-primary" data-testid="link-source-folder"><BookOpen className="h-3 w-3" />source folder</a>}
        <p className="text-[10px] leading-snug text-sidebar-foreground/40">Independent research view of extracted source files. Not an official NASA or USGS site.</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[100dvh]">
      <aside className="sticky top-0 hidden h-[100dvh] w-60 shrink-0 bg-sidebar lg:block">{side}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-sidebar">{side}</aside>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-2.5 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(!open)} data-testid="button-menu">{open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</button>
          <span className="display text-lg">SIM 3292</span>
        </div>
        <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-10">{children}</main>
      </div>
    </div>
  );
}
