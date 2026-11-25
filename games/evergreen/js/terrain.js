// EVERGREEN — terrain shape, regions, paths, walkable surfaces
import { fbm, smooth, lerp, clamp, distToSeg } from './util.js';

export const HALF = 180;          // world half-size
export const WL = 0;              // water level
export const FOREST_R = 58;

export const REGIONS = [
  { id: 0, key: 'forest', name: 'The Forest', blurb: 'A quiet clearing among pines and oaks — where your village begins.', color: '#6fa04a', req: null },
  { id: 1, key: 'lake', name: 'The Lakeside', blurb: 'A glassy lake with reeds, lily pads and the best fishing for miles.', color: '#4f9ac0', req: { level: 2, coins: 800, wood: 30 } },
  { id: 2, key: 'high', name: 'The Highlands', blurb: 'Windswept ridges, a hidden waterfall and steaming mountain springs.', color: '#8c8f9a', req: { level: 3, coins: 2600, stone: 60 } },
  { id: 3, key: 'meadow', name: 'The Meadow', blurb: 'Rolling fields of wildflowers, a windmill and long golden evenings.', color: '#d8b84a', req: { level: 2, coins: 1400, flowers: 25 } },
  { id: 4, key: 'old', name: 'The Old Woodland', blurb: 'Ancient trees older than memory, and ruins no map remembers.', color: '#4a6a48', req: { level: 4, coins: 5000, wood: 80, stone: 60 } },
];

export function regionAt(x, z) {
  const r = Math.hypot(x, z);
  if (r < FOREST_R) return 0;
  const a = Math.atan2(z, x) * 180 / Math.PI; // -180..180
  if (a >= -45 && a < 45) return 3;          // east  → meadow
  if (a >= 45 && a < 135) return 1;          // south → lakeside
  if (a >= -135 && a < -45) return 2;        // north → highlands
  return 4;                                  // west  → old woodland
}

// river centre line
export const riverX = z => 22 + 8 * Math.sin(z * 0.045);
export const RIVER_Z0 = -84, RIVER_Z1 = 92;
export const LAKE = { x: 14, z: 108, rx: 42, rz: 30 };
const lakeD = (x, z) => ((x - LAKE.x) / LAKE.rx) ** 2 + ((z - LAKE.z) / LAKE.rz) ** 2;

// small hills for secret viewpoints & an island
const BUMPS = [
  { x: 40, z: -46, r: 11, h: 6.5 }, { x: -30, z: 130, r: 9, h: 5 }, { x: 2, z: 112, r: 6, h: 3.6 },
  { x: -140, z: -30, r: 16, h: -1.2 }, { x: 0, z: -138, r: 12, h: 6 }, { x: 128, z: 40, r: 14, h: 2.5 },
];

export function height(x, z) {
  const r = Math.hypot(x, z);
  let h = 1.8 + fbm(x * 0.018, z * 0.018) * 3.4 + fbm(x * 0.09 + 7, z * 0.09, 2) * 0.45;
  // highlands to the north
  const hi = smooth(-56, -100, z);
  h += hi * (9 + fbm(x * 0.03 + 3, z * 0.03, 4) * 7) + smooth(-100, -165, z) * 10;
  // meadow — gentle rolling
  const me = smooth(56, 88, x) * (1 - hi);
  h = lerp(h, 2.2 + fbm(x * 0.012 + 11, z * 0.012, 3) * 2.6, me);
  // old woodland — knotted hills
  const ow = smooth(-56, -88, x) * (1 - hi);
  h += ow * (fbm(x * 0.035 + 5, z * 0.035 + 2, 3) * 3.6 + 1.2);
  // clearing
  h = lerp(h, 2.1 + fbm(x * 0.05, z * 0.05, 2) * 0.35, smooth(28, 12, r));
  // bumps
  for (const b of BUMPS) { const d = Math.hypot(x - b.x, z - b.z); if (d < b.r * 1.6) h += b.h * smooth(b.r * 1.6, b.r * 0.3, d); }
  // lake bowl
  const d = lakeD(x, z);
  if (d < 1.5) h = lerp(h, -4.6 + 5.6 * d, smooth(1.4, 0.55, d));
  // river
  if (z > RIVER_Z0 - 4 && z < RIVER_Z1 + 6) {
    const dr = Math.abs(x - riverX(z));
    const w = smooth(7.5, 2.0, dr) * smooth(RIVER_Z0 - 3, RIVER_Z0 + 3, z) * (1 - smooth(RIVER_Z1 - 4, RIVER_Z1 + 6, z) * 0.0);
    if (w > 0) h = lerp(h, Math.min(h, -1.7 + dr * 0.28), w);
  }
  // mountain rim
  h += smooth(148, 180, r) * (24 + fbm(x * 0.02, z * 0.02) * 12);
  return h;
}

