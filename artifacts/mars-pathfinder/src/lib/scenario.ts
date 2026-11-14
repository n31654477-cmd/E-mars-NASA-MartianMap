import type { MarsGrid, MarsGridInput, MarsRoutingStatus } from '@workspace/api-client-react';

export type LatLng = { lat: number; lng: number };
export type Bounds = Pick<MarsGridInput, 'startLat' | 'endLat' | 'startLng' | 'endLng'>;

const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

/**
 * Turn two opposite corners into rectangular bounds.
 * Clamps to the valid geographic domain (lat ±90, lng ±180). The map uses a single
 * -180..180 equirectangular extent, so a rectangle can never wrap the antimeridian;
 * a corner clicked outside the extent is clamped to the seam rather than wrapped.
 */
export function boundsFromCorners(a: LatLng, b: LatLng): { bounds?: Bounds; error?: string; clamped: boolean } {
  if (![a.lat, a.lng, b.lat, b.lng].every(Number.isFinite)) return { error: 'Corner coordinates are not finite.', clamped: false };
  const clampLat = (v: number) => Math.max(-90, Math.min(90, v));
  const clampLng = (v: number) => Math.max(-180, Math.min(180, v));
  const pts = [a, b].map((p) => ({ lat: r4(clampLat(p.lat)), lng: r4(clampLng(p.lng)) }));
  const clamped = pts.some((p, i) => p.lat !== r4([a, b][i].lat) || p.lng !== r4([a, b][i].lng));
  const bounds = {
    startLat: Math.min(pts[0].lat, pts[1].lat), endLat: Math.max(pts[0].lat, pts[1].lat),
    startLng: Math.min(pts[0].lng, pts[1].lng), endLng: Math.max(pts[0].lng, pts[1].lng),
  };
  if (bounds.endLat - bounds.startLat < 1e-4 || bounds.endLng - bounds.startLng < 1e-4)
    return { error: 'Zero-area selection rejected: the two corners share a latitude or longitude. Pick opposite corners.', clamped };
  return { bounds, clamped };
}

export function insideBounds(p: LatLng, b: Bounds) {
  return p.lat >= b.startLat && p.lat <= b.endLat && p.lng >= b.startLng && p.lng <= b.endLng;
}

export function samePathGeometry(a?: MarsRoutingStatus, b?: MarsRoutingStatus) {
  if (!a || !b || a.path.length !== b.path.length) return false;
  return a.path.every((c, i) => c.row === b.path[i].row && c.col === b.path[i].col);
}

export function sharedCellCount(a: MarsRoutingStatus, b: MarsRoutingStatus) {
  const s = new Set(a.path.map((c) => `${c.row}:${c.col}`));
  return b.path.filter((c) => s.has(`${c.row}:${c.col}`)).length;
}

/** Sum of DF for cells entered after the start, read from the given grid (backend values). Null if any cell is missing. */
export function pathCostOnGrid(path: { row: number; col: number }[], grid: MarsGrid): number | null {
  let sum = 0;
  for (const p of path.slice(1)) {
    const c = grid.cells.find((x) => x.row === p.row && x.col === p.col);
    if (!c || c.blocked === true) return null;
    sum += c.df ?? c.assessment.movementCost;
  }
  return sum;
}

/** True when an API-returned route crosses any accumulated event-origin cell. */
export function routeCrossesEventOrigin(
  path: readonly { row: number; col: number }[],
  events: readonly { row: number; col: number }[],
): boolean {
  const origins = new Set(events.map((event) => `${event.row}:${event.col}`));
  return path.some((cell) => origins.has(`${cell.row}:${cell.col}`));
}

export type XY = [number, number];
const sameXY = (a: XY, b: XY) => a[0] === b[0] && a[1] === b[1];

/**
 * Display geometry for a cell-center path whose true endpoints are exact plotted points.
 * `core` is the unchanged center-to-center path (what the algorithm costed). Connectors are
 * uncosted, schematic within-cell links from the exact start point to the first center and
 * from the last center to the exact end point. Zero-length connectors are omitted.
 */
export function routeDisplayGeometry(centers: XY[], exactStart: XY | null, exactEnd: XY | null) {
  const connectors: { at: 'start' | 'end'; coords: [XY, XY] }[] = [];
  if (!centers.length) return { core: centers, connectors };
  const first = centers[0], last = centers[centers.length - 1];
  if (exactStart && !sameXY(exactStart, first)) connectors.push({ at: 'start', coords: [exactStart, first] });
  if (exactEnd && !sameXY(exactEnd, last)) connectors.push({ at: 'end', coords: [last, exactEnd] });
  return { core: centers, connectors };
}

/**
 * Nearest selectable path waypoint to a screen pixel. Only indices 0..length-2 are eligible
 * (the destination cell cannot host the traveler). Returns null beyond the pixel tolerance.
 */
export function nearestPathIndex(pixels: XY[], click: XY, tolerancePx: number): number | null {
  let best: number | null = null, bestD = Infinity;
  for (let i = 0; i < pixels.length - 1; i++) {
    const d = Math.hypot(pixels[i][0] - click[0], pixels[i][1] - click[1]);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best !== null && bestD <= tolerancePx ? best : null;
}
