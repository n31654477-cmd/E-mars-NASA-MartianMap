// From workspace root: pnpm --filter @workspace/scripts exec tsx --test ../artifacts/mars-pathfinder/src/lib/scenario.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MarsGrid, MarsRoutingStatus } from '@workspace/api-client-react';
import { boundsFromCorners, insideBounds, samePathGeometry, pathCostOnGrid, routeCrossesEventOrigin } from './scenario';

const route = (cells: [number, number][]) => ({ path: cells.map(([row, col]) => ({ row, col })) }) as unknown as MarsRoutingStatus;

test('comparison recosts the old path on the new grid without charging start', () => {
  const grid = { cells: [
    { row: 0, col: 0, df: 999 },
    { row: 0, col: 1, df: 1.5 },
    { row: 0, col: 2, df: 1.75 },
  ] } as unknown as MarsGrid;
  assert.equal(pathCostOnGrid(route([[0, 0], [0, 1], [0, 2]]).path, grid), 3.25);
  assert.equal(pathCostOnGrid(route([[0, 0]]).path, grid), 0);
  assert.equal(pathCostOnGrid(route([]).path, grid), 0);
});

test('comparison reports missing path cells instead of inventing zero cost', () => {
  const grid = { cells: [{ row: 0, col: 0, df: 1.5 }] } as unknown as MarsGrid;
  assert.equal(pathCostOnGrid(route([[0, 0], [0, 1]]).path, grid), null);
});

test('comparison rejects a now-forbidden previous route', () => {
  const grid = { cells: [{ row: 0, col: 0, df: 1.5 }, { row: 0, col: 1, df: 1.7, blocked: true }] } as unknown as MarsGrid;
  assert.equal(pathCostOnGrid(route([[0, 0], [0, 1]]).path, grid), null);
});

test('client safety guard rejects any accumulated event origin in a returned route', () => {
  const events = [{ row: 3, col: 4 }, { row: 7, col: 2 }];
  assert.equal(routeCrossesEventOrigin([{ row: 0, col: 0 }, { row: 3, col: 4 }], events), true);
  assert.equal(routeCrossesEventOrigin([{ row: 3, col: 3 }, { row: 3, col: 5 }], events), false);
  assert.equal(routeCrossesEventOrigin([], events), false);
});

test('reversed corners normalize to min/max', () => {
  const r = boundsFromCorners({ lat: 10, lng: 20 }, { lat: -5, lng: -30 });
  assert.deepEqual(r.bounds, { startLat: -5, endLat: 10, startLng: -30, endLng: 20 });
  assert.equal(r.clamped, false);
});

test('zero-area selection is rejected', () => {
  assert.ok(boundsFromCorners({ lat: 1, lng: 2 }, { lat: 1, lng: 9 }).error);
  assert.ok(boundsFromCorners({ lat: 1, lng: 2 }, { lat: 8, lng: 2 }).error);
  assert.equal(boundsFromCorners({ lat: 1, lng: 2 }, { lat: 1, lng: 2 }).bounds, undefined);
});

test('nonfinite input rejected before clamping; out-of-domain clamped', () => {
  for (const bad of [NaN, Infinity, -Infinity]) {
    const r = boundsFromCorners({ lat: bad, lng: 0 }, { lat: 5, lng: 5 });
    assert.equal(r.bounds, undefined); assert.ok(r.error);
  }
  const c = boundsFromCorners({ lat: -120, lng: -200 }, { lat: 95, lng: 190 });
  assert.deepEqual(c.bounds, { startLat: -90, endLat: 90, startLng: -180, endLng: 180 });
  assert.equal(c.clamped, true);
});

test('bounds inclusion is edge-inclusive', () => {
  const b = { startLat: -10, endLat: 10, startLng: -20, endLng: 20 };
  assert.ok(insideBounds({ lat: -10, lng: 20 }, b));
  assert.ok(insideBounds({ lat: 0, lng: 0 }, b));
  assert.ok(!insideBounds({ lat: 10.0001, lng: 0 }, b));
  assert.ok(!insideBounds({ lat: 0, lng: -20.5 }, b));
});

test('samePathGeometry compares ordered row/col sequences', () => {
  assert.ok(samePathGeometry(route([[0, 0], [0, 1]]), route([[0, 0], [0, 1]])));
  assert.ok(!samePathGeometry(route([[0, 0], [0, 1]]), route([[0, 0], [1, 1]])));
  assert.ok(!samePathGeometry(route([[0, 0]]), route([[0, 0], [0, 1]])));
  assert.ok(!samePathGeometry(undefined, route([[0, 0]])));
});

import { routeDisplayGeometry, nearestPathIndex } from './scenario';

test('display geometry keeps centers and adds exact-endpoint connectors', () => {
  const g = routeDisplayGeometry([[0, 0], [1, 0]], [0.2, 0.1], [1.3, -0.2]);
  assert.deepEqual(g.core, [[0, 0], [1, 0]]);
  assert.deepEqual(g.connectors, [{ at: 'start', coords: [[0.2, 0.1], [0, 0]] }, { at: 'end', coords: [[1, 0], [1.3, -0.2]] }]);
});

test('display geometry: same cell route and duplicate coords', () => {
  const g = routeDisplayGeometry([[5, 5]], [5.1, 5], [4.9, 5]);
  assert.equal(g.connectors.length, 2);
  assert.deepEqual(g.connectors[0].coords[1], [5, 5]);
  assert.deepEqual(g.connectors[1].coords[0], [5, 5]);
  assert.equal(routeDisplayGeometry([[5, 5]], [5, 5], [5, 5]).connectors.length, 0);
  assert.equal(routeDisplayGeometry([], [1, 1], [2, 2]).connectors.length, 0);
});

test('nearest path index excludes destination and respects tolerance', () => {
  const px: [number, number][] = [[0, 0], [20, 0], [40, 0]];
  assert.equal(nearestPathIndex(px, [18, 3], 10), 1);
  assert.equal(nearestPathIndex(px, [40, 0], 10), null);
  assert.equal(nearestPathIndex(px, [100, 100], 10), null);
  assert.equal(nearestPathIndex([[0, 0]], [0, 0], 10), null);
});
