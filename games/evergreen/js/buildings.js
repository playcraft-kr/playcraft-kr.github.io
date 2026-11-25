// EVERGREEN — building catalog and procedural models
import * as THREE from 'three';
import { M, TEX, patch } from './materials.js';
import * as G from './geo.js';

// ---------- modelling helpers ----------
const sh = m => { m.castShadow = true; m.receiveShadow = true; return m; };
export function box(p, w, h, d, mat, x = 0, y = 0, z = 0, ry = 0) { const m = sh(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)); m.position.set(x, y, z); m.rotation.y = ry; p.add(m); return m; }
export function cyl(p, rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 10) { const m = sh(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat)); m.position.set(x, y, z); p.add(m); return m; }
function sphere(p, r, mat, x, y, z, ws = 10) { const m = sh(new THREE.Mesh(new THREE.SphereGeometry(r, ws, Math.max(6, ws * 0.6)), mat)); m.position.set(x, y, z); p.add(m); return m; }
function cone(p, r, h, mat, x, y, z, seg = 10) { const m = sh(new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat)); m.position.set(x, y, z); p.add(m); return m; }
// gable roof: two panels + gable-end triangles (wall material)
function gable(p, w, d, h, roofMat, wallMat, y, over = 0.45, thick = 0.16) {
  const half = w / 2 + over, slope = Math.hypot(half, h), ang = Math.atan2(h, half);
  for (const s of [-1, 1]) { const r = box(p, slope, thick, d + over * 2, roofMat, s * half / 2, y + h / 2, 0); r.rotation.z = -s * ang; }
  if (wallMat) {
    const shp = new THREE.Shape(); shp.moveTo(-w / 2, 0); shp.lineTo(w / 2, 0); shp.lineTo(0, h * (w / 2) / half); shp.closePath();
    const eg = new THREE.ExtrudeGeometry(shp, { depth: d, bevelEnabled: false }); eg.translate(0, 0, -d / 2);
    const tri = sh(new THREE.Mesh(eg, wallMat)); tri.position.y = y; p.add(tri);
  }
  box(p, 0.22, 0.22, d + over * 2 + 0.05, M.woodDark, 0, y + h + 0.02, 0);
}
function windowAt(p, x, y, z, ry = 0, w = 0.9, h = 1.0, lvl = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; p.add(g);
  box(g, w + 0.18, h + 0.18, 0.1, M.woodPaintCream, 0, 0, 0);
  box(g, w, h, 0.12, M.window, 0, 0, 0.02);
  box(g, 0.06, h, 0.14, M.woodPaintCream, 0, 0, 0.03); box(g, w, 0.06, 0.14, M.woodPaintCream, 0, 0, 0.03);
  box(g, w + 0.3, 0.08, 0.25, M.woodDark, 0, -h / 2 - 0.08, 0.1);
  if (lvl >= 2) { box(g, w + 0.1, 0.22, 0.3, M.woodPaintRed, 0, -h / 2 - 0.25, 0.2); for (let i = 0; i < 4; i++) sphere(g, 0.1, [M.pink, M.yellow, M.red, M.white][i], -w / 2 + 0.15 + i * (w - 0.3) / 3, -h / 2 - 0.08, 0.22, 6); }
  return g;
}
function door(p, x, z, ry = 0, mat = M.woodDark, w = 0.9, h = 1.8) { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; p.add(g); box(g, w + 0.2, h + 0.15, 0.1, M.woodPaintCream, 0, h / 2, 0); box(g, w, h, 0.14, mat, 0, h / 2, 0.02); sphere(g, 0.05, M.brass, w * 0.35, h / 2, 0.12, 6); return g; }
function chimney(p, x, y, z, h = 1.6) { box(p, 0.6, h, 0.6, M.stone, x, y + h / 2, z); box(p, 0.75, 0.15, 0.75, M.stoneDark, x, y + h, z); return new THREE.Vector3(x, y + h + 0.2, z); }
function foundation(p, w, d, mat = M.stone) { box(p, w, 1.6, d, mat, 0, -0.62, 0); }
function lanternHang(p, x, y, z) { cyl(p, 0.015, 0.015, 0.4, M.metal, x, y + 0.2, z, 4); const l = box(p, 0.22, 0.3, 0.22, M.lamp, x, y - 0.1, z); box(p, 0.28, 0.06, 0.28, M.metal, x, y + 0.08, z); return l; }
const labelCache = {};
export function label(text, bg = '#f1e3c4', fg = '#4a3423', w = 2, h = 0.5) {
  const key = text + bg + fg;
  if (!labelCache[key]) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 512, 128); g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(10, 10, 492, 108);
    g.fillStyle = fg; g.font = '700 58px "Fraunces", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 68);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; labelCache[key] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
  }
  return sh(new THREE.Mesh(new THREE.PlaneGeometry(w, h), labelCache[key]));
}
function signBoard(p, text, x, y, z, ry = 0, w = 2, h = 0.5, bg, fg) { const l = label(text, bg, fg, w, h); l.position.set(x, y, z); l.rotation.y = ry; p.add(l); box(p, w + 0.12, h + 0.12, 0.06, M.woodDark, x - Math.sin(ry) * 0.04, y, z - Math.cos(ry) * 0.04, ry); return l; }
function flowersPatch(p, cx, cz, w, d, n, palette = [M.pink, M.yellow, M.red, M.white, M.purple]) {
  const stemG = new THREE.CylinderGeometry(0.015, 0.02, 0.35, 3), headG = new THREE.IcosahedronGeometry(0.09, 0);
  for (let i = 0; i < n; i++) { const x = cx + (Math.random() - 0.5) * w, z = cz + (Math.random() - 0.5) * d; const s = new THREE.Mesh(stemG, M.leaf); s.position.set(x, 0.3, z); p.add(s); const hm = new THREE.Mesh(headG, palette[i % palette.length]); hm.position.set(x, 0.5, z); hm.scale.y = 0.6; p.add(hm); }
}
function shrub(p, x, z, s = 1, mat = M.hedge) { const m = sh(new THREE.Mesh(G.bushGeo(Math.floor(x * 13 + z * 7)), mat)); m.position.set(x, 0, z); m.scale.setScalar(s); p.add(m); return m; }
function table(p, x, z, umb = M.fabric) { cyl(p, 0.5, 0.5, 0.06, M.woodLight, x, 0.75, z, 12); cyl(p, 0.05, 0.05, 0.75, M.metal, x, 0.37, z, 6); for (const a of [0, Math.PI]) { box(p, 0.4, 0.06, 0.4, M.wood, x + Math.cos(a) * 0.75, 0.45, z + Math.sin(a) * 0.75); } if (umb) { cyl(p, 0.03, 0.03, 2.1, M.metal, x, 1.4, z, 5); const u = sh(new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.5, 8, 1, true), umb)); u.position.set(x, 2.35, z); p.add(u); } }
function lights(p, pts) { // string of fairy lights between points
  for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; for (let k = 0; k <= 6; k++) { const t = k / 6, sag = Math.sin(t * Math.PI) * 0.25; const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), M.bulbs); m.position.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag, a[2] + (b[2] - a[2]) * t); p.add(m); } }
}
// generic upgrade dressing: level 2 = potted plants & lanterns, level 3 = string lights & banner
function dress(p, def, lvl) {
  const [w, d] = def.size; if (lvl < 2 || def.cat === 'decor') return;
  const fz = d / 2 + 0.3;
  for (const s of [-1, 1]) { cyl(p, 0.22, 0.16, 0.35, M.brick, s * (w / 2 - 0.3), 0.18, fz, 8); shrub(p, s * (w / 2 - 0.3), fz, 0.45); }
  lanternHang(p, -w / 2 + 0.6, 2.2, d / 2 + 0.35);
  if (lvl >= 3) { lights(p, [[-w / 2, 2.6, d / 2 + 0.4], [0, 2.9, d / 2 + 0.6], [w / 2, 2.6, d / 2 + 0.4]]); const st = new THREE.Group(); st.position.set(w / 2 - 0.4, 0, d / 2 + 0.6); p.add(st); cyl(st, 0.04, 0.04, 2.6, M.metal, 0, 1.3, 0, 5); const fl = box(st, 0.7, 0.45, 0.03, M.roofGold, 0.37, 2.3, 0); }
}

