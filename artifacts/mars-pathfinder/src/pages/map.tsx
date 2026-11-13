import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import OLMap from 'ol/Map';
import View from 'ol/View';
import ImageLayer from 'ol/layer/Image';
import Static from 'ol/source/ImageStatic';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import Polygon from 'ol/geom/Polygon';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import type { FeatureLike } from 'ol/Feature';
import {
  useGetMarsSummary, useGetMarsFeatures, useInspectMarsLocation, useGenerateMarsGrid, useAssessMarsRoute,
  getInspectMarsLocationQueryKey, MarsRouteInputAlgorithm,
} from '@workspace/api-client-react';
import type { MarsFeatureCollection, MarsRouteInputAlgorithm as RouteAlg } from '@workspace/api-client-react';
import { Crosshair, Flag, MapPin, Maximize, Minus, Plus, Grid3x3, Route as RouteIcon, X } from 'lucide-react';
import { marsProjection, MARS_EXTENT, unitColor } from '@/lib/mars-proj';
import { ErrorPanel, Sk, Unknown } from '@/components/shell';

type LayerId = 'layer-02' | 'layer-03' | 'layer-04' | 'layer-05';
const LAYERS: { id: LayerId; label: string }[] = [
  { id: 'layer-03', label: 'Geologic units' },
  { id: 'layer-02', label: 'Contacts' },
  { id: 'layer-05', label: 'Structures' },
  { id: 'layer-04', label: 'Landing sites' },
];
type Pt = { lat: number; lng: number };
type Mode = 'inspect' | 'start' | 'end';

function unitOf(f: FeatureLike): string { return String(f.get('Unit') ?? f.get('UnitDesc') ?? 'unlabelled'); }

const styles: Record<LayerId, (f: FeatureLike) => Style> = {
  'layer-03': (f) => { const c = unitColor(unitOf(f)); return new Style({ fill: new Fill({ color: c + '99' }), stroke: new Stroke({ color: c, width: 0.5 }) }); },
  'layer-02': () => new Style({ stroke: new Stroke({ color: '#2a2f3a', width: 0.8 }) }),
  'layer-05': () => new Style({ stroke: new Stroke({ color: '#3f5f7a', width: 1, lineDash: [4, 3] }) }),
  'layer-04': (f) => new Style({
    image: new CircleStyle({ radius: 5, fill: new Fill({ color: '#f6efe2' }), stroke: new Stroke({ color: '#a8432a', width: 2 }) }),
    text: new Text({ text: String(f.get('NAME') ?? ''), offsetY: -12, font: '500 11px IBM Plex Sans', fill: new Fill({ color: '#1f2633' }), stroke: new Stroke({ color: '#f6efe2', width: 3 }) }),
  }),
};

