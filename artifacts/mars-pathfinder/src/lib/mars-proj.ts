import Projection from 'ol/proj/Projection';
import { addProjection, get as getProjection } from 'ol/proj';

export const MARS_EXTENT: [number, number, number, number] = [-180, -90, 180, 90];

export function marsProjection(): Projection {
  const existing = getProjection('MARS:2000');
  if (existing) return existing;
  const p = new Projection({ code: 'MARS:2000', units: 'degrees', extent: MARS_EXTENT, global: true });
  addProjection(p);
  return p;
}

// Categorical palette — geologic identity, never danger.
const PALETTE = ['#c07a4a', '#5f8f9a', '#c9a24a', '#7c6a9a', '#6f9a6a', '#b0606f', '#4f6f8f', '#a88a6a', '#8fa05a', '#9a6aa0', '#5a9a8a', '#c08a9a', '#7a8a4a', '#6a7aa8', '#b8784a', '#4a8a6a'];
export function unitColor(unit: string): string {
  let h = 0;
  for (let i = 0; i < unit.length; i++) h = (h * 31 + unit.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