// ---------- model builders ----------
const B = {};
B.home = (g, l) => { B.cabin(g, Math.max(l, 2)); const mb = new THREE.Group(); mb.position.set(2.9, 0, 2.6); g.add(mb); cyl(mb, 0.05, 0.05, 1.1, M.woodDark, 0, 0.55, 0, 5); box(mb, 0.35, 0.3, 0.5, M.red, 0, 1.2, 0); };
B.cabin = (g, l) => {
  foundation(g, 4.6, 4.6);
  box(g, 4.2, 2.6, 4, M.log, 0, 1.3, 0);
  for (const [x, z] of [[-2.1, -2], [2.1, -2], [-2.1, 2], [2.1, 2]]) box(g, 0.35, 2.7, 0.35, M.logDark, x, 1.35, z);
  gable(g, 4.2, 4, 1.7, l >= 3 ? M.roofGreen : M.roofRed, M.log, 2.6);
  box(g, 4.6, 0.18, 1.6, M.woodLight, 0, 0.1, 2.8); for (const s of [-1, 1]) cyl(g, 0.08, 0.08, 2.4, M.woodDark, s * 2.1, 1.2, 3.5, 6);
  const pr = box(g, 4.8, 0.12, 1.9, l >= 3 ? M.roofGreen : M.roofRed, 0, 2.5, 2.9); pr.rotation.x = 0.18;
  door(g, 0, 2.02); windowAt(g, -1.3, 1.5, 2.03, 0, 0.8, 0.8, l); windowAt(g, 2.12, 1.5, 0, Math.PI / 2, 0.8, 0.8, l); windowAt(g, -2.12, 1.5, 0, -Math.PI / 2, 0.8, 0.8, l);
  g.userData.smoke = chimney(g, 1.2, 3.1, -0.9, 1.4);
  if (l >= 3) { box(g, 2.2, 2.2, 2.8, M.log, -3.1, 1.1, -0.4); gable(g, 2.2, 2.8, 1.0, M.roofGreen, M.log, 2.2); g.children.slice(-4).forEach(m => m.position.x -= 3.1); windowAt(g, -3.1, 1.3, 1.02, 0, 0.6, 0.6, l); }
};
B.cafe = (g, l) => {
  foundation(g, 6.4, 5.2);
  box(g, 6, 2.8, 4.6, M.plaster, 0, 1.4, -0.2); box(g, 6.2, 0.3, 4.8, M.woodDark, 0, 0.15, -0.2); box(g, 6.2, 0.25, 4.8, M.woodDark, 0, 2.85, -0.2);
  gable(g, 6, 4.6, 1.6, M.roofGreen, M.plaster, 2.95);
  door(g, 0, 2.11, 0, M.woodPaintGreen); windowAt(g, -1.8, 1.4, 2.12, 0, 1.4, 1.2, l); windowAt(g, 1.8, 1.4, 2.12, 0, 1.4, 1.2, l);
  const aw = box(g, 6.4, 0.06, 1.4, M.fabricGreen, 0, 2.5, 2.7); aw.rotation.x = 0.35;
  signBoard(g, 'CAFÉ', 0, 3.55, 2.2, 0, 1.8, 0.5, '#2f5d45', '#f6efe0');
  table(g, -1.9, 4.2, M.fabricGreen); table(g, 1.9, 4.2, M.fabricGreen);
  g.userData.smoke = chimney(g, -2, 3.5, -1.4, 1.2);
};
B.shed = (g, l) => {
  foundation(g, 3.6, 3.4);
  box(g, 3.4, 2.3, 3.2, M.woodDark, 0, 1.15, 0);
  const r = box(g, 4, 0.15, 3.8, M.roofSlate, 0, 2.55, 0); r.rotation.x = 0.22;
  door(g, -0.45, 1.62, 0, M.wood, 0.85, 1.9); door(g, 0.45, 1.62, 0, M.wood, 0.85, 1.9);
  cyl(g, 0.35, 0.3, 0.9, M.woodLight, 2.1, 0.45, 1.0, 10); box(g, 0.7, 0.7, 0.7, M.woodLight, 2.1, 0.35, -0.2);
  for (let i = 0; i < 3; i++) { const lg = cyl(g, 0.16, 0.16, 1.4, M.log, -2.1, 0.18 + i * 0.3, 0.3 - i * 0.05, 8); lg.rotation.x = Math.PI / 2; }
};
B.garden = (g, l) => {
  box(g, 5.6, 0.25, 5.6, M.soil, 0, 0.05, 0);
  for (let i = 0; i < 4; i++) flowersPatch(g, (i % 2 ? 1.3 : -1.3), (i < 2 ? 1.3 : -1.3), 2, 2, 16 + l * 6);
  const n = 10; for (let s = 0; s < 4; s++) for (let i = 0; i <= n; i++) { if (s === 0 && i > 3 && i < 7) continue; const t = i / n * 6 - 3; const [x, z] = s === 0 ? [t, 3] : s === 1 ? [t, -3] : s === 2 ? [3, t] : [-3, t]; box(g, 0.12, 0.7, 0.12, M.white, x, 0.35, z); }
  const ar = new THREE.Group(); ar.position.set(0, 0, 3); g.add(ar); box(ar, 0.12, 2.2, 0.12, M.white, -0.9, 1.1, 0); box(ar, 0.12, 2.2, 0.12, M.white, 0.9, 1.1, 0);
  const t = sh(new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.07, 6, 16, Math.PI), M.white)); t.position.y = 2.2; ar.add(t);
  for (let i = 0; i < 9; i++) { const a = i / 8 * Math.PI; sphere(ar, 0.14, i % 2 ? M.pink : M.leaf, Math.cos(a) * 0.9, 2.2 + Math.sin(a) * 0.9, 0, 6); }
  if (l >= 2) { cyl(g, 0.5, 0.6, 0.5, M.stone, 0, 0.25, 0, 12); cyl(g, 0.45, 0.45, 0.05, M.poolwater, 0, 0.5, 0, 12); }
};
B.restaurant = (g, l) => {
  foundation(g, 8.4, 6.4);
  box(g, 8, 1.2, 6, M.stone, 0, 0.6, 0); box(g, 8, 2.2, 6, M.wood, 0, 2.3, 0);
  gable(g, 8, 6, 2.2, M.roofBrown, M.wood, 3.4);
  for (let i = -1; i <= 1; i++) windowAt(g, i * 2.4, 2.1, 3.02, 0, 1.4, 1.4, l);
  door(g, -3.2, 3.02, 0, M.woodPaintRed, 1.1, 2); signBoard(g, 'RESTAURANT', 0, 3.25, 3.15, 0, 3, 0.55, '#7a2f22', '#f6e7c8');
  box(g, 8.6, 0.25, 3, M.woodLight, 0, 0.12, 4.5); table(g, -2, 4.6, M.fabric); table(g, 2, 4.6, M.fabric);
  g.userData.smoke = chimney(g, 2.6, 4.5, -1.5, 1.6);
};
B.bakery = (g, l) => {
  foundation(g, 5.6, 5.2);
  box(g, 5.2, 2.7, 4.8, M.brick, 0, 1.35, 0); gable(g, 5.2, 4.8, 1.8, M.roofRed, M.brick, 2.7);
  door(g, 1.4, 2.42, 0, M.woodPaintCream); windowAt(g, -1.2, 1.4, 2.42, 0, 1.8, 1.2, l);
  const aw = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.4, 10, 1, true, 0, Math.PI), M.fabric)); aw.rotation.z = Math.PI / 2; aw.position.set(-1.2, 2.3, 2.5); g.add(aw);
  signBoard(g, 'BAKERY', 0, 3.3, 2.5, 0, 2, 0.5, '#e9c48a', '#5a3218');
  const br = sh(new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.5, 4, 8), M.orange)); br.rotation.z = Math.PI / 2; br.position.set(2.2, 3.3, 2.5); g.add(br);
  g.userData.smoke = chimney(g, -1.6, 3.6, -1, 1.5);
};
B.giftshop = (g, l) => {
  foundation(g, 5.4, 4.6);
  box(g, 5, 2.6, 4.2, M.woodPaintBlue, 0, 1.3, 0); gable(g, 5, 4.2, 1.6, M.roofTeal, M.woodPaintBlue, 2.6);
  door(g, 1.3, 2.12, 0, M.woodPaintCream); windowAt(g, -1.0, 1.3, 2.12, 0, 1.8, 1.4, l);
  const hs = new THREE.Group(); hs.position.set(2.7, 2.4, 2.2); g.add(hs); box(hs, 0.9, 0.05, 0.05, M.metal, 0.45, 0.2, 0); signBoard(hs, 'GIFTS', 0.6, -0.2, 0, Math.PI / 2, 1, 0.4, '#f6efe0', '#3d6ea8');
  for (let i = 0; i < 3; i++) box(g, 0.4, 0.4, 0.4, [M.red, M.yellow, M.mint][i], -1.6 + i * 0.6, 0.2, 2.6);
};
B.teahouse = (g, l) => {
  box(g, 7, 0.8, 7, M.woodDark, 0, 0.1, 0); for (const [x, z] of [[-3.3, -3.3], [3.3, -3.3], [-3.3, 3.3], [3.3, 3.3]]) cyl(g, 0.14, 0.14, 3.2, M.woodDark, x, 1.9, z, 8);
  box(g, 5.6, 2.2, 5.6, M.plaster, 0, 1.6, 0);
  for (let i = -2; i <= 2; i++) { box(g, 0.08, 2.2, 0.08, M.woodDark, i * 1.1, 1.6, 2.82); box(g, 0.08, 2.2, 0.08, M.woodDark, 2.82, 1.6, i * 1.1); box(g, 0.08, 2.2, 0.08, M.woodDark, -2.82, 1.6, i * 1.1); }
  box(g, 5.7, 0.08, 0.08, M.woodDark, 0, 1.6, 2.83);
  gable(g, 8.6, 8.6, 1.4, M.roofSlate, null, 3.3, 0.2); gable(g, 4.4, 4.4, 1.2, M.roofSlate, M.plaster, 4.6, 0.3);
  for (const x of [-3.4, 3.4]) lanternHang(g, x, 3.0, 3.6);
  box(g, 2, 0.15, 1.2, M.woodLight, 0, 0.55, 4.0);
};
B.icecream = (g, l) => {
  cyl(g, 1.7, 1.8, 1.1, M.pink, 0, 0.55, 0, 16); cyl(g, 1.85, 1.85, 0.12, M.white, 0, 1.15, 0, 16);
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; cyl(g, 0.06, 0.06, 1.5, M.white, Math.cos(a) * 1.6, 1.9, Math.sin(a) * 1.6, 6); }
  const rf = sh(new THREE.Mesh(new THREE.ConeGeometry(2.2, 0.8, 16), M.mint)); rf.position.y = 3.0; g.add(rf);
  const cn = cone(g, 0.45, 1.3, M.orange, 0, 3.6, 0, 10); cn.rotation.x = Math.PI; cn.position.y = 4.0;
  sphere(g, 0.55, M.pink, 0, 4.8, 0, 12); sphere(g, 0.45, M.white, 0.1, 5.4, 0, 12); sphere(g, 0.12, M.red, 0.1, 5.9, 0, 8);
  for (let i = 0; i < 2; i++) table(g, -2.6 + i * 5.2, 2.2, i ? M.fabricBlue : M.fabric);
};
B.grocery = (g, l) => {
  foundation(g, 7.4, 5.4);
  box(g, 7, 2.8, 5, M.woodPaintGreen, 0, 1.4, 0); gable(g, 7, 5, 1.7, M.roofBrown, M.woodPaintGreen, 2.8);
  door(g, 0, 2.52, 0, M.woodPaintCream, 1.3, 2); windowAt(g, -2.3, 1.5, 2.52, 0, 1.6, 1.2, l); windowAt(g, 2.3, 1.5, 2.52, 0, 1.6, 1.2, l);
  const aw = box(g, 7.2, 0.06, 1.5, M.fabric, 0, 2.4, 3.1); aw.rotation.x = 0.35;
  signBoard(g, 'GROCERY', 0, 3.35, 2.6, 0, 2.4, 0.5, '#f6efe0', '#3f6a3a');
  for (let i = 0; i < 4; i++) { box(g, 0.9, 0.5, 0.7, M.woodLight, -2.7 + i * 1.8, 0.25, 3.4); for (let k = 0; k < 5; k++) sphere(g, 0.13, [M.red, M.orange, M.yellow, M.leaf][i], -3 + i * 1.8 + (k % 3) * 0.25, 0.6, 3.25 + Math.floor(k / 3) * 0.3, 6); }
};
B.lodge = (g, l) => {
  foundation(g, 9.4, 6.4);
  box(g, 9, 2.6, 6, M.log, 0, 1.3, 0); box(g, 9, 2.4, 6, M.logDark, 0, 3.8, 0);
  gable(g, 9, 6, 2.4, M.roofGreen, M.logDark, 5.0);
  box(g, 9.4, 0.18, 1.4, M.woodLight, 0, 2.75, 3.6); for (let i = -4; i <= 4; i++) box(g, 0.08, 0.9, 0.08, M.woodDark, i * 1.1, 3.2, 4.25); box(g, 9.2, 0.1, 0.1, M.woodDark, 0, 3.65, 4.25);
  for (let i = -1; i <= 1; i++) { windowAt(g, i * 2.8, 1.4, 3.02, 0, 1, 1, l); windowAt(g, i * 2.8 + 1.4, 3.8, 3.02, 0, 0.9, 1, l); }
  door(g, -1.4, 3.02, 0, M.woodPaintRed, 1.2, 2); signBoard(g, 'GUEST LODGE', 0, 5.6, 3.1, 0, 2.6, 0.5, '#2f4a35', '#f6efe0');
  g.userData.smoke = chimney(g, 3.2, 6.0, -1.5, 1.5); chimney(g, -3.2, 6.0, -1.5, 1.5);
};
B.luxcabin = (g, l) => {
  foundation(g, 6.4, 5.4, M.stoneDark);
  const sh2 = new THREE.Shape(); sh2.moveTo(-3, 0); sh2.lineTo(3, 0); sh2.lineTo(0, 5); sh2.closePath();
  const ex = new THREE.ExtrudeGeometry(sh2, { depth: 4.6, bevelEnabled: false }); ex.translate(0, 0, -2.6);
  const body = new THREE.Mesh(ex, M.woodDark); sh(body); g.add(body);
  for (const s of [-1, 1]) { const r = box(g, 6.1, 0.2, 5.2, M.roofSlate, s * 1.45, 2.55, -0.3); r.rotation.z = -s * Math.atan2(5, 3); }
  const gl = new THREE.Shape(); gl.moveTo(-2.6, 0.1); gl.lineTo(2.6, 0.1); gl.lineTo(0, 4.4); gl.closePath();
  const gm = new THREE.Mesh(new THREE.ShapeGeometry(gl), M.window); gm.position.z = 2.02; g.add(gm);
  for (let i = -2; i <= 2; i++) box(g, 0.08, 4.4 - Math.abs(i) * 1.6, 0.06, M.metal, i * 1.0, (4.4 - Math.abs(i) * 1.6) / 2, 2.06);
  box(g, 6.4, 0.2, 2.4, M.woodLight, 0, 0.1, 3.2);
  cyl(g, 0.9, 0.9, 0.6, M.wood, 2.2, 0.4, 3.4, 14); cyl(g, 0.8, 0.8, 0.05, M.hotwater, 2.2, 0.68, 3.4, 14);
  g.userData.steam = new THREE.Vector3(2.2, 0.9, 3.4);
  g.userData.smoke = chimney(g, -1.6, 2.5, -1.8, 2.6);
};
B.camping = (g, l) => {
  for (const [x, z, m] of [[-2.8, -2, M.canvasOrange], [2.8, -2.3, M.canvasTent], [0, 2.6, M.fabricGreen]]) {
    const t = new THREE.Group(); t.position.set(x, 0, z); t.rotation.y = Math.atan2(-x, -z); g.add(t);
    const sh3 = new THREE.Shape(); sh3.moveTo(-1.2, 0); sh3.lineTo(1.2, 0); sh3.lineTo(0, 1.6); sh3.closePath();
    const tg = new THREE.Mesh(new THREE.ExtrudeGeometry(sh3, { depth: 2.4, bevelEnabled: false }), m); tg.geometry.translate(0, 0, -1.2); sh(tg); t.add(tg);
    box(t, 0.7, 1.0, 0.02, M.dark, 0, 0.5, 1.21);
  }
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28; const s = sh(new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), M.stoneDark)); s.position.set(Math.cos(a) * 0.55, 0.1, Math.sin(a) * 0.55 - 0.2); g.add(s); }
  const f = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 7), new THREE.MeshBasicMaterial({ color: 0xffa040 })); f.position.set(0, 0.35, -0.2); g.add(f); g.userData.fire = f;
  for (const a of [0.6, 2.6, 4.4]) { const lg = cyl(g, 0.22, 0.22, 1.4, M.log, Math.cos(a) * 1.6, 0.22, Math.sin(a) * 1.6 - 0.2, 8); lg.rotation.z = Math.PI / 2; lg.rotation.y = -a + Math.PI / 2; }
  if (l >= 2) lights(g, [[-2.8, 1.7, -2], [0, 2.2, -0.2], [2.8, 1.7, -2.3]]);
};
B.hotspring = (g, l) => {
  for (let i = 0; i < 18; i++) { const a = i / 18 * 6.28; const s = sh(new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + (i % 3) * 0.15, 0), M.stone)); s.position.set(Math.cos(a) * 3, 0.25, Math.sin(a) * 3); s.rotation.y = i; g.add(s); }
  cyl(g, 2.9, 2.9, 0.1, M.hotwater, 0, 0.32, 0, 24);
  g.userData.steam = new THREE.Vector3(0, 0.5, 0);
  const hut = new THREE.Group(); hut.position.set(-2.8, 0, -3.0); g.add(hut); box(hut, 2.4, 2.2, 1.8, M.woodLight, 0, 1.1, 0); gable(hut, 2.4, 1.8, 0.9, M.roofSlate, M.woodLight, 2.2);
  for (let i = 0; i < 10; i++) cyl(g, 0.07, 0.07, 1.8, M.woodLight, 0.5 + i * 0.32, 0.9, -3.8, 6);
  for (const x of [-3.6, 3.6]) lanternHang(g, x, 1.6, 2.4), cyl(g, 0.04, 0.04, 1.9, M.metal, x, 0.95, 2.4, 5);
};
B.tower = (g, l) => {
  for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) { const p = cyl(g, 0.16, 0.2, 9, M.logDark, x * 0.85, 4.5, z * 0.85, 8); }
  for (let k = 1; k < 4; k++) for (const ry of [0, Math.PI / 2]) { const br = box(g, 0.12, 3.6, 0.12, M.wood, 0, k * 2.4 - 0.4, 0, ry); br.position.set(ry ? 1.36 : 0, k * 2.4 - 0.4, ry ? 0 : 1.36); br.rotation.set(0, ry, 0.75); }
  box(g, 4.2, 0.25, 4.2, M.woodLight, 0, 9, 0);
  for (let i = -2; i <= 2; i++) for (const [x, z] of [[i, 2], [i, -2], [2, i], [-2, i]]) cyl(g, 0.05, 0.05, 1, M.woodDark, x, 9.6, z, 5);
  for (const [w, d, x, z] of [[4.1, 0.1, 0, 2], [4.1, 0.1, 0, -2], [0.1, 4.1, 2, 0], [0.1, 4.1, -2, 0]]) box(g, w, 0.1, d, M.wood, x, 10.1, z);
  cyl(g, 0.1, 0.1, 2.4, M.woodDark, 0, 10.2, 0, 6); const rf = cone(g, 3, 1.4, M.roofRed, 0, 12, 0, 4); rf.rotation.y = Math.PI / 4;
  const tel = new THREE.Group(); tel.position.set(1.2, 10.1, 1.2); g.add(tel); cyl(tel, 0.03, 0.05, 0.9, M.metal, 0, 0.45, 0, 5); const tb = cyl(tel, 0.09, 0.12, 0.8, M.brass, 0, 0.95, 0, 8); tb.rotation.x = 1.2;
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28 * 2.2; box(g, 1.1, 0.1, 0.5, M.woodLight, Math.cos(a) * 0.7, 0.4 + i * 0.72, Math.sin(a) * 0.7, -a); }
};
B.resort = (g, l) => {
  foundation(g, 11.4, 8.4);
  box(g, 11, 3, 6, M.woodPaintCream, 0, 1.5, -1); box(g, 11, 2.6, 6, M.woodPaintCream, 0, 4.3, -1);
  gable(g, 11, 6, 2.2, M.roofBlue, M.woodPaintCream, 5.6);
  box(g, 4, 2.8, 4, M.woodPaintCream, -4, 1.4, 3); gable(g, 4, 4, 1.4, M.roofBlue, M.woodPaintCream, 2.8); g.children.slice(-4).forEach(m => { m.position.x -= 4; m.position.z += 3; });
  for (let i = -2; i <= 2; i++) { windowAt(g, i * 2.1, 1.6, 2.02, 0, 1, 1.2, l); windowAt(g, i * 2.1, 4.3, 2.02, 0, 1, 1.1, l); }
  box(g, 7, 0.2, 3.6, M.woodLight, 2, 2.9, 3.8); for (let i = 0; i < 8; i++) box(g, 0.07, 0.9, 0.07, M.white, -1.4 + i, 3.4, 5.55); box(g, 7, 0.08, 0.08, M.white, 2, 3.85, 5.55);
  for (const [x, z] of [[-1.3, 5.5], [5.4, 5.5], [-1.3, 2.1], [5.4, 2.1]]) cyl(g, 0.12, 0.12, 2.9, M.white, x, 1.45, z, 8);
  signBoard(g, 'LAKESIDE RESORT', 0, 6.3, 2.05, 0, 3.4, 0.5, '#2c4f73', '#f3ecd8');
  table(g, 3, 3.8, M.fabricBlue);
};
B.greenhouse = (g, l) => {
  box(g, 6.4, 0.5, 4.4, M.brick, 0, 0.25, 0);
  box(g, 6.2, 2.2, 4.2, M.glass, 0, 1.6, 0);
  for (let i = -3; i <= 3; i++) { box(g, 0.08, 2.3, 0.08, M.metal, i, 1.6, 2.1); box(g, 0.08, 2.3, 0.08, M.metal, i, 1.6, -2.1); }
  const half = 2.2, h = 1.3, ang = Math.atan2(h, half), sl = Math.hypot(half, h);
  for (const s of [-1, 1]) { const r = box(g, 6.3, 0.05, sl, M.glass, 0, 2.7 + h / 2, s * half / 2); r.rotation.x = s * ang; }
  for (let i = -3; i <= 3; i++) for (const s of [-1, 1]) { const r = box(g, 0.07, 0.07, sl, M.metal, i, 2.72 + h / 2, s * half / 2); r.rotation.x = s * ang; }
  box(g, 6.3, 0.1, 0.1, M.metal, 0, 2.7 + h, 0);
  for (let i = 0; i < 2; i++) { box(g, 5, 0.7, 1, M.woodLight, 0, 0.85, i ? 1 : -1); flowersPatch(g, 0, i ? 1 : -1, 4.6, 0.8, 18, [M.leaf, M.pink, M.leaf, M.yellow]); g.children.slice(-36).forEach(m => m.position.y += 0.85); }
};
B.botanical = (g, l) => {
  box(g, 11.6, 0.2, 11.6, M.stone, 0, 0.05, 0);
  for (const s of [-1, 1]) for (const ax of [0, 1]) for (const k of [-1, 1]) { const m = box(g, ax ? 0.8 : 4.4, 1.3, ax ? 4.4 : 0.8, M.hedge, 0, 0.75, 0); if (ax) m.position.set(s * 5.4, 0.75, k * 3.2); else m.position.set(k * 3.2, 0.75, s * 5.4); }
  for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) { cyl(g, 1.2, 1.3, 0.35, M.brick, x, 0.3, z, 14); flowersPatch(g, x, z, 1.8, 1.8, 14 + l * 4, [M.purple, M.pink, M.white, M.yellow, M.red]); }
  const dome = sh(new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.glass)); dome.position.y = 0.4; g.add(dome);
  for (let i = 0; i < 8; i++) { const r = sh(new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.04, 4, 20, Math.PI), M.copper)); r.rotation.y = i / 8 * Math.PI; r.position.y = 0.4; g.add(r); }
  const plant = new THREE.Mesh(G.bushGeo(5), M.leaf); plant.position.y = 0.4; plant.scale.setScalar(1.4); g.add(plant);
  signBoard(g, 'BOTANICAL GARDEN', 0, 1.9, 5.9, 0, 3.2, 0.5, '#f3ecd8', '#3f6a3a'); for (const x of [-1.7, 1.7]) cyl(g, 0.06, 0.06, 1.9, M.woodDark, x, 0.95, 5.85, 5);
};
B.nursery = (g, l) => {
  box(g, 3, 2.2, 2.6, M.woodLight, -1.4, 1.1, -1.4); const r = box(g, 3.4, 0.12, 3, M.roofGreen, -1.4, 2.35, -1.4); r.rotation.x = 0.2;
  for (let row = 0; row < 3; row++) { box(g, 2.4, 0.08, 0.8, M.wood, 1.6, 0.8, -1.8 + row * 1.4); for (const s of [-1, 1]) cyl(g, 0.04, 0.04, 0.8, M.woodDark, 1.6 + s * 1.1, 0.4, -1.8 + row * 1.4, 4); for (let k = 0; k < 4; k++) { cyl(g, 0.14, 0.1, 0.22, M.brick, 0.8 + k * 0.55, 0.95, -1.8 + row * 1.4, 8); sphere(g, 0.16, [M.pink, M.leaf, M.yellow, M.purple][(k + row) % 4], 0.8 + k * 0.55, 1.18, -1.8 + row * 1.4, 7); } }
  signBoard(g, 'NURSERY', -1.4, 1.7, -0.08, 0, 1.6, 0.4, '#f3ecd8', '#3f6a3a');
  for (let i = 0; i < 4; i++) { cyl(g, 0.3, 0.25, 0.45, M.brick, -2.4 + i * 0.8, 0.22, 1.8, 10); shrub(g, -2.4 + i * 0.8, 1.8, 0.5, M.leaf); }
};
B.fishdock = (g, l) => {
  box(g, 3, 0.2, 9, M.woodLight, 0, 0.55, 2.2); for (let i = 0; i < 5; i++) for (const s of [-1, 1]) cyl(g, 0.12, 0.12, 3.4, M.woodDark, s * 1.4, -0.9, -1.8 + i * 2, 6);
  for (let i = 0; i < 9; i++) box(g, 3, 0.04, 0.04, M.woodDark, 0, 0.66, -2 + i);
  box(g, 1.8, 1.8, 1.6, M.woodDark, 0, 1.55, -1.4); const r = box(g, 2.2, 0.1, 2, M.roofRed, 0, 2.6, -1.4); r.rotation.x = 0.2;
  for (const s of [-1, 1]) { const rod = cyl(g, 0.02, 0.03, 2.4, M.woodDark, s * 1.3, 1.6, 6, 4); rod.rotation.x = 0.7; }
  cyl(g, 0.22, 0.18, 0.35, M.metal, 0.8, 0.8, 5, 10);
  const bt = new THREE.Group(); bt.position.set(-2.4, 0.15, 4.5); g.add(bt); const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 2.8, 12, 1, true, 0, Math.PI), new THREE.MeshStandardMaterial({ map: TEX.planks, color: 0x6f9cc0, side: THREE.DoubleSide })); hull.rotation.set(Math.PI, 0, Math.PI / 2); hull.rotation.y = Math.PI / 2; bt.add(hull); g.userData.boat = bt;
};
B.visitor = (g, l) => {
  foundation(g, 7.4, 5.4);
  box(g, 7, 2.9, 5, M.woodLight, 0, 1.45, 0); box(g, 7.1, 0.5, 5.1, M.stone, 0, 0.25, 0);
  gable(g, 7, 5, 1.8, M.roofGreen, M.woodLight, 2.9);
  door(g, 0, 2.52, 0, M.woodPaintGreen, 1.4, 2.1); windowAt(g, -2.3, 1.6, 2.52, 0, 1.4, 1.2, l); windowAt(g, 2.3, 1.6, 2.52, 0, 1.4, 1.2, l);
  signBoard(g, 'VISITOR CENTER', 0, 3.35, 2.6, 0, 3, 0.5, '#2f5d45', '#f6efe0');
  const mb = new THREE.Group(); mb.position.set(3, 0, 3.6); g.add(mb); for (const s of [-1, 1]) cyl(mb, 0.06, 0.06, 1.6, M.woodDark, s * 0.8, 0.8, 0, 5); box(mb, 1.8, 1.1, 0.08, M.woodPaintCream, 0, 1.4, 0);
  const fp = cyl(g, 0.05, 0.06, 6, M.metal, -3.4, 3, 3.4, 6); const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), new THREE.MeshStandardMaterial({ color: 0x3f7d58, side: THREE.DoubleSide })); fl.position.set(-2.8, 5.6, 3.4); g.add(fl); g.userData.flag = fl;
};
B.hall = (g, l) => {
  foundation(g, 9.4, 7.4);
  box(g, 9, 3.4, 7, M.woodPaintRed, 0, 1.7, 0); box(g, 9.2, 0.6, 7.2, M.stone, 0, 0.3, 0);
  gable(g, 9, 7, 3, M.roofSlate, M.woodPaintRed, 3.4);
  for (let i = -1; i <= 1; i += 2) windowAt(g, i * 2.8, 2, 3.52, 0, 1.3, 1.8, l);
  door(g, 0, 3.52, 0, M.woodPaintCream, 1.8, 2.4);
  const tw = new THREE.Group(); tw.position.set(0, 6.4, 0.6); g.add(tw); box(tw, 1.6, 2, 1.6, M.white, 0, 1, 0); const tr = cone(tw, 1.4, 1.8, M.roofSlate, 0, 2.9, 0, 4); tr.rotation.y = Math.PI / 4;
  const clk = cyl(tw, 0.5, 0.5, 0.06, M.white, 0, 1.2, 0.82, 16); clk.rotation.x = Math.PI / 2; box(tw, 0.05, 0.35, 0.03, M.dark, 0, 1.32, 0.86); box(tw, 0.25, 0.05, 0.03, M.dark, 0.1, 1.2, 0.86);
  signBoard(g, 'COMMUNITY HALL', 0, 4.2, 3.6, 0, 3, 0.5, '#f6efe0', '#7a2f22');
};
B.stage = (g, l) => {
  box(g, 8, 1, 5, M.woodDark, 0, 0.5, -0.5); box(g, 8.2, 0.12, 5.2, M.woodLight, 0, 1.05, -0.5);
  for (let i = 0; i < 3; i++) box(g, 3, 0.25, 0.5, M.woodLight, 0, 0.12 + i * 0.3, 2.3 - i * 0.4);
  const arch = sh(new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 5, 18, 1, true, -Math.PI / 2, Math.PI), M.woodPaintCream)); arch.rotation.z = Math.PI / 2; arch.rotation.y = Math.PI / 2; arch.position.set(0, 1.1, -0.5); arch.material.side = THREE.DoubleSide; g.add(arch);
  box(g, 8, 0.1, 0.1, M.woodDark, 0, 1.1, 2); box(g, 7.6, 3.4, 0.1, M.fabricBlue, 0, 2.8, -2.9);
  for (const s of [-1, 1]) { box(g, 0.8, 1.4, 0.7, M.dark, s * 4.6, 0.7, 1); cyl(g, 0.25, 0.25, 0.05, M.metal, s * 4.6, 1.0, 1.36, 12).rotation.x = Math.PI / 2; }
  lights(g, [[-3.9, 4.4, 2], [0, 4.9, 2.1], [3.9, 4.4, 2]]);
};
B.playground = (g, l) => {
  box(g, 7.6, 0.15, 7.6, M.soil, 0, 0.05, 0);
  const sw = new THREE.Group(); sw.position.set(-2, 0, -1.5); g.add(sw);
  for (const s of [-1, 1]) { const a = cyl(sw, 0.06, 0.06, 2.8, M.red, s * 1.6, 1.3, 0.5, 6); a.rotation.x = 0.35; const b = cyl(sw, 0.06, 0.06, 2.8, M.red, s * 1.6, 1.3, -0.5, 6); b.rotation.x = -0.35; }
  const bar = cyl(sw, 0.06, 0.06, 3.4, M.red, 0, 2.6, 0, 6); bar.rotation.z = Math.PI / 2;
  for (const x of [-0.7, 0.7]) { const seat = new THREE.Group(); seat.position.set(x, 2.6, 0); sw.add(seat); cyl(seat, 0.01, 0.01, 1.9, M.metal, -0.2, -0.95, 0, 3); cyl(seat, 0.01, 0.01, 1.9, M.metal, 0.2, -0.95, 0, 3); box(seat, 0.5, 0.06, 0.25, M.yellow, 0, -1.9, 0); (g.userData.swings ||= []).push(seat); }
  const sl = new THREE.Group(); sl.position.set(2.2, 0, 1.4); g.add(sl); box(sl, 1.2, 1.6, 1.2, M.blue, 0, 0.8, -1.2); const s2 = box(sl, 0.9, 0.08, 2.8, M.yellow, 0, 0.85, 0.4); s2.rotation.x = 0.6; for (let i = 0; i < 5; i++) box(sl, 0.9, 0.06, 0.15, M.red, 0, 0.3 * i + 0.2, -1.95);
  box(g, 2, 0.3, 2, M.woodLight, -2, 0.15, 2.2); box(g, 1.7, 0.1, 1.7, M.yellow, -2, 0.28, 2.2);
  const ss = new THREE.Group(); ss.position.set(2, 0.45, -2.2); g.add(ss); box(ss, 0.3, 0.5, 0.3, M.red, 0, -0.2, 0); const pl = box(ss, 3, 0.1, 0.3, M.blue, 0, 0.08, 0); g.userData.seesaw = pl;
};
// ---------- decorations ----------
B.tree = (g) => { const v = G.oakGeo(101); const t = new THREE.Mesh(v.trunk, M.trunkMat || M.woodDark); const lf = new THREE.Mesh(v.leaves, M.oakLeaf || M.leaf); sh(t); sh(lf); g.add(t, lf); g.scale.setScalar(0.9); };
B.pine = (g) => { const v = G.pineGeo(301); const t = new THREE.Mesh(v.trunk, M.trunkMat || M.woodDark); const lf = new THREE.Mesh(v.leaves, M.pineLeaf || M.leaf); sh(t); sh(lf); g.add(t, lf); g.scale.setScalar(0.9); };
B.flowerbed = (g) => { box(g, 1.9, 0.3, 1.9, M.woodDark, 0, 0.15, 0); box(g, 1.7, 0.32, 1.7, M.soil, 0, 0.18, 0); flowersPatch(g, 0, 0, 1.5, 1.5, 22); };
B.bench = (g) => { box(g, 1.8, 0.08, 0.5, M.wood, 0, 0.5, 0); box(g, 1.8, 0.45, 0.06, M.wood, 0, 0.82, -0.24); for (const s of [-1, 1]) { box(g, 0.08, 0.5, 0.5, M.metal, s * 0.8, 0.25, 0); box(g, 0.08, 0.06, 0.5, M.metal, s * 0.85, 0.7, 0); } };
B.lamp = (g) => { cyl(g, 0.08, 0.12, 2.8, M.metal, 0, 1.4, 0, 8); cyl(g, 0.2, 0.25, 0.15, M.metal, 0, 0.07, 0, 8); box(g, 0.34, 0.45, 0.34, M.lamp, 0, 3.0, 0); const c = cone(g, 0.32, 0.3, M.metal, 0, 3.38, 0, 4); c.rotation.y = Math.PI / 4; g.userData.light = new THREE.Vector3(0, 3, 0); };
B.fence = (g) => { for (let i = 0; i < 4; i++) box(g, 0.12, 0.9, 0.12, M.woodLight, -1.35 + i * 0.9, 0.45, 0); for (const y of [0.35, 0.7]) box(g, 2.9, 0.1, 0.06, M.woodLight, 0, y, 0.06); };
B.sign = (g) => { cyl(g, 0.07, 0.08, 1.6, M.woodDark, 0, 0.8, 0, 6); signBoard(g, 'EVERGREEN', 0, 1.55, 0.06, 0, 1.6, 0.45, '#f1e3c4', '#3f6a3a'); };
B.path = (g) => { const r = Math.random; box(g, 3, 0.08, 3, M.soil, 0, 0.02, 0); for (let i = 0; i < 9; i++) { const s = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.42 + r() * 0.12, 0.45, 0.12, 7), M.stone)); s.position.set(((i % 3) - 1) * 0.95 + (r() - 0.5) * 0.15, 0.08, (Math.floor(i / 3) - 1) * 0.95 + (r() - 0.5) * 0.15); s.rotation.y = r() * 3; g.add(s); } };
B.bridge = (g) => { for (let i = 0; i < 12; i++) box(g, 2.4, 0.16, 0.62, i % 2 ? M.wood : M.woodLight, 0, 0.6, -3.6 + i * 0.65); for (const s of [-1, 1]) { for (let i = 0; i < 5; i++) cyl(g, 0.07, 0.08, 1.1, M.woodDark, s * 1.15, 1.1, -3.6 + i * 1.8, 6); box(g, 0.1, 0.1, 7.6, M.wood, s * 1.15, 1.6, 0); for (const z of [-3.4, 3.4]) cyl(g, 0.2, 0.2, 3, M.woodDark, s * 1.15, -0.8, z, 6); } };
B.rock = (g) => { const m = sh(new THREE.Mesh(G.rockGeo(Math.floor(Math.random() * 1000)), M.stone)); m.scale.set(1, 0.9, 1); g.add(m); const m2 = sh(new THREE.Mesh(G.rockGeo(7), M.mossStone)); m2.scale.setScalar(0.5); m2.position.set(0.8, 0, 0.5); g.add(m2); };
B.fountain = (g) => { cyl(g, 1.5, 1.6, 0.6, M.stone, 0, 0.3, 0, 18); cyl(g, 1.35, 1.35, 0.05, M.poolwater, 0, 0.55, 0, 18); cyl(g, 0.25, 0.35, 1.4, M.stone, 0, 0.9, 0, 10); cyl(g, 0.6, 0.4, 0.2, M.stone, 0, 1.6, 0, 12); cyl(g, 0.5, 0.5, 0.04, M.poolwater, 0, 1.7, 0, 12); g.userData.jet = new THREE.Vector3(0, 1.75, 0); };
B.pond = (g) => { const w = new THREE.Mesh(new THREE.CircleGeometry(1.9, 24), M.poolwater); w.rotation.x = -Math.PI / 2; w.position.y = 0.06; g.add(w); box(g, 3.6, 0.05, 3.6, M.soil, 0, 0.0, 0).scale.set(1.1, 1, 1.1); for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28; const s = sh(new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + (i % 3) * 0.08, 0), i % 3 ? M.stone : M.mossStone)); s.position.set(Math.cos(a) * 2, 0.12, Math.sin(a) * 2); g.add(s); } for (let i = 0; i < 4; i++) { const lp = new THREE.Mesh(new THREE.CircleGeometry(0.25, 8), M.leaf); lp.rotation.x = -Math.PI / 2; lp.position.set(Math.cos(i * 2) * 1, 0.08, Math.sin(i * 2) * 1); g.add(lp); } };
B.bin = (g) => { cyl(g, 0.3, 0.26, 0.8, M.woodPaintGreen, 0, 0.4, 0, 10); cyl(g, 0.33, 0.33, 0.06, M.metal, 0, 0.82, 0, 10); };
B.birdhouse = (g) => { cyl(g, 0.05, 0.06, 2, M.woodDark, 0, 1, 0, 6); box(g, 0.5, 0.5, 0.5, M.woodPaintRed, 0, 2.2, 0); const r = cone(g, 0.5, 0.35, M.roofGreen, 0, 2.6, 0, 4); r.rotation.y = Math.PI / 4; cyl(g, 0.08, 0.08, 0.02, M.dark, 0, 2.25, 0.26, 10).rotation.x = Math.PI / 2; };
B.moonbed = (g) => { cyl(g, 1, 1.05, 0.3, M.stone, 0, 0.15, 0, 14); cyl(g, 0.92, 0.92, 0.3, M.soil, 0, 0.18, 0, 14); const mb = new THREE.MeshStandardMaterial({ color: 0x9ac8ff, emissive: 0x3f6ad6, emissiveIntensity: 0.7 }); flowersPatch(g, 0, 0, 1.3, 1.3, 16, [mb]); };
B.rarebed = (g) => { cyl(g, 1, 1.05, 0.3, M.brick, 0, 0.15, 0, 14); cyl(g, 0.92, 0.92, 0.3, M.soil, 0, 0.18, 0, 14); const gm = new THREE.MeshStandardMaterial({ color: 0xffd25a, emissive: 0xffa020, emissiveIntensity: 0.6 }); flowersPatch(g, 0, 0, 1.3, 1.3, 14, [gm, M.white]); };
B.alpine = (g) => { for (let i = 0; i < 6; i++) { const s = sh(new THREE.Mesh(G.rockGeo(i * 3), M.stone)); s.scale.setScalar(0.4 + (i % 3) * 0.15); s.position.set(Math.cos(i) * 0.8, 0, Math.sin(i * 1.3) * 0.8); g.add(s); } flowersPatch(g, 0, 0, 1.6, 1.6, 12, [M.white, M.purple]); };
B.statue = (g) => { box(g, 1.2, 0.6, 1.2, M.mossStone, 0, 0.3, 0); const b = sh(new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1.1, 4, 10), M.mossStone)); b.position.y = 1.5; g.add(b); const h = sphere(g, 0.36, M.mossStone, 0, 2.5, 0.05, 12); for (const s of [-1, 1]) { const a = cyl(g, 0.05, 0.08, 0.9, M.mossStone, s * 0.25, 3.0, 0, 5); a.rotation.z = s * 0.5; } const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.15), M.crystal); c.position.set(0, 1.6, 0.42); g.add(c); };
B.stonecircle = (g) => { for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28, h = 1.2 + (i % 3) * 0.4; box(g, 0.5, h, 0.4, M.mossStone, Math.cos(a) * 2, h / 2, Math.sin(a) * 2, -a); } cyl(g, 0.6, 0.7, 0.3, M.stone, 0, 0.15, 0, 10); const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), M.crystal); c.position.y = 0.8; g.add(c); g.userData.spin = c; };
B.lanternarch = (g) => { for (const s of [-1, 1]) cyl(g, 0.15, 0.18, 3.4, M.woodDark, s * 1.5, 1.7, 0, 8); const t = sh(new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.12, 6, 18, Math.PI), M.woodDark)); t.position.y = 3.4; g.add(t); for (let i = 1; i < 6; i++) { const a = i / 6 * Math.PI; lanternHang(g, Math.cos(a) * 1.5, 3.4 + Math.sin(a) * 1.5 - 0.5, 0); } };
B.snowman = (g) => { sphere(g, 0.7, M.white, 0, 0.6, 0, 12); sphere(g, 0.5, M.white, 0, 1.5, 0, 12); sphere(g, 0.35, M.white, 0, 2.2, 0, 12); const n = cone(g, 0.06, 0.35, M.orange, 0, 2.2, 0.45, 6); n.rotation.x = Math.PI / 2; cyl(g, 0.25, 0.25, 0.35, M.dark, 0, 2.6, 0, 10); cyl(g, 0.38, 0.38, 0.04, M.dark, 0, 2.43, 0, 10); const sc = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.08, 6, 14), M.red); sc.rotation.x = Math.PI / 2; sc.position.y = 1.9; g.add(sc); };
B.pumpkins = (g) => { for (let i = 0; i < 5; i++) { const p = sphere(g, 0.3 + (i % 2) * 0.12, M.orange, Math.cos(i * 1.4) * 0.7, 0.25, Math.sin(i * 1.4) * 0.7, 10); p.scale.y = 0.75; cyl(g, 0.03, 0.04, 0.15, M.leaf, p.position.x, 0.5 + (i % 2) * 0.08, p.position.z, 5); } box(g, 1, 0.8, 0.8, M.thatch, -0.6, 0.4, -0.9); };
B.lighttree = (g) => { B.pine(g); g.scale.setScalar(0.7); for (let i = 0; i < 26; i++) { const a = i * 0.9, y = 1.5 + i * 0.22, r = 2.0 - i * 0.07; const m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), M.bulbs); m.position.set(Math.cos(a) * r, y, Math.sin(a) * r); g.add(m); } const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), M.roofGold); st.position.y = 7.6; g.add(st); };