export default function MapPage() {
  const summary = useGetMarsSummary();
  const f02 = useGetMarsFeatures('layer-02');
  const f03 = useGetMarsFeatures('layer-03');
  const f04 = useGetMarsFeatures('layer-04');
  const f05 = useGetMarsFeatures('layer-05');
  const featureQ: Record<LayerId, typeof f02> = { 'layer-02': f02, 'layer-03': f03, 'layer-04': f04, 'layer-05': f05 };

  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<OLMap | null>(null);
  const vec = useRef<Record<string, VectorLayer<VectorSource>>>({});
  const hillRef = useRef<ImageLayer<Static> | null>(null);
  const markSrc = useRef(new VectorSource());
  const gridSrc = useRef(new VectorSource());

  const [visible, setVisible] = useState<Record<string, boolean>>({ 'layer-02': true, 'layer-03': true, 'layer-04': true, 'layer-05': true, hill: true, grid: true });
  const [mode, setMode] = useState<Mode>('inspect');
  const modeRef = useRef(mode); modeRef.current = mode;
  const [probe, setProbe] = useState<Pt | null>(null);
  const [start, setStart] = useState<Pt | null>(null);
  const [end, setEnd] = useState<Pt | null>(null);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [hillFailed, setHillFailed] = useState(false);
  const [gridForm, setGridForm] = useState({ startLat: -10, endLat: 10, startLng: -20, endLng: 20, rows: 20, columns: 20 });
  const [routeAlg, setRouteAlg] = useState<RouteAlg>('astar');

  const params = { latitude: probe?.lat ?? 0, longitude: probe?.lng ?? 0 };
  const inspect = useInspectMarsLocation(params, { query: { enabled: !!probe, queryKey: getInspectMarsLocationQueryKey(params) } });
  const grid = useGenerateMarsGrid();
  const route = useAssessMarsRoute();

  // Build map once
  useEffect(() => {
    if (!mapEl.current) return;
    const proj = marsProjection();
    const hill = new ImageLayer({
      source: new Static({ url: import.meta.env.BASE_URL + 'data/hillshade.png', projection: proj, imageExtent: MARS_EXTENT }),
      opacity: 0.9,
    });
    hill.getSource()?.on('imageloaderror', () => setHillFailed(true));
    hillRef.current = hill;
    const order: LayerId[] = ['layer-03', 'layer-02', 'layer-05', 'layer-04'];
    order.forEach((id) => { vec.current[id] = new VectorLayer({ source: new VectorSource(), style: styles[id], opacity: id === 'layer-03' ? 0.75 : 1 }); });
    vec.current.grid = new VectorLayer({ source: gridSrc.current, style: (f) => new Style({
      fill: new Fill({ color: f.get('known') ? 'rgba(95,143,154,.25)' : 'rgba(80,80,90,.10)' }),
      stroke: new Stroke({ color: 'rgba(31,38,51,.35)', width: 0.5, lineDash: f.get('known') ? undefined : [2, 2] }),
    }) });
    const marks = new VectorLayer({ source: markSrc.current, style: (f) => new Style({
      image: new CircleStyle({ radius: 7, fill: new Fill({ color: f.get('kind') === 'probe' ? '#1f2633' : f.get('kind') === 'start' ? '#2f7a6a' : '#a8432a' }), stroke: new Stroke({ color: '#f6efe2', width: 2 }) }),
    }) });
    const map = new OLMap({
      target: mapEl.current,
      layers: [hill, ...order.map((id) => vec.current[id]), vec.current.grid, marks],
      view: new View({ projection: proj, center: [0, 0], zoom: 2, extent: MARS_EXTENT, showFullExtent: true, constrainOnlyCenter: true }),
      controls: [],
    });
    map.getView().fit(MARS_EXTENT);
    map.on('singleclick', (e) => {
      const [lng, lat] = e.coordinate;
      const p = { lat: +lat.toFixed(4), lng: +lng.toFixed(4) };
      if (modeRef.current === 'start') setStart(p); else if (modeRef.current === 'end') setEnd(p); else setProbe(p);
      if (modeRef.current !== 'inspect') setMode('inspect');
    });
    map.on('pointermove', (e) => setCursor({ lng: e.coordinate[0], lat: e.coordinate[1] }));
    mapRef.current = map;
    return () => { map.setTarget(undefined); mapRef.current = null; };
  }, []);

  // Load features
  const datas = [f02.data, f03.data, f04.data, f05.data];
  useEffect(() => {
    const fmt = new GeoJSON();
    (['layer-02', 'layer-03', 'layer-04', 'layer-05'] as LayerId[]).forEach((id, i) => {
      const d = datas[i] as MarsFeatureCollection | undefined; const src = vec.current[id]?.getSource();
      if (!d || !src) return;
      src.clear();
      src.addFeatures(fmt.readFeatures(d, { dataProjection: 'MARS:2000', featureProjection: 'MARS:2000' }) as Feature[]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, datas);

  useEffect(() => {
    Object.entries(vec.current).forEach(([k, l]) => l.setVisible(visible[k] ?? true));
    hillRef.current?.setVisible(visible.hill);
  }, [visible]);

  useEffect(() => {
    markSrc.current.clear();
    ([['probe', probe], ['start', start], ['end', end]] as const).forEach(([kind, p]) => {
      if (!p) return; const f = new Feature(new Point([p.lng, p.lat])); f.set('kind', kind); markSrc.current.addFeature(f);
    });
  }, [probe, start, end]);

  useEffect(() => {
    gridSrc.current.clear();
    grid.data?.cells.forEach((c) => {
      const w = c.width / 2, h = c.height / 2;
      const f = new Feature(new Polygon([[[c.centerLng - w, c.centerLat - h], [c.centerLng + w, c.centerLat - h], [c.centerLng + w, c.centerLat + h], [c.centerLng - w, c.centerLat + h], [c.centerLng - w, c.centerLat - h]]]));
      f.set('known', c.safetyScore !== null); gridSrc.current.addFeature(f);
    });
  }, [grid.data]);

  const zoom = (d: number) => { const v = mapRef.current?.getView(); if (v) v.animate({ zoom: (v.getZoom() ?? 2) + d, duration: 200 }); };
  const reset = () => mapRef.current?.getView().fit(MARS_EXTENT, { duration: 300 });

  const units = useMemo(() => {
    const m = new Map<string, string>();
    (f03.data?.features ?? []).forEach((f) => { const p = (f as { properties?: Record<string, unknown> }).properties ?? {}; const u = String(p.Unit ?? 'unlabelled'); if (!m.has(u)) m.set(u, String(p.UnitDesc ?? '')); });
    return [...m.entries()].sort();
  }, [f03.data]);

  const missingRoute = [!start && 'start point', !end && 'end point'].filter(Boolean) as string[];
  const gridValid = gridForm.rows >= 1 && gridForm.rows <= 80 && gridForm.columns >= 1 && gridForm.columns <= 80 && gridForm.startLat >= -90 && gridForm.endLat <= 90 && gridForm.startLng >= -180 && gridForm.endLng <= 180;
  const layerMeta = (id: string) => summary.data?.layers.find((l) => l.id === id);

  return (
    <div className="flex-1 grid lg:grid-cols-[300px_1fr_360px] min-h-0">
      {/* Left: layers + controls */}
      <aside className="border-r bg-sidebar/60 p-4 space-y-6 overflow-y-auto lg:max-h-[calc(100dvh-57px)]">
        {summary.isError && <ErrorPanel title="Data unavailable: summary" error={summary.error} onRetry={() => summary.refetch()} />}
        <section>
          <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Rendered layers</h2>
          <div className="space-y-1">
            <Toggle id="hill" label="Hillshade (derived reprojection)" on={visible.hill} set={setVisible} note={hillFailed ? 'image failed to load' : undefined} />
            {LAYERS.map((l) => {
              const q = featureQ[l.id];
              return (
                <div key={l.id}>
                  <Toggle id={l.id} label={`${l.label}`} on={visible[l.id]} set={setVisible}
                    note={q.isLoading ? 'loading…' : q.data ? `${q.data.features.length} features · ${l.id}` : undefined} />
                  {q.isError && <div className="ml-6 mt-1"><ErrorPanel title={`${l.id} unavailable`} error={q.error} onRetry={() => q.refetch()} /></div>}
                  {layerMeta(l.id) && <a href={layerMeta(l.id)!.sourceUrl} target="_blank" rel="noreferrer" className="ml-6 block font-mono text-[10px] text-muted-foreground hover:text-primary truncate">{layerMeta(l.id)!.filename}</a>}
                </div>);
            })}
            <Toggle id="grid" label="Generated grid" on={visible.grid} set={setVisible} />
          </div>
        </section>
        <section>
          <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Geographic grid</h2>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(gridForm) as (keyof typeof gridForm)[]).map((k) => (
              <label key={k} className="text-[11px] font-mono text-muted-foreground">{k}
                <input type="number" value={gridForm[k]} data-testid={`input-grid-${k}`}
                  min={k === 'rows' || k === 'columns' ? 1 : undefined} max={k === 'rows' || k === 'columns' ? 80 : undefined}
                  onChange={(e) => setGridForm((g) => ({ ...g, [k]: Number(e.target.value) }))}
                  className="mt-0.5 w-full rounded border bg-card px-2 py-1 text-sm text-foreground" />
              </label>))}
          </div>
          {!gridValid && <p className="mt-2 text-xs text-destructive">Rows/columns 1–80; lat ±90; lng ±180.</p>}
          <button disabled={!gridValid || grid.isPending} onClick={() => grid.mutate({ data: gridForm })} data-testid="button-generate-grid"
            className="mt-3 w-full inline-flex justify-center items-center gap-2 rounded-md bg-secondary text-secondary-foreground py-1.5 text-sm disabled:opacity-50">
            <Grid3x3 className="h-4 w-4" />{grid.isPending ? 'Generating…' : 'Generate grid'}
          </button>
          {grid.isError && <div className="mt-2"><ErrorPanel title="Grid failed" error={grid.error} onRetry={() => grid.mutate({ data: gridForm })} /></div>}
          {grid.data && (
            <div className="mt-2 text-xs space-y-1" data-testid="text-grid-result">
              <p className="font-mono">{grid.data.rows}×{grid.data.columns} · {grid.data.cells.filter((c) => c.safetyScore === null).length} cells with unknown safety</p>
              <p className="text-muted-foreground">{grid.data.warning}</p>
            </div>)}
        </section>
        {units.length > 0 && (
          <section>
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Geologic units (categorical, not hazard)</h2>
            <ul className="space-y-1 max-h-64 overflow-y-auto pr-1">{units.map(([u, d]) => (
              <li key={u} className="flex gap-2 text-xs"><span className="h-3 w-3 mt-0.5 rounded-sm shrink-0" style={{ background: unitColor(u) }} /><span><b className="font-mono">{u}</b> <span className="text-muted-foreground">{d}</span></span></li>))}</ul>
          </section>)}
      </aside>

      {/* Center: map */}
      <section className="relative min-h-[60dvh] lg:min-h-0 bg-[hsl(30_20%_82%)]">
        <div ref={mapEl} className="absolute inset-0" data-testid="map-mars" />
        <div className="absolute top-3 left-3 flex flex-col gap-1">
          <MapBtn onClick={() => zoom(1)} label="zoom-in"><Plus className="h-4 w-4" /></MapBtn>
          <MapBtn onClick={() => zoom(-1)} label="zoom-out"><Minus className="h-4 w-4" /></MapBtn>
          <MapBtn onClick={reset} label="reset"><Maximize className="h-4 w-4" /></MapBtn>
        </div>
        <div className="absolute top-3 right-3 flex rounded-md border bg-card/95 shadow-sm overflow-hidden text-xs">
          {([['inspect', Crosshair, 'Inspect'], ['start', MapPin, 'Set start'], ['end', Flag, 'Set end']] as const).map(([m, Icon, l]) => (
            <button key={m} onClick={() => setMode(m)} data-testid={`button-mode-${m}`}
              className={`px-3 py-1.5 inline-flex items-center gap-1.5 ${mode === m ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}><Icon className="h-3.5 w-3.5" />{l}</button>))}
        </div>
        {(f03.isLoading || f02.isLoading) && <div className="absolute inset-x-0 top-0 h-0.5 bg-primary/60 animate-pulse" />}
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap justify-between gap-2 font-mono text-[11px] pointer-events-none">
          <span className="rounded bg-card/90 px-2 py-1">MARS:2000 · {cursor ? `${cursor.lat.toFixed(3)}°, ${cursor.lng.toFixed(3)}°` : '—'}</span>
          <span className="rounded bg-card/90 px-2 py-1">Source scale 1:20,000,000 · not for rover navigation</span>
        </div>
      </section>

      {/* Right: inspect + route */}
      <aside className="border-l bg-card/60 p-4 space-y-6 overflow-y-auto lg:max-h-[calc(100dvh-57px)]">
        <section>
          <h2 className="font-display text-xl">Location inspection</h2>
          {!probe && <p className="mt-2 text-sm text-muted-foreground">Click the map in Inspect mode. Every answer cites the source feature it came from.</p>}
          {probe && inspect.isLoading && <div className="mt-3 space-y-2"><Sk className="h-4 w-2/3" /><Sk className="h-24" /></div>}
          {probe && inspect.isError && <div className="mt-3"><ErrorPanel title="Inspection unavailable" error={inspect.error} onRetry={() => inspect.refetch()} /></div>}
          {inspect.data && probe && (
            <div className="rise mt-3 space-y-3 text-sm" data-testid="panel-inspection">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs">{inspect.data.latitude.toFixed(4)}°, {inspect.data.longitude.toFixed(4)}°</span>
                <button onClick={() => setProbe(null)} data-testid="button-clear-probe" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
              <p><span className="font-mono text-[11px] uppercase text-muted-foreground">status</span> {inspect.data.status}</p>
              <p className="border-l-2 border-chart-3 pl-3 text-xs">{inspect.data.warning}</p>
              <div className="flex flex-wrap gap-1">{inspect.data.missingMeasurements.map((m) => <Unknown key={m} label={`${m}: unknown`} />)}</div>
              {inspect.data.evidence.length === 0 && <p className="text-xs text-muted-foreground">No source feature intersects this point.</p>}
              {inspect.data.evidence.map((ev, i) => (
                <div key={i} className="rounded-md border bg-card p-3" data-testid={`card-evidence-${i}`}>
                  <div className="flex justify-between text-xs"><b>{ev.layer}</b><span className="font-mono text-muted-foreground">{ev.layerId} #{ev.featureId}</span></div>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                    {Object.entries(ev.properties).map(([k, v]) => (
                      <Fragment key={k}><dt className="font-mono text-muted-foreground">{k}</dt><dd className="break-words">{v === null || v === undefined || v === '' ? <Unknown /> : typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd></Fragment>))}
                  </dl>
                  <a href={ev.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 block font-mono text-[10px] text-primary break-all">{ev.filename}</a>
                </div>))}
            </div>)}
        </section>
        <section className="border-t pt-5">
          <h2 className="font-display text-xl">Route eligibility</h2>
          <div className="mt-3 space-y-1.5 text-xs font-mono">
            <p>start: {start ? `${start.lat}°, ${start.lng}°` : <Unknown label="not set" />} {start && <button onClick={() => setStart(null)} className="text-muted-foreground underline" data-testid="button-clear-start">clear</button>}</p>
            <p>end: {end ? `${end.lat}°, ${end.lng}°` : <Unknown label="not set" />} {end && <button onClick={() => setEnd(null)} className="text-muted-foreground underline" data-testid="button-clear-end">clear</button>}</p>
          </div>
          <div className="mt-3 flex gap-1">{Object.values(MarsRouteInputAlgorithm).map((a) => (
            <button key={a} onClick={() => setRouteAlg(a)} data-testid={`button-route-alg-${a}`} className={`px-2.5 py-1 rounded border font-mono text-xs ${routeAlg === a ? 'bg-secondary' : 'hover:bg-muted'}`}>{a}</button>))}</div>
          {missingRoute.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Missing inputs: {missingRoute.join(', ')}. Use Set start / Set end on the map.</p>}
          <button disabled={missingRoute.length > 0 || route.isPending} data-testid="button-assess-route"
            onClick={() => start && end && route.mutate({ data: { algorithm: routeAlg, startLat: start.lat, startLng: start.lng, endLat: end.lat, endLng: end.lng } })}
            className="mt-3 w-full inline-flex justify-center items-center gap-2 rounded-md bg-primary text-primary-foreground py-2 text-sm disabled:opacity-50">
            <RouteIcon className="h-4 w-4" />{route.isPending ? 'Assessing…' : 'Assess scientific route eligibility'}
          </button>
          {route.isError && <div className="mt-2"><ErrorPanel title="Assessment failed" error={route.error} onRetry={() => route.reset()} /></div>}
          {route.data && (
            <div className="rise mt-3 rounded-md border-2 border-dashed p-3 text-sm" data-testid="panel-route-status">
              <p className="font-medium">{route.data.available ? 'Routing available' : 'Routing unavailable'}</p>
              <p className="mt-1 text-xs text-muted-foreground">{route.data.reason}</p>
              <div className="mt-2 flex flex-wrap gap-1">{route.data.missingMeasurements.map((m) => <Unknown key={m} label={`${m}: missing`} />)}</div>
            </div>)}
          {summary.data && !summary.data.scientificRoutingAvailable && !route.data && <p className="mt-3 text-xs text-muted-foreground">{summary.data.limitation}</p>}
        </section>
        {summary.data && (
          <section className="border-t pt-5 text-xs">
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Inventory · {summary.data.layers.length} layers</h2>
            <ul className="space-y-0.5">{summary.data.layers.map((l) => (
              <li key={l.id} className="flex justify-between gap-2"><span className="truncate">{l.id} {l.name}</span><span className={l.displayAvailable ? 'text-chart-2' : 'text-muted-foreground'}>{l.displayAvailable ? 'shown' : 'not rendered'}</span></li>))}</ul>
          </section>)}
        {summary.isLoading && <Sk className="h-32" />}
      </aside>
    </div>
  );
}

function Toggle({ id, label, on, set, note }: { id: string; label: string; on: boolean; set: React.Dispatch<React.SetStateAction<Record<string, boolean>>>; note?: string }) {
  return (
    <label className="flex items-start gap-2 py-1 cursor-pointer text-sm" data-testid={`toggle-layer-${id}`}>
      <input type="checkbox" checked={on} onChange={() => set((v) => ({ ...v, [id]: !v[id] }))} className="mt-1 accent-[hsl(var(--primary))]" />
      <span>{label}{note && <span className="block font-mono text-[10px] text-muted-foreground">{note}</span>}</span>
    </label>
  );
}
function MapBtn({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return <button onClick={onClick} aria-label={label} data-testid={`button-${label}`} className="h-8 w-8 grid place-items-center rounded-md border bg-card/95 shadow-sm hover:bg-muted">{children}</button>;
}
