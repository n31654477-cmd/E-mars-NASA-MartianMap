import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import LineString from 'ol/geom/LineString';
import { RiskBreakdown } from '@/components/risk-breakdown';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import type { FeatureLike } from 'ol/Feature';
import {
  useGetMarsSummary, useGetMarsFeatures, useInspectMarsLocation, useGenerateMarsGrid, useAssessMarsRoute,
  useSimulateMarsEvent, getInspectMarsLocationQueryKey, MarsRouteInputAlgorithm,
} from '@workspace/api-client-react';
import type { MarsFeatureCollection, MarsGrid, MarsRouteInput, MarsRoutingStatus, MarsRouteInputAlgorithm as RouteAlg } from '@workspace/api-client-react';
import { BoxSelect, Crosshair, Flag, MapPin, Maximize, Minus, Plus, Grid3x3, Route as RouteIcon, X } from 'lucide-react';
import { boundsFromCorners, insideBounds, pathCostOnGrid } from '@/lib/scenario';
import { RouteLegend, ScenarioPanel, type Scenario } from '@/components/scenario-panel';
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
type Mode = 'inspect' | 'start' | 'end' | 'area';
const cellRing = (c: { centerLng: number; centerLat: number; width: number; height: number }) => { const w = c.width / 2, h = c.height / 2; return [[[c.centerLng - w, c.centerLat - h], [c.centerLng + w, c.centerLat - h], [c.centerLng + w, c.centerLat + h], [c.centerLng - w, c.centerLat + h], [c.centerLng - w, c.centerLat - h]]]; };
const rectRing = (a: Pt, b: Pt) => [[[a.lng, a.lat], [b.lng, a.lat], [b.lng, b.lat], [a.lng, b.lat], [a.lng, a.lat]]];

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
  const routeSrc = useRef(new VectorSource());
  const areaSrc = useRef(new VectorSource());
  const eventSrc = useRef(new VectorSource());
  const cornerRef = useRef<Pt | null>(null);
  const applyCornersRef = useRef<(a: Pt, b: Pt) => void>(() => {});

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
  const sim = useSimulateMarsEvent();
  // Explicit, epoch-guarded state: late responses from stale selections are dropped.
  const gridEpoch = useRef(0); const routeEpoch = useRef(0);
  const [sourceGrid, setSourceGrid] = useState<MarsGrid | null>(null);
  const [activeGrid, setActiveGrid] = useState<MarsGrid | null>(null);
  const [routeState, setRouteState] = useState<{ input: MarsRouteInput; result: MarsRoutingStatus } | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [corner, setCorner] = useState<Pt | null>(null);
  const [areaMsg, setAreaMsg] = useState<string | null>(null);
  const routeResult = routeState?.result;
  const sourceGridRef = useRef(sourceGrid); sourceGridRef.current = sourceGrid;
  const gridValid = Object.values(gridForm).every(Number.isFinite) && Number.isInteger(gridForm.rows) && Number.isInteger(gridForm.columns) && gridForm.rows >= 1 && gridForm.rows <= 80 && gridForm.columns >= 1 && gridForm.columns <= 80 && gridForm.startLat >= -90 && gridForm.endLat <= 90 && gridForm.startLng >= -180 && gridForm.endLng <= 180 && gridForm.startLat<gridForm.endLat && gridForm.startLng<gridForm.endLng;

  const clearRoute = useCallback(() => {
    routeEpoch.current++; route.reset(); sim.reset();
    setRouteState(null); setScenario(null); setActiveGrid(sourceGridRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const gridKey = JSON.stringify(gridForm);
  useEffect(() => { // bounds/resolution changed: old grid, route and scenario no longer describe the selection
    gridEpoch.current++; routeEpoch.current++; grid.reset(); route.reset(); sim.reset();
    setSourceGrid(null); setActiveGrid(null); setRouteState(null); setScenario(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridKey]);
  useEffect(() => { clearRoute(); }, [start?.lat, start?.lng, end?.lat, end?.lng, routeAlg, clearRoute]);

  const cancelArea = useCallback(() => { cornerRef.current = null; setCorner(null); areaSrc.current.getFeatures().filter((f) => f.get('kind') === 'preview').forEach((f) => areaSrc.current.removeFeature(f)); }, []);
  applyCornersRef.current = (a, b) => {
    const r = boundsFromCorners(a, b);
    cancelArea(); setMode('inspect');
    if (!r.bounds) { setAreaMsg(r.error ?? 'Selection rejected.'); return; }
    setAreaMsg(r.clamped ? 'A corner fell outside the valid domain and was clamped to lat ±90 / lng ±180 (no antimeridian wrap).' : null);
    setGridForm((g) => ({ ...g, ...r.bounds! }));
  };
  useEffect(() => { if (mode !== 'area') cancelArea(); }, [mode, cancelArea]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && modeRef.current === 'area') setMode('inspect'); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);

  const generate = () => {
    const ep = ++gridEpoch.current; routeEpoch.current++;
    setSourceGrid(null); setActiveGrid(null);
    setRouteState(null); setScenario(null); sim.reset(); route.reset();
    const input = { ...gridForm };
    grid.mutate({ data: input }, { onSuccess: (g) => { if (ep !== gridEpoch.current) return; setSourceGrid(g); setActiveGrid(g); } });
  };
  const assess = () => {
    if (!start || !end || !sourceGrid) return;
    const ep = ++routeEpoch.current; sim.reset(); setScenario(null); setActiveGrid(sourceGrid); setRouteState(null);
    const input: MarsRouteInput = { algorithm: routeAlg, startLat: start.lat, startLng: start.lng, endLat: end.lat, endLng: end.lng, grid: sourceGrid.bounds };
    route.mutate({ data: input }, { onSuccess: (r) => { if (ep === routeEpoch.current) setRouteState({ input, result: r }); } });
  };
  const simulate = () => {
    if (!routeState) return;
    const ep = routeEpoch.current;
    const prevEvents = scenario?.events ?? [];
    sim.mutate({ data: { route: { ...routeState.input, events: prevEvents } } }, { onSuccess: (r) => {
      if (ep !== routeEpoch.current) return;
      setActiveGrid(r.grid);
      setScenario({ events: r.events, oldRoute: r.oldRoute, oldPathScenarioCost: pathCostOnGrid(r.oldRoute.path, r.grid), newRoute: r.newRoute, event: r.event });
    } });
  };
  const resetScenario = () => { routeEpoch.current++; sim.reset(); setScenario(null); setActiveGrid(sourceGrid); };
  const currentPath = scenario ? scenario.newRoute : routeResult;
  const eventBlock = !routeState ? 'Calculate an experimental route first.' : !currentPath?.available || currentPath.path.length < 2 ? 'The current route has no cell after the start to perturb.' : (scenario?.events.length ?? 0) >= 50 ? 'Scenario limit reached (50 events). Reset to continue.' : undefined;

  const selectedCell = useMemo(() => {
    if (!probe || !activeGrid) return undefined;
    const b=activeGrid.bounds;
    if(probe.lat<b.startLat||probe.lat>b.endLat||probe.lng<b.startLng||probe.lng>b.endLng)return undefined;
    const row=Math.min(b.rows-1,Math.floor((probe.lat-b.startLat)/(b.endLat-b.startLat)*b.rows));
    const col=Math.min(b.columns-1,Math.floor((probe.lng-b.startLng)/(b.endLng-b.startLng)*b.columns));
    return activeGrid.cells.find(c=>c.row===row&&c.col===col);
  },[probe,activeGrid]);
  const selectedChange = selectedCell && scenario?.event.changes.find((c) => c.row === selectedCell.row && c.col === selectedCell.col);

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
      fill: new Fill({ color: `hsla(${45-(f.get('risk') ?? 100)*.45},85%,45%,.38)` }),
      stroke: new Stroke({ color: 'rgba(31,38,51,.35)', width: 0.5, lineDash: f.get('known') ? undefined : [2, 2] }),
    }) });
    const marks = new VectorLayer({ source: markSrc.current, style: (f) => new Style({
      image: new CircleStyle({ radius: 7, fill: new Fill({ color: f.get('kind') === 'probe' ? '#1f2633' : f.get('kind') === 'start' ? '#2f7a6a' : '#a8432a' }), stroke: new Stroke({ color: '#f6efe2', width: 2 }) }),
    }) });
    const map = new OLMap({
      target: mapEl.current,
      layers: [hill, ...order.map((id) => vec.current[id]), vec.current.grid,
        new VectorLayer({ source: eventSrc.current, style: (f) => new Style({ fill: new Fill({ color: f.get('origin') ? 'rgba(91,42,134,.28)' : 'rgba(91,42,134,.1)' }), stroke: new Stroke({ color: '#5b2a86', width: f.get('origin') ? 2.5 : 1.2, lineDash: f.get('origin') ? undefined : [3, 3] }) }) }),
        new VectorLayer({ source: routeSrc.current, style: (f) => {
          const k = f.get('kind');
          if (k === 'old') return new Style({ stroke: new Stroke({ color: '#b5651d', width: 7, lineDash: [10, 7] }), image: new CircleStyle({ radius: 8, stroke: new Stroke({ color: '#b5651d', width: 3 }) }) });
          if (k === 'new') return new Style({ stroke: new Stroke({ color: '#006e91', width: 3 }), image: new CircleStyle({ radius: 4, fill: new Fill({ color: '#006e91' }) }) });
          return new Style({ stroke: new Stroke({ color: '#006e91', width: 4 }), image: new CircleStyle({ radius: 5, fill: new Fill({ color: '#006e91' }) }) });
        } }),
        new VectorLayer({ source: areaSrc.current, style: (f) => f.get('kind') === 'corner'
          ? new Style({ image: new CircleStyle({ radius: 6, fill: new Fill({ color: '#f6efe2' }), stroke: new Stroke({ color: '#a8432a', width: 2.5 }) }) })
          : new Style({ fill: new Fill({ color: f.get('kind') === 'preview' ? 'rgba(168,67,42,.12)' : 'rgba(0,0,0,0)' }), stroke: new Stroke({ color: '#a8432a', width: f.get('kind') === 'preview' ? 2 : 1.25, lineDash: [6, 4] }) }) }),
        marks],
      view: new View({ projection: proj, center: [0, 0], zoom: 2, extent: MARS_EXTENT, showFullExtent: true, constrainOnlyCenter: true }),
      controls: [],
    });
    map.getView().fit(MARS_EXTENT);
    map.on('singleclick', (e) => {
      const [lng, lat] = e.coordinate;
      const p = { lat: +lat.toFixed(4), lng: +lng.toFixed(4) };
      if (modeRef.current === 'area') {
        if (!cornerRef.current) { cornerRef.current = p; setCorner(p); } else applyCornersRef.current(cornerRef.current, p);
        return;
      }
      if (modeRef.current === 'start') setStart(p); else if (modeRef.current === 'end') setEnd(p); else setProbe(p);
      if (modeRef.current !== 'inspect') setMode('inspect');
    });
    map.on('pointermove', (e) => {
      setCursor({ lng: e.coordinate[0], lat: e.coordinate[1] });
      const c = cornerRef.current; if (modeRef.current !== 'area' || !c) return;
      const src = areaSrc.current; let pv = src.getFeatures().find((f) => f.get('kind') === 'preview');
      const ring = rectRing(c, { lng: Math.max(-180, Math.min(180, e.coordinate[0])), lat: Math.max(-90, Math.min(90, e.coordinate[1])) });
      if (pv) (pv.getGeometry() as Polygon).setCoordinates(ring); else { pv = new Feature(new Polygon(ring)); pv.set('kind', 'preview'); src.addFeature(pv); }
    });
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
    activeGrid?.cells.forEach((c) => {
      const f = new Feature(new Polygon(cellRing(c)));
      f.set('known', c.assessment.geologyCovered); f.set('risk',c.assessment.riskScore); gridSrc.current.addFeature(f);
    });
  }, [activeGrid]);
  useEffect(()=>{
    routeSrc.current.clear(); eventSrc.current.clear();
    const add = (r: MarsRoutingStatus | undefined, kind: string) => {
      if (!r?.path.length) return;
      const points=r.path.map(c=>[c.centerLng,c.centerLat]);
      const f = new Feature(points.length===1?new Point(points[0]):new LineString(points)); f.set('kind', kind); routeSrc.current.addFeature(f);
    };
    if (scenario) {
      add(scenario.oldRoute, 'old'); add(scenario.newRoute, 'new');
      scenario.event.changes.forEach((ch) => {
        const c = activeGrid?.cells.find((x) => x.row === ch.row && x.col === ch.col); if (!c) return;
        const f = new Feature(new Polygon(cellRing(c))); f.set('origin', ch.origin); eventSrc.current.addFeature(f);
      });
    } else add(routeResult, 'route');
  },[routeResult, scenario, activeGrid]);
  useEffect(() => { // selection rectangle (current bounds) + first corner
    const src = areaSrc.current;
    src.getFeatures().filter((f) => f.get('kind') !== 'preview').forEach((f) => src.removeFeature(f));
    if (gridValid) { const f = new Feature(new Polygon(rectRing({ lat: gridForm.startLat, lng: gridForm.startLng }, { lat: gridForm.endLat, lng: gridForm.endLng }))); f.set('kind', 'selection'); src.addFeature(f); }
    if (corner) { const f = new Feature(new Point([corner.lng, corner.lat])); f.set('kind', 'corner'); src.addFeature(f); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridKey, corner]);

  const zoom = (d: number) => { const v = mapRef.current?.getView(); if (v) v.animate({ zoom: (v.getZoom() ?? 2) + d, duration: 200 }); };
  const reset = () => mapRef.current?.getView().fit(MARS_EXTENT, { duration: 300 });

  const units = useMemo(() => {
    const m = new Map<string, string>();
    (f03.data?.features ?? []).forEach((f) => { const p = (f as { properties?: Record<string, unknown> }).properties ?? {}; const u = String(p.Unit ?? 'unlabelled'); if (!m.has(u)) m.set(u, String(p.UnitDesc ?? '')); });
    return [...m.entries()].sort();
  }, [f03.data]);

  const missingRoute = [!start && 'start point', !end && 'end point',!sourceGrid && 'generated risk grid',
    sourceGrid && start && !insideBounds(start, sourceGrid.bounds) && 'start inside grid bounds', sourceGrid && end && !insideBounds(end, sourceGrid.bounds) && 'end inside grid bounds'].filter(Boolean) as string[];
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
          <div className="mb-3 rounded-md border bg-card p-2.5 text-xs space-y-1.5" data-testid="panel-area-select">
            <p className="font-mono text-[10px] text-muted-foreground" data-testid="text-selection-bounds">selection: lat {gridForm.startLat}…{gridForm.endLat}° · lng {gridForm.startLng}…{gridForm.endLng}°</p>
            {mode === 'area'
              ? <p>{corner ? `Corner 1 at ${corner.lat}°, ${corner.lng}°. Click or tap the opposite corner.` : 'Click or tap the first corner of the rectangle.'} Esc cancels.</p>
              : <p className="text-muted-foreground">Draw a rectangle with two opposite-corner clicks, or type bounds below. Rectangular, no antimeridian crossing.</p>}
            <div className="flex gap-1">
              <button onClick={() => setMode(mode === 'area' ? 'inspect' : 'area')} data-testid="button-select-area" className={`flex-1 inline-flex justify-center items-center gap-1.5 rounded border px-2 py-1 ${mode === 'area' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}><BoxSelect className="h-3.5 w-3.5" />{mode === 'area' ? 'Selecting…' : 'Select area on map'}</button>
              {mode === 'area' && <button onClick={() => setMode('inspect')} data-testid="button-cancel-area" className="rounded border px-2 py-1 hover:bg-muted">Cancel</button>}
            </div>
            {areaMsg && <p className="text-destructive" data-testid="text-area-message">{areaMsg}</p>}
            <p className="text-muted-foreground">Changing bounds or rows/columns discards the current grid, route and scenario. Generate explicitly afterwards.</p>
          </div>
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
          <button disabled={!gridValid || grid.isPending} onClick={generate} data-testid="button-generate-grid"
            className="mt-3 w-full inline-flex justify-center items-center gap-2 rounded-md bg-secondary text-secondary-foreground py-1.5 text-sm disabled:opacity-50">
            <Grid3x3 className="h-4 w-4" />{grid.isPending ? 'Generating…' : 'Generate grid'}
          </button>
          {grid.isError && <div className="mt-2"><ErrorPanel title="Grid failed" error={grid.error} onRetry={generate} /></div>}
          {sourceGrid && (
            <div className="mt-2 text-xs space-y-1" data-testid="text-grid-result">
              <p className="font-mono">{sourceGrid.rows}×{sourceGrid.columns} · all cells have unverified physical safety</p>
              <p>Generated bounds: {sourceGrid.bounds.startLat}…{sourceGrid.bounds.endLat}° latitude, {sourceGrid.bounds.startLng}…{sourceGrid.bounds.endLng}° longitude.</p>
              <p>Source-derived risk range: {Math.min(...sourceGrid.cells.map(c=>c.assessment.riskScore)).toFixed(2)}–{Math.max(...sourceGrid.cells.map(c=>c.assessment.riskScore)).toFixed(2)} / 100.</p>
              <p>Grid colors: amber = lower model score, red = higher model score; dashed = no midpoint geology. Neither color means safe.</p>
              <p>Inspect a generated cell to see its factor contributions and source feature IDs.</p>
              <p className="text-muted-foreground">{sourceGrid.warning}</p>
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
          {([['inspect', Crosshair, 'Inspect'], ['start', MapPin, 'Set start'], ['end', Flag, 'Set end'], ['area', BoxSelect, 'Area']] as const).map(([m, Icon, l]) => (
            <button key={m} onClick={() => setMode(m)} data-testid={`button-mode-${m}`}
              className={`px-3 py-1.5 inline-flex items-center gap-1.5 ${mode === m ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}><Icon className="h-3.5 w-3.5" />{l}</button>))}
        </div>
        {(routeResult || scenario) && <div className="absolute top-14 right-3"><RouteLegend hasScenario={!!scenario} /></div>}
        {mode === 'area' && <div className="absolute top-14 left-1/2 -translate-x-1/2 rounded-md border bg-card/95 px-3 py-1.5 text-xs shadow-sm flex items-center gap-2" data-testid="text-area-instructions">
          {corner ? 'Now click the opposite corner' : 'Click the first corner'}<button onClick={() => setMode('inspect')} className="underline">cancel</button></div>}
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
          {selectedCell && <><p className="mt-2 text-xs font-mono">Generated cell [{selectedCell.row}, {selectedCell.col}] · footprint {selectedCell.width}° × {selectedCell.height}°</p>
            {scenario && <p className="mt-1 text-xs border-l-2 border-[#5b2a86] pl-2" data-testid="text-inspect-scenario">Showing simulated scenario scores ({scenario.events.length} event{scenario.events.length === 1 ? '' : 's'}), not source-derived values.{selectedChange && ` Latest event: ${scenario.event.spec.factor} ${selectedChange.factorBefore.toFixed(3)}→${selectedChange.factorAfter.toFixed(3)}, DF ${selectedChange.dfBefore.toFixed(4)}→${selectedChange.dfAfter.toFixed(4)}, area ${selectedChange.areaKm2.toFixed(0)} km²${selectedChange.origin ? ' (origin)' : ''}.`}</p>}
            <RiskBreakdown risk={selectedCell.assessment} /></>}
          {probe && !selectedCell && <p className="mt-2 text-xs">Generate a grid covering this location to calculate its cell risk.</p>}
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
          <h2 className="font-display text-xl">Experimental model route</h2>
          <p className="mt-2 text-xs">R = 45T + 35M + 20U. Assumed traversability; not a validated safe route. Generate a grid covering both endpoints first.</p>
          <div className="mt-3 space-y-1.5 text-xs font-mono">
            <p>start: {start ? `${start.lat}°, ${start.lng}°` : <Unknown label="not set" />} {start && <button onClick={() => setStart(null)} className="text-muted-foreground underline" data-testid="button-clear-start">clear</button>}</p>
            <p>end: {end ? `${end.lat}°, ${end.lng}°` : <Unknown label="not set" />} {end && <button onClick={() => setEnd(null)} className="text-muted-foreground underline" data-testid="button-clear-end">clear</button>}</p>
          </div>
          <div className="mt-3 flex gap-1">{Object.values(MarsRouteInputAlgorithm).map((a) => (
            <button key={a} onClick={() => setRouteAlg(a)} data-testid={`button-route-alg-${a}`} className={`px-2.5 py-1 rounded border font-mono text-xs ${routeAlg === a ? 'bg-secondary' : 'hover:bg-muted'}`}>{a}</button>))}</div>
          {missingRoute.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Missing inputs: {missingRoute.join(', ')}. Use Set start / Set end on the map.</p>}
          <button disabled={missingRoute.length > 0 || route.isPending} data-testid="button-assess-route"
            onClick={assess}
            className="mt-3 w-full inline-flex justify-center items-center gap-2 rounded-md bg-primary text-primary-foreground py-2 text-sm disabled:opacity-50">
            <RouteIcon className="h-4 w-4" />{route.isPending ? 'Calculating…' : 'Calculate experimental route'}
          </button>
          {route.isError && !routeState && <div className="mt-2"><ErrorPanel title="Assessment failed" error={route.error} onRetry={assess} /></div>}
          {routeResult && (
            <div className="rise mt-3 rounded-md border-2 border-dashed p-3 text-sm" data-testid="panel-route-status">
              <p className="font-medium">{scenario ? 'Original route (before scenario)' : routeResult.available ? 'Experimental route calculated' : 'No model route found'}</p>
              <p className="mt-1 text-xs text-muted-foreground">{routeResult.reason}</p>
              {routeResult.available && <dl className="mt-3 text-xs space-y-1">
                <div>Path cells: {routeResult.path.length} · Moves: {Math.max(0,routeResult.path.length-1)}</div>
                <div>Center-to-center distance: {routeResult.distanceKm.toFixed(2)} km</div>
                <div>Accumulated DF: {routeResult.totalCost.toFixed(4)}</div>
                <div>Entered-cell risk sum: {routeResult.accumulatedRisk.toFixed(2)} (not a probability)</div>
                <div>Average / minimum inverse model score: {routeResult.avgSafetyScore.toFixed(2)} / {routeResult.minSafetyScore.toFixed(2)}</div>
              </dl>}
              <p className="mt-2 text-xs">{routeResult.warning}</p>
              <div className="mt-2 flex flex-wrap gap-1">{routeResult.missingMeasurements.map((m) => <Unknown key={m} label={`${m}: missing`} />)}</div>
            </div>)}
          {routeResult && scenario && <p className="mt-2 text-xs text-muted-foreground">Panel above shows the original source-grid route. The scenario comparison is below.</p>}
          <button className="mt-2 text-xs underline" data-testid="button-clear-route" onClick={clearRoute}>Clear route{scenario ? ' and scenario (restores source grid)' : ''}</button>
          {summary.data && !routeResult && <p className="mt-3 text-xs text-muted-foreground">{summary.data.limitation}</p>}
        </section>
        <ScenarioPanel canSimulate={!eventBlock} disabledReason={eventBlock} pending={sim.isPending} error={sim.isError ? sim.error : null}
          onSimulate={simulate} onReset={resetScenario} scenario={scenario} />
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