// ---------- catalog ----------
// cat: starter | business | tourism | nature | community | decor
// type: lodging | food | shop | attraction | utility | decor | path | home
// cost: c=coins w=wood s=stone f=flowers;  upkeep: coins per day;  lvl = reputation level needed
export const CATALOG = [
  { id: 'home', name: 'Your Cabin', cat: 'starter', type: 'home', size: [5, 5], cost: {}, hidden: true, appeal: 4, desc: 'Home. Sleep here to skip the night.' },
  { id: 'cabin', name: 'Wooden Cabin', cat: 'starter', type: 'lodging', size: [5, 5.4], cost: { c: 140, w: 25, s: 6 }, lvl: 1, cap: 2, price: 28, upkeep: 8, appeal: 3, desc: 'A snug log cabin for two guests.' },
  { id: 'cafe', name: 'Small Café', cat: 'starter', type: 'food', size: [6.5, 7.5], cost: { c: 180, w: 20, s: 8 }, lvl: 1, slots: 4, price: 8, need: 'food', upkeep: 14, appeal: 3, desc: 'Coffee, cocoa and cinnamon buns.' },
  { id: 'shed', name: 'Storage Shed', cat: 'starter', type: 'utility', size: [5, 4], cost: { c: 90, w: 18 }, lvl: 1, upkeep: 2, appeal: 0, storage: 60, desc: '+60 storage for wood, stone and flowers.' },
  { id: 'garden', name: 'Flower Garden', cat: 'starter', type: 'attraction', need: 'nature', size: [6.2, 6.2], cost: { c: 70, w: 6, f: 6 }, lvl: 1, slots: 4, price: 0, upkeep: 3, appeal: 7, nature: 4, produce: { f: 1 }, desc: 'Visitors stroll the beds. Grows 1 flower every few hours.' },
  { id: 'restaurant', name: 'Restaurant', cat: 'business', type: 'food', size: [8.6, 11], cost: { c: 650, w: 45, s: 35 }, lvl: 2, slots: 6, price: 18, need: 'food', upkeep: 38, appeal: 4, desc: 'Hearty forest dinners. Big spenders love it.' },
  { id: 'bakery', name: 'Bakery', cat: 'business', type: 'food', size: [5.8, 6.4], cost: { c: 340, w: 26, s: 18 }, lvl: 2, slots: 3, price: 7, need: 'food', upkeep: 16, appeal: 3, desc: 'Warm bread. Busiest in the morning and during harvest.' },
  { id: 'giftshop', name: 'Gift Shop', cat: 'business', type: 'shop', need: 'shop', size: [5.8, 6], cost: { c: 380, w: 30, s: 10, f: 5 }, lvl: 2, slots: 3, price: 13, upkeep: 15, appeal: 3, desc: 'Souvenirs, postcards and carved birds.' },
  { id: 'teahouse', name: 'Tea House', cat: 'business', type: 'food', size: [8, 9.5], cost: { c: 720, w: 50, s: 20 }, lvl: 3, slots: 5, price: 11, need: 'relax', upkeep: 24, appeal: 6, desc: 'Quiet tea on the veranda. Counts as food and relaxation.' },
  { id: 'icecream', name: 'Ice Cream Shop', cat: 'business', type: 'food', size: [5.6, 5.6], cost: { c: 280, w: 16, s: 6 }, lvl: 2, slots: 3, price: 5, need: 'food', upkeep: 10, appeal: 4, seasonal: { summer: 1.8, winter: 0.3 }, desc: 'A summer favourite — slow in winter.' },
  { id: 'grocery', name: 'Grocery Store', cat: 'business', type: 'shop', need: 'shop', size: [7.6, 8], cost: { c: 600, w: 40, s: 25 }, lvl: 3, slots: 4, price: 9, upkeep: 20, appeal: 2, lodgingBoost: 6, desc: 'Supplies for staying guests: +6 satisfaction for lodgers.' },
  { id: 'lodge', name: 'Guest Lodge', cat: 'tourism', type: 'lodging', size: [9.6, 9.6], cost: { c: 950, w: 80, s: 40 }, lvl: 2, cap: 6, price: 30, upkeep: 36, appeal: 4, desc: 'Two storeys of cosy rooms for six.' },
  { id: 'luxcabin', name: 'Luxury Cabin', cat: 'tourism', type: 'lodging', size: [6.6, 8], cost: { c: 1500, w: 60, s: 50, f: 10 }, lvl: 3, cap: 2, price: 85, upkeep: 40, appeal: 6, rich: true, desc: 'Glass-fronted A-frame with a private hot tub.' },
  { id: 'camping', name: 'Camping Ground', cat: 'tourism', type: 'lodging', size: [8.5, 8.5], cost: { c: 240, w: 14 }, lvl: 1, cap: 4, price: 12, upkeep: 6, appeal: 3, nature: 2, desc: 'Tents around a crackling fire. Budget-friendly.' },
  { id: 'hotspring', name: 'Hot Spring', cat: 'tourism', type: 'attraction', need: 'relax', size: [8, 8.6], cost: { c: 1600, s: 90, w: 20 }, lvl: 3, slots: 6, price: 22, upkeep: 30, appeal: 8, region: [2], seasonal: { winter: 1.7 }, desc: 'Steaming mountain pools. Highlands only — loved in winter.' },
  { id: 'tower', name: 'Observation Tower', cat: 'tourism', type: 'attraction', need: 'photo', size: [4.6, 4.6], cost: { c: 900, w: 70, s: 25 }, lvl: 3, slots: 4, price: 6, upkeep: 12, appeal: 6, desc: 'Climb up for the view and the perfect photo.' },
  { id: 'resort', name: 'Lakeside Resort', cat: 'tourism', type: 'lodging', size: [11.6, 12.4], cost: { c: 3400, w: 130, s: 80, f: 25 }, lvl: 4, cap: 8, price: 70, upkeep: 90, appeal: 7, water: true, rich: true, desc: 'The jewel of the lake. Must be built by water.' },
  { id: 'greenhouse', name: 'Greenhouse', cat: 'nature', type: 'attraction', need: 'nature', size: [6.6, 4.8], cost: { c: 480, w: 15, s: 20 }, lvl: 2, slots: 3, price: 4, upkeep: 12, appeal: 4, nature: 3, produce: { f: 3 }, desc: 'Grows 3 flowers every few hours, all year round.' },
  { id: 'botanical', name: 'Botanical Garden', cat: 'nature', type: 'attraction', need: 'nature', size: [11.8, 12.6], cost: { c: 1500, s: 40, f: 40 }, lvl: 3, slots: 8, price: 10, upkeep: 26, appeal: 10, nature: 6, region: [3], desc: 'A domed garden of rare plants. Meadow only.' },
  { id: 'nursery', name: 'Flower Nursery', cat: 'nature', type: 'shop', need: 'shop', size: [6.4, 6], cost: { c: 420, w: 30, f: 12 }, lvl: 2, slots: 3, price: 8, upkeep: 10, appeal: 4, produce: { f: 2 }, desc: 'Sells potted plants and grows 2 flowers.' },
  { id: 'fishdock', name: 'Fishing Dock', cat: 'nature', type: 'attraction', need: 'fun', size: [3.4, 9.5], cost: { c: 380, w: 45 }, lvl: 2, slots: 4, price: 8, upkeep: 8, appeal: 3, water: true, seasonal: { summer: 1.4, winter: 0.5 }, desc: 'Must reach the water. Visitors fish; you can too.' },
  { id: 'visitor', name: 'Visitor Center', cat: 'community', type: 'utility', size: [7.6, 8], cost: { c: 800, w: 40, s: 40 }, lvl: 2, upkeep: 20, appeal: 3, unique: true, arrivals: 0.3, desc: '+30% visitor arrivals and better accessibility.' },
  { id: 'hall', name: 'Community Hall', cat: 'community', type: 'utility', size: [9.6, 9], cost: { c: 1500, w: 80, s: 60 }, lvl: 3, upkeep: 30, appeal: 4, unique: true, clean: 25, desc: 'Volunteers keep the village tidy (+cleanliness) and host seasonal festivals.' },
  { id: 'stage', name: 'Festival Stage', cat: 'community', type: 'attraction', need: 'fun', size: [8.4, 7.6], cost: { c: 900, w: 55, s: 15 }, lvl: 3, slots: 8, price: 5, upkeep: 18, appeal: 5, evening: true, desc: 'Evening concerts. Required for seasonal festivals.' },
  { id: 'playground', name: 'Playground', cat: 'community', type: 'attraction', need: 'fun', size: [8, 8], cost: { c: 320, w: 25, s: 10 }, lvl: 2, slots: 5, price: 0, upkeep: 5, appeal: 4, family: true, desc: 'Free fun — families stay happier and longer.' },
  // decorations
  { id: 'tree', name: 'Oak Tree', cat: 'decor', type: 'decor', size: [1.6, 1.6], cost: { c: 15 }, lvl: 1, appeal: 1, nature: 2, rot: 15, desc: 'Plant a young oak.' },
  { id: 'pine', name: 'Pine Tree', cat: 'decor', type: 'decor', size: [1.6, 1.6], cost: { c: 15 }, lvl: 1, appeal: 1, nature: 2, rot: 15, desc: 'An evergreen — of course.' },
  { id: 'flowerbed', name: 'Flower Bed', cat: 'decor', type: 'decor', size: [2, 2], cost: { f: 4 }, lvl: 1, appeal: 2, nature: 1, rot: 15, desc: 'A raised bed of mixed blooms.' },
  { id: 'bench', name: 'Bench', cat: 'decor', type: 'decor', size: [1.9, 0.8], cost: { w: 5 }, lvl: 1, appeal: 1, seat: true, rot: 15, desc: 'Visitors sit and rest here.' },
  { id: 'lamp', name: 'Lamp Post', cat: 'decor', type: 'decor', size: [0.7, 0.7], cost: { c: 25, s: 2 }, lvl: 1, appeal: 1, light: true, rot: 15, desc: 'Lights the way at night. Visitors feel safer.' },
  { id: 'fence', name: 'Fence', cat: 'decor', type: 'decor', size: [3, 0.4], cost: { w: 3 }, lvl: 1, appeal: 0.5, rot: 15, desc: 'Picket fence section.' },
  { id: 'sign', name: 'Village Sign', cat: 'decor', type: 'decor', size: [1.7, 0.5], cost: { w: 4 }, lvl: 1, appeal: 1, rot: 15, desc: 'Welcome to Evergreen.' },
  { id: 'path', name: 'Stone Path', cat: 'decor', type: 'path', size: [3, 3], cost: { s: 1 }, lvl: 1, appeal: 0.3, rot: 90, desc: 'Extends walkways so buildings are reachable.' },
  { id: 'bridge', name: 'Footbridge', cat: 'decor', type: 'path', size: [2.6, 7.6], cost: { w: 24, s: 6 }, lvl: 1, appeal: 1, bridge: true, rot: 15, desc: 'Cross the river. Walkable for you and visitors.' },
  { id: 'rock', name: 'Boulder', cat: 'decor', type: 'decor', size: [2, 2], cost: { c: 5 }, lvl: 1, appeal: 0.5, nature: 1, rot: 15, desc: 'A mossy boulder.' },
  { id: 'bin', name: 'Litter Bin', cat: 'decor', type: 'decor', size: [0.7, 0.7], cost: { c: 30, w: 2 }, lvl: 1, appeal: 0, bin: true, rot: 15, desc: 'Visitors nearby drop less litter.' },
  { id: 'birdhouse', name: 'Birdhouse', cat: 'decor', type: 'decor', size: [0.7, 0.7], cost: { w: 6 }, lvl: 1, appeal: 1, nature: 1, rot: 15, desc: 'Songbirds move in.' },
  { id: 'fountain', name: 'Fountain', cat: 'decor', type: 'decor', size: [3.3, 3.3], cost: { c: 220, s: 25 }, lvl: 2, appeal: 5, rot: 15, desc: 'A burbling stone fountain.' },
  { id: 'pond', name: 'Garden Pond', cat: 'decor', type: 'decor', size: [4.4, 4.4], cost: { c: 160, s: 14 }, lvl: 2, appeal: 4, nature: 2, rot: 15, desc: 'Lily pads and smooth stones.' },
  { id: 'moonbed', name: 'Moonbell Bed', cat: 'decor', type: 'decor', size: [2.1, 2.1], cost: { f: 8 }, lvl: 1, appeal: 4, nature: 2, locked: 'moonbed', rot: 15, desc: 'Discovered in the forest shade. Glows softly.' },
  { id: 'alpine', name: 'Alpine Rock Garden', cat: 'decor', type: 'decor', size: [2.4, 2.4], cost: { s: 8, f: 6 }, lvl: 1, appeal: 4, nature: 2, locked: 'alpine', rot: 15, desc: 'Edelweiss among the stones.' },
  { id: 'rarebed', name: 'Rare Flower Bed', cat: 'decor', type: 'decor', size: [2.1, 2.1], cost: { f: 12 }, lvl: 1, appeal: 6, nature: 2, locked: 'rarebed', rot: 15, desc: 'Sunstar orchids that glow at dusk.' },
  { id: 'statue', name: 'Moss Statue', cat: 'decor', type: 'decor', size: [1.6, 1.6], cost: { s: 30 }, lvl: 1, appeal: 8, locked: 'statue', rot: 15, desc: 'An ancient guardian from the Old Woodland.' },
  { id: 'stonecircle', name: 'Stone Circle', cat: 'decor', type: 'decor', size: [4.8, 4.8], cost: { s: 50 }, lvl: 1, appeal: 10, locked: 'stonecircle', rot: 15, desc: 'Standing stones around a humming crystal.' },
  { id: 'lanternarch', name: 'Lantern Arch', cat: 'decor', type: 'decor', size: [3.6, 0.8], cost: { w: 30, s: 10 }, lvl: 1, appeal: 8, light: true, locked: 'lanternarch', rot: 15, desc: 'Glowing lanterns over a gateway.' },
  { id: 'pumpkins', name: 'Harvest Pumpkins', cat: 'decor', type: 'decor', size: [2.2, 2.2], cost: { c: 30, f: 2 }, lvl: 1, appeal: 3, season: 2, rot: 15, desc: 'Autumn only — seasonal decoration.' },
  { id: 'snowman', name: 'Snowman', cat: 'decor', type: 'decor', size: [1.5, 1.5], cost: { c: 10 }, lvl: 1, appeal: 3, season: 3, rot: 15, desc: 'Winter only — seasonal decoration.' },
  { id: 'lighttree', name: 'Light Tree', cat: 'decor', type: 'decor', size: [2, 2], cost: { c: 60, w: 5 }, lvl: 1, appeal: 5, light: true, season: 3, rot: 15, desc: 'Winter only — a pine strung with lights.' },
];
export const CAT_BY_ID = Object.fromEntries(CATALOG.map(c => [c.id, c]));
export const CATEGORIES = [['starter', 'Starter'], ['business', 'Business'], ['tourism', 'Tourism'], ['nature', 'Nature'], ['community', 'Community'], ['decor', 'Decor']];

export function upgradeCost(def, lvl) { const k = lvl === 1 ? 0.6 : 1.1; const c = def.cost; return { c: Math.round((c.c || 50) * k), w: Math.round((c.w || 0) * k * 0.5), s: Math.round((c.s || 0) * k * 0.5) }; }
export function levelMul(lvl) { return [1, 1, 1.35, 1.75][lvl]; }

// build the model for a building at a given level
export function buildModel(def, lvl = 1) {
  const g = new THREE.Group();
  (B[def.id] || B.cabin)(g, lvl);
  dress(g, def, lvl);
  g.traverse(o => { if (o.isMesh) { o.castShadow = def.type !== 'path'; o.receiveShadow = true; } });
  return g;
}
export function setSharedTreeMats(m) { M.trunkMat = m.trunkMat; M.oakLeaf = m.oakLeaf; M.pineLeaf = m.pineLeaf; }
