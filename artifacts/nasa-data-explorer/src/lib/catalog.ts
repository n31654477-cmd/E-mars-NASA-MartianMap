import { useQuery } from '@tanstack/react-query';

export type InventoryItem = { id: string; name: string; path: string; mimeType: string; size?: number | string; webViewLink: string; format: string; status: string };
export type Layer = { id: string; name: string; source: string; sourceUrl: string; format: string; count: number; geometryType: string; crs: string; units: string; fields: { name: string; type: string }[]; extent: unknown[]; recordsUrl: string; geometryUrl?: string; notes: string[]; sample: Record<string, unknown>[] };
export type DocPage = { page: number; text: string; imageUrl?: string };
export type Doc = { name: string; sourceUrl: string; pageCount: number; pages: DocPage[]; notes: string[] };
export type Raster = { name: string; source: string; sourceUrl: string; metadata: Record<string, unknown>; notes: string[] };
export type MetaText = { name: string; sourceUrl: string; text: string };
export type Issue = { severity: string; source: string; locator: string; message: string };
export type Catalog = {
  title: string; description: string; folderUrl: string;
  inventory: InventoryItem[]; layers: Layer[]; documents: Doc[]; rasters: Raster[]; metadata: MetaText[]; issues: Issue[]; methods: string[];
  summary: { fileCount: number; folderCount: number; totalBytes: number; layerCount: number; recordCount: number; pdfPages: number };
};
export type RecordRow = { _source: { filename: string; layer: string; featureId: string | number }; [k: string]: unknown };

export const dataUrl = (p: string) => {
  if (!p) return p;
  if (/^https?:\/\//.test(p)) return p;
  return import.meta.env.BASE_URL + p.replace(/^\/+/, '');
};
export const CATALOG_URL = dataUrl('data/catalog.json');

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} while loading ${url}`);
  return r.json();
}

function normalize(c: Partial<Catalog>): Catalog {
  return {
    title: c.title ?? '', description: c.description ?? '', folderUrl: c.folderUrl ?? '',
    inventory: c.inventory ?? [], layers: c.layers ?? [], documents: c.documents ?? [], rasters: c.rasters ?? [],
    metadata: c.metadata ?? [], issues: c.issues ?? [], methods: c.methods ?? [],
    summary: c.summary ?? { fileCount: 0, folderCount: 0, totalBytes: 0, layerCount: 0, recordCount: 0, pdfPages: 0 },
  };
}

export function useCatalog() {
  return useQuery({ queryKey: ['catalog'], queryFn: async () => normalize(await getJson<Partial<Catalog>>(CATALOG_URL)), staleTime: Infinity, retry: 1 });
}

export function useRecords(url?: string) {
  return useQuery({ queryKey: ['records', url], queryFn: () => getJson<RecordRow[]>(dataUrl(url!)), enabled: !!url, staleTime: Infinity, retry: 1 });
}

export function fmtBytes(n?: number | string) {
  if (n === undefined || n === null || n === '') return '—';
  const v = Number(n);
  if (!isFinite(v)) return String(n);
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, x = v;
  while (x >= 1024 && i < u.length - 1) { x /= 1024; i++; }
  return `${i === 0 ? x : x.toFixed(2)} ${u[i]}  (${v.toLocaleString()} B)`;
}

export function display(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export const slug = (s: string) => encodeURIComponent(s);
