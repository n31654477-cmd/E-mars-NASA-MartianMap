// From workspace root: pnpm --filter @workspace/scripts exec tsx --test ../artifacts/mars-pathfinder/src/lib/scenario.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MarsGrid, MarsRoutingStatus } from '@workspace/api-client-react';
import { boundsFromCorners, insideBounds, samePathGeometry, pathCostOnGrid } from './scenario';

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
