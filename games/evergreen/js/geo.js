// EVERGREEN — procedural geometry for vegetation, rocks and props
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, fbm } from './util.js';

const ni = g => (g.index ? g.toNonIndexed() : g);
export function merge(list) {
  const gs = list.map(g => { g = ni(g); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k); return g; });
  const hasColor = gs.some(g => g.attributes.color);
  if (hasColor) gs.forEach(g => { if (!g.attributes.color) { const c = new Float32Array(g.attributes.position.count * 3).fill(1); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); } });
  return mergeGeometries(gs, false);
}
// jitter + noise displacement for organic blobs
function blob(r, x, y, z, seed, detail = 1, sq = 1) {
  const g = new THREE.IcosahedronGeometry(r, detail), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
    const n = 1 + fbm(vx * 0.9 + seed, vz * 0.9 + vy * 0.7 + seed, 2) * 0.28;
    p.setXYZ(i, vx * n + x, vy * n * sq + y, vz * n + z);
  }
  g.computeVertexNormals(); return g;
}
function tint(g, c) { const col = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
// shade a canopy from dark underside to light crown with vertex colours
function canopyShade(g, y0, y1) {
  g = ni(g); const p = g.attributes.position, n = p.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const t = Math.min(1, Math.max(0, (p.getY(i) - y0) / (y1 - y0))); const v = 0.62 + t * 0.48; a[i * 3] = v; a[i * 3 + 1] = v; a[i * 3 + 2] = v * 0.96; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}

export function oakGeo(seed) {
  const r = rng(seed);
  const h = 2.4 + r() * 0.8;
  const trunk = new THREE.CylinderGeometry(0.2, 0.36, h + 0.6, 7, 3); trunk.translate(0, (h + 0.6) / 2 - 0.3, 0);
  const tp = trunk.attributes.position; for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); tp.setX(i, tp.getX(i) + Math.sin(y * 1.3 + seed) * 0.08); }
  const br = new THREE.CylinderGeometry(0.07, 0.13, 1.6, 5); br.rotateZ(0.9); br.translate(0.55, h - 0.1, 0);
  const br2 = new THREE.CylinderGeometry(0.07, 0.12, 1.4, 5); br2.rotateZ(-0.8); br2.rotateY(2); br2.translate(-0.4, h - 0.2, 0.3);
  const parts = [];
  const n = 4 + Math.floor(r() * 3);
  parts.push(blob(1.75, 0, h + 1.4, 0, seed, 1));
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + r(), d = 0.9 + r() * 0.6; parts.push(blob(1.05 + r() * 0.5, Math.cos(a) * d, h + 0.7 + r() * 1.3, Math.sin(a) * d, seed + i * 3.1, 1)); }
  return { trunk: merge([trunk, br, br2]), leaves: canopyShade(merge(parts), h - 0.2, h + 3.4), top: h + 3.2 };
}
export function pineGeo(seed) {
  const r = rng(seed), tiers = 4 + Math.floor(r() * 2);
  const trunk = new THREE.CylinderGeometry(0.14, 0.3, 2.2, 6); trunk.translate(0, 1.1, 0);
  const parts = []; let y = 1.3, rad = 2.0 + r() * 0.4;
  for (let i = 0; i < tiers; i++) {
    const hh = 1.9 - i * 0.15; const c = new THREE.ConeGeometry(rad, hh, 9, 2);
    const p = c.attributes.position; for (let k = 0; k < p.count; k++) { const yy = p.getY(k); if (yy < hh / 2 - 0.01) { const j = 1 + (Math.sin(k * 12.9 + seed) * 0.12); p.setX(k, p.getX(k) * j); p.setZ(k, p.getZ(k) * j); p.setY(k, yy - (yy < -hh / 2 + 0.01 ? Math.abs(Math.sin(k * 3.7 + seed)) * 0.18 : 0)); } }
    c.translate(0, y + hh / 2, 0); c.computeVertexNormals(); parts.push(c);
    y += hh * 0.58; rad *= 0.76;
  }
  return { trunk, leaves: canopyShade(merge(parts), 1.2, y + 1), top: y + 1 };
}
export function birchGeo(seed) {
  const r = rng(seed), h = 3.4 + r() * 1.2;
  const trunk = new THREE.CylinderGeometry(0.12, 0.2, h + 0.4, 7); trunk.translate(0, (h + 0.4) / 2 - 0.2, 0);
  const parts = [blob(1.1, 0, h + 0.9, 0, seed, 1, 1.35), blob(0.8, 0.5, h + 0.1, 0.2, seed + 2, 1, 1.3), blob(0.75, -0.45, h + 0.3, -0.2, seed + 4, 1, 1.3)];
  return { trunk, leaves: canopyShade(merge(parts), h - 0.6, h + 2.3), top: h + 2.3 };
}
export function bushGeo(seed) {
  const r = rng(seed), parts = [];
  for (let i = 0; i < 3; i++) parts.push(blob(0.55 + r() * 0.3, (r() - 0.5) * 0.9, 0.4 + r() * 0.2, (r() - 0.5) * 0.9, seed + i, 1, 0.85));
  return canopyShade(merge(parts), 0, 1.1);
}
export function rockGeo(seed) {
  const g = new THREE.DodecahedronGeometry(1, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + fbm(x * 1.4 + seed, z * 1.4 + y + seed, 3) * 0.35;
    p.setXYZ(i, x * n, Math.max(-0.3, y * n * 0.72), z * n);
  }
  g.computeVertexNormals(); return g;
}
export function ancientTreeGeo(seed) {
  const r = rng(seed), h = 7;
  const tr = [];
  const trunk = new THREE.CylinderGeometry(0.9, 1.6, h, 10, 6); trunk.translate(0, h / 2, 0);
  const tp = trunk.attributes.position; for (let i = 0; i < tp.count; i++) { const y = tp.getY(i), a = Math.atan2(tp.getZ(i), tp.getX(i)); const k = 1 + Math.sin(a * 5 + seed) * 0.12; tp.setX(i, tp.getX(i) * k + Math.sin(y * 0.6) * 0.3); tp.setZ(i, tp.getZ(i) * k); }
  trunk.computeVertexNormals(); tr.push(trunk);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + r() * 0.4; const root = new THREE.CylinderGeometry(0.18, 0.6, 3.2, 6); root.rotateZ(1.15); root.rotateY(-a); root.translate(Math.cos(a) * 1.6, 0.5, Math.sin(a) * 1.6); tr.push(root); }
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + r(); const b = new THREE.CylinderGeometry(0.25, 0.5, 4.5, 6); b.rotateZ(0.95); b.rotateY(-a); b.translate(Math.cos(a) * 1.8, h - 0.4, Math.sin(a) * 1.8); tr.push(b); }
  const parts = [blob(4.2, 0, h + 3.2, 0, seed, 2)];
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + r(); parts.push(blob(2.4 + r() * 1.2, Math.cos(a) * 3.6, h + 1.4 + r() * 2.2, Math.sin(a) * 3.6, seed + i, 1)); }
  return { trunk: merge(tr), leaves: canopyShade(merge(parts), h - 1, h + 7), top: h + 7 };
}
export function flowerGeo() {
  const stem = new THREE.CylinderGeometry(0.02, 0.025, 0.42, 3); stem.translate(0, 0.21, 0); tint(stem, 0x4f8a35);
  const leaf = new THREE.ConeGeometry(0.07, 0.18, 3); leaf.rotateZ(1.2); leaf.translate(0.06, 0.12, 0); tint(leaf, 0x5a9a3c);
  const head = new THREE.IcosahedronGeometry(0.09, 0); head.scale(1, 0.55, 1); head.translate(0, 0.44, 0); tint(head, 0xffffff);
  const mid = new THREE.IcosahedronGeometry(0.035, 0); mid.translate(0, 0.475, 0); tint(mid, 0xffe07a);
  return { stem: merge([stem, leaf]), head: merge([head, mid]) };
}
export function fernGeo() {
  const parts = [];
  for (let i = 0; i < 7; i++) { const f = new THREE.ConeGeometry(0.12, 1.1, 3); f.rotateX(Math.PI / 2 - 0.5); f.translate(0, 0.25, 0.5); f.rotateY(i / 7 * Math.PI * 2); tint(f, 0xffffff); parts.push(f); }
  return merge(parts);
}
export function mushroomGeo() {
  const stem = new THREE.CylinderGeometry(0.05, 0.07, 0.22, 6); stem.translate(0, 0.11, 0); tint(stem, 0xf3ead8);
  const cap = new THREE.SphereGeometry(0.15, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2); cap.scale(1, 0.7, 1); cap.translate(0, 0.21, 0); tint(cap, 0xffffff);
  return merge([stem, cap]);
}
export function reedGeo() {
  const parts = [];
  for (let i = 0; i < 5; i++) { const c = new THREE.CylinderGeometry(0.015, 0.03, 1.3 + (i % 3) * 0.3, 3); c.translate((i - 2) * 0.1, 0.7, (i % 2) * 0.1); tint(c, 0x6d8a3a); parts.push(c); const t = new THREE.CylinderGeometry(0.045, 0.045, 0.22, 5); t.translate((i - 2) * 0.1, 1.35 + (i % 3) * 0.3, (i % 2) * 0.1); tint(t, 0x6b4a2a); parts.push(t); }
  return merge(parts);
}
export function grassBladeGeo() {
  // tapered curved blade, 3 segments, height 1 (scaled per instance in shader)
  const pos = [], uv = [];
  const seg = 3;
  for (let i = 0; i <= seg; i++) { const t = i / seg, w = 0.06 * (1 - t * 0.85), bend = t * t * 0.25; pos.push(-w, t, bend, w, t, bend); uv.push(0, t, 1, t); }
  const idx = []; for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}
export { blob, tint };