// ---------- paths ----------
export const PATHS = [
  [[0, 0], [-1, 22], [1, 44], [0, 60], [-2, 72], [-6, 80]],                       // south → lake
  [[0, 0], [-3, -22], [-6, -42], [-7, -60], [-10, -82], [-14, -104], [-10, -122]],  // north → highlands
  [[0, 0], [12, 1], [22, 1.5], [33, 0], [46, 2], [60, 3], [84, 8], [108, 2], [126, -6]], // east → meadow (bridge @22)
  [[0, 0], [-18, -3], [-36, -2], [-60, 1], [-84, 6], [-106, -2], [-124, 4]],       // west → old woodland
  [[-1, 22], [-16, 28], [-30, 33], [-40, 37]],                                      // trailhead spur
  [[-2, 72], [14, 74], [32, 80], [46, 90]],                                         // lake shore east
  [[-2, 72], [-18, 82], [-26, 96]],                                                  // lake shore west
];
export const TRAILHEAD = { x: -40, z: 37 };
export function pathDist(x, z) {
  let m = 1e9;
  for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) { const d = distToSeg(x, z, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]); if (d < m) m = d; }
  return m;
}

// ---------- walkable surfaces (bridges, docks, decks) ----------
export const surfaces = [];
export function addSurface(s) { surfaces.push(s); return s; }
export function removeSurface(s) { const i = surfaces.indexOf(s); if (i >= 0) surfaces.splice(i, 1); }
export function surfaceAt(x, z) {
  let best = null, by = -1e9;
  for (const s of surfaces) {
    const dx = x - s.x, dz = z - s.z, c = Math.cos(-s.rot), sn = Math.sin(-s.rot);
    const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
    if (Math.abs(lx) <= s.hw && Math.abs(lz) <= s.hd) {
      const y = s.y + (s.arch ? s.arch * (1 - (lx / s.hw) ** 2) : 0);
      if (y > by) { by = y; best = s; }
    }
  }
  return best ? { y: by, s: best } : null;
}
export function ground(x, z) {
  const t = height(x, z), s = surfaceAt(x, z);
  if (s && s.y > t - 0.05) return { y: s.y, kind: s.kind || 'wood', water: false };
  const water = t < WL - 0.05;
  return { y: t, kind: water ? 'water' : null, water, depth: WL - t };
}
export const clampWorld = (x, z) => { const r = Math.hypot(x, z), m = 150; if (r > m) { x *= m / r; z *= m / r; } return [x, z]; };
export const slopeAt = (x, z) => { const e = 0.8; return Math.hypot(height(x + e, z) - height(x - e, z), height(x, z + e) - height(x, z - e)) / (2 * e); };
export const isRiverZone = (x, z) => z > RIVER_Z0 && z < RIVER_Z1 && Math.abs(x - riverX(z)) < 9;
export const nearLake = (x, z) => lakeD(x, z) < 1.25;
export { lakeD, clamp };
