// EVERGREEN — gameplay: state, economy, construction, visitors, progression, save/load
import * as THREE from 'three';
import { E, LEVELS, levelOf, SEASONS } from './ctx.js';
import { CATALOG, CAT_BY_ID, buildModel, upgradeCost, levelMul } from './buildings.js';
import { world, colliders, things, clearGrass, setTreeVisible, openGate } from './world.js';
import { height, ground, regionAt, REGIONS, WL, addSurface, removeSurface, slopeAt, TRAILHEAD, nearLake, isRiverZone } from './terrain.js';
import { Nav, Visitor } from './visitors.js';
import { merge } from './geo.js';
import { ghostOK, ghostBad } from './materials.js';
import { clamp, pick } from './util.js';

export const SEC_PER_HOUR = () => (E.S?.settings?.dayLen ?? 6) * 60 / 24;
export const gameHours = () => (E.S.day - 1) * 24 + E.S.hour;
export const newDay = () => ({ income: 0, expenses: 0, arrivals: 0, departures: 0, served: 0, gathered: 0, litter: 0, sat: [], by: {} });

export function newState() {
  return {
    v: 1, coins: 400, wood: 45, stone: 20, flowers: 10, rep: 0, level: 1, day: 1, hour: 7.2, season: 0, weather: 'sunny', weatherT: 8,
    unlocked: [true, false, false, false, false], buildings: [], found: [], unlocks: [], quest: 0, ach: [], priceMul: 1,
    ledger: [], today: newDay(), reviews: [], sats: [], fish: {}, trees: {}, rocks: {}, clumps: {}, player: null, uid: 1, daily: null, seasonal: null, festivalDone: {}, seasonsSeen: [0],
    stats: { trees: 0, rocks: 0, clumps: 0, fish: 0, departed: 0, arrivals: 0, income: 0, litter: 0, five: 0, maxLvl: 1, festivals: 0, served: 0, nights: 0 },
    settings: { shadows: 'high', grass: 'med', sens: 1, invert: false, music: 0.5, sfx: 0.8, amb: 0.7, dayLen: 6, seasonLen: 3 },
  };
}

// ---------- resources ----------
export const cap = () => 80 + 60 * E.buildings.filter(b => b.def.id === 'shed').length;
const RES = { c: 'coins', w: 'wood', s: 'stone', f: 'flowers' };
export function canAfford(cost) { const S = E.S; return Object.entries(cost).every(([k, v]) => S[RES[k]] >= v); }
export function pay(cost) { for (const [k, v] of Object.entries(cost)) E.S[RES[k]] -= v; E.ui.res(); }
export function give(kind, n, x, z, silent) {
  const S = E.S; if (!n) return 0;
  if (kind === 'coins') { S.coins += n; if (n > 0) { S.stats.income += 0; } }
  else if (kind === 'rep') S.rep = Math.max(0, S.rep + n);
  else { const c = cap(), before = S[kind]; S[kind] = Math.min(c, S[kind] + n); n = S[kind] - before; if (n <= 0 && !silent) { E.ui.toast(`Storage full — build a Storage Shed for more ${kind}`, 'warn'); return 0; } }
  E.ui.res(kind); if (!silent && x !== undefined) E.ui.float(`+${Math.round(n)} ${kind === 'rep' ? 'reputation' : kind}`, x, height(x, z) + 2.5, z, kind);
  return n;
}
export function earn(amount, b, x, z) {
  const S = E.S; S.coins += amount; S.today.income += amount; S.stats.income += amount;
  if (b) { b.incomeToday += amount; b.incomeTotal = (b.incomeTotal || 0) + amount; S.today.by[b.rec.uid] = (S.today.by[b.rec.uid] || 0) + amount; }
  E.ui.res('coins');
  if (x !== undefined && E.player.pos.distanceTo(new THREE.Vector3(x, E.player.pos.y, z)) < 26) { E.ui.float(`+${Math.round(amount)}`, x, height(x, z) + 2.4, z, 'coins'); E.audio.coin(); }
}

// ---------- footprints ----------
const bbCache = {};
export function defBox(def) {
  if (bbCache[def.id]) return bbCache[def.id];
  const m = buildModel(def, 1); const bb = new THREE.Box3().setFromObject(m);
  const r = { cx: (bb.max.x + bb.min.x) / 2, cz: (bb.max.z + bb.min.z) / 2, hw: Math.max(0.3, (bb.max.x - bb.min.x) / 2), hd: Math.max(0.3, (bb.max.z - bb.min.z) / 2), minz: bb.min.z, maxz: bb.max.z, h: bb.max.y };
  if (def.type === 'path') { r.hw = def.size[0] / 2; r.hd = def.size[1] / 2; r.cx = r.cz = 0; }
  return bbCache[def.id] = r;
}
const toWorld = (lx, lz, x, z, rot) => { const c = Math.cos(rot), s = Math.sin(rot); return [x + lx * c + lz * s, z - lx * s + lz * c]; };
export function obbOf(def, x, z, rot, shrink = 1) { const b = defBox(def); const [cx, cz] = toWorld(b.cx, b.cz, x, z, rot); return { x: cx, z: cz, hw: b.hw * shrink, hd: b.hd * shrink, rot: -rot }; }
function obbOverlap(a, b) {
  const axes = [[Math.cos(a.rot), Math.sin(a.rot)], [-Math.sin(a.rot), Math.cos(a.rot)], [Math.cos(b.rot), Math.sin(b.rot)], [-Math.sin(b.rot), Math.cos(b.rot)]];
  const dx = b.x - a.x, dz = b.z - a.z;
  for (const [ax, az] of axes) {
    const ra = a.hw * Math.abs(Math.cos(a.rot) * ax + Math.sin(a.rot) * az) + a.hd * Math.abs(-Math.sin(a.rot) * ax + Math.cos(a.rot) * az);
    const rb = b.hw * Math.abs(Math.cos(b.rot) * ax + Math.sin(b.rot) * az) + b.hd * Math.abs(-Math.sin(b.rot) * ax + Math.cos(b.rot) * az);
    if (Math.abs(dx * ax + dz * az) > ra + rb) return false;
  }
  return true;
}
function samples(def, x, z, rot) {
  const b = defBox(def), pts = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) pts.push(toWorld(b.cx + i * b.hw * 0.9, b.cz + j * b.hd * 0.9, x, z, rot));
  return pts;
}
export function entranceOf(def, x, z, rot) { const b = defBox(def); const back = def.id === 'fishdock'; return toWorld(b.cx, back ? b.minz - 0.9 : b.maxz + 0.9, x, z, rot); }
function footY(def, x, z, rot) {
  const pts = samples(def, x, z, rot).map(([px, pz]) => height(px, pz));
  if (def.id === 'fishdock') { const b = defBox(def); const [bx, bz] = toWorld(0, b.minz + 1, x, z, rot); return Math.max(WL + 0.05, height(bx, bz) - 0.45); }
  if (def.bridge) { const [ax, az] = toWorld(0, -3.6, x, z, rot), [bx, bz] = toWorld(0, 3.6, x, z, rot); return Math.max(WL + 0.2, Math.max(height(ax, az), height(bx, bz)) - 0.45); }
  if (def.type === 'path') return Math.max(...pts) - 0.03;
  return def.type === 'decor' ? pts[4] : Math.max(...pts);
}

// ---------- placement validation ----------
export function validate(def, x, z, rot, ignore) {
  const S = E.S;
  if (def.locked && !S.unlocks.includes(def.locked)) return { ok: false, why: 'Not discovered yet' };
  if ((def.lvl || 1) > S.level) return { ok: false, why: `Requires ${LEVELS[def.lvl - 1].name}` };
  if (def.season !== undefined && def.season !== S.season) return { ok: false, why: `Only in ${SEASONS[def.season]}` };
  if (!ignore && !canAfford(def.cost)) return { ok: false, why: 'Not enough resources' };
  if (def.unique && E.buildings.some(b => b.def.id === def.id && b !== ignore)) return { ok: false, why: 'You can only build one' };
  if (Math.hypot(x, z) > 146) return { ok: false, why: 'Too close to the mountains' };
  const pts = samples(def, x, z, rot);
  for (const [px, pz] of pts) if (!S.unlocked[regionAt(px, pz)]) return { ok: false, why: `${REGIONS[regionAt(px, pz)].name} is still locked` };
  if (def.region && !def.region.includes(regionAt(x, z))) return { ok: false, why: `Must be built in ${def.region.map(r => REGIONS[r].name).join(' or ')}` };
  const hs = pts.map(([px, pz]) => height(px, pz));
  const b = defBox(def);
  if (def.id === 'fishdock') {
    const [fx, fz] = toWorld(0, b.maxz - 0.8, x, z, rot), [bx, bz] = toWorld(0, b.minz + 0.6, x, z, rot);
    if (height(fx, fz) > WL - 0.6) return { ok: false, why: 'The end of the dock must reach the water' };
    if (height(bx, bz) < WL + 0.1) return { ok: false, why: 'The back of the dock must sit on the shore' };
  } else if (def.bridge) {
    const [ax, az] = toWorld(0, -3.5, x, z, rot), [bx, bz] = toWorld(0, 3.5, x, z, rot);
    if (height(ax, az) < WL + 0.1 || height(bx, bz) < WL + 0.1) return { ok: false, why: 'Both ends must rest on land' };
    if (Math.abs(height(ax, az) - height(bx, bz)) > 1.6) return { ok: false, why: 'Banks are too uneven' };
  } else {
    if (Math.min(...hs) < WL + 0.25) return { ok: false, why: 'Too wet — find dry ground' };
    const spread = Math.max(...hs) - Math.min(...hs);
    if (spread > (def.type === 'decor' || def.type === 'path' ? 1.4 : 2.4)) return { ok: false, why: 'Ground is too steep' };
  }
  if (def.id === 'resort') { let wet = false; for (let a = 0; a < 16 && !wet; a++) for (const r of [9, 12]) if (height(x + Math.cos(a / 16 * 6.28) * r, z + Math.sin(a / 16 * 6.28) * r) < WL - 0.3) wet = true; if (!wet) return { ok: false, why: 'Must be built right by the water' }; }
  const me = obbOf(def, x, z, rot, def.type === 'path' ? 0.95 : 0.92);
  for (const o of E.buildings) { if (o === ignore) continue; if (def.type === 'path' && o.def.type === 'path') { if (Math.hypot(o.rec.x - x, o.rec.z - z) < 1.2) return { ok: false, why: 'Overlaps another path' }; continue; } if (def.type === 'path' && o.def.type !== 'path') { if (obbOverlap(me, o.obbTight)) return { ok: false, why: `Overlaps ${o.def.name}` }; continue; } if (o.def.type === 'path' && def.type !== 'path') { if (def.type === 'decor') continue; continue; } if (obbOverlap(me, o.obbTight)) return { ok: false, why: `Overlaps ${o.def.name}` }; }
  for (const ex of world.exclusions) { if (ex.home) continue; const r = ex.r * 0.6; if (Math.abs(ex.x - me.x) < me.hw + r && Math.abs(ex.z - me.z) < me.hd + r && Math.hypot(ex.x - x, ex.z - z) < Math.max(me.hw, me.hd) + r) return { ok: false, why: 'A landmark is in the way' }; }
  for (const c of colliders.query(x, z, Math.max(b.hw, b.hd) + 2)) { if (c.tree || c.obb || c.gate) continue; if (c.r > 0.9 && Math.hypot(c.x - me.x, c.z - me.z) < Math.max(me.hw, me.hd)) return { ok: false, why: 'A boulder is in the way' }; }
  const p = E.player.pos; if (def.type !== 'path' && obbOverlap(me, { x: p.x, z: p.z, hw: 0.4, hd: 0.4, rot: 0 })) return { ok: false, why: 'Step out of the way first' };
  if (def.type !== 'decor' && def.type !== 'path') { const [ex, ez] = entranceOf(def, x, z, rot); if (E.nav.distTo(ex, ez) > 10) return { ok: false, why: 'Too far from a path — lay Stone Path tiles to reach it' }; const ge = ground(ex, ez); if (ge.water && def.id !== 'fishdock') return { ok: false, why: 'The entrance would be in the water' }; }
  return { ok: true, y: footY(def, x, z, rot) };
}

// ---------- building lifecycle ----------
function optimize(g) {
  g.updateMatrixWorld(true);
  const keep = new Set();
  for (const v of Object.values(g.userData)) { const arr = Array.isArray(v) ? v : [v]; for (const o of arr) if (o && o.isObject3D) o.traverse(c => keep.add(c)); }
  const groups = new Map(), dead = [];
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  g.traverse(o => { if (!o.isMesh || keep.has(o) || o.material.transparent && o.material !== undefined && o.material.opacity < 0.5) return; const geo = o.geometry.clone(); geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); if (!groups.has(o.material)) groups.set(o.material, []); groups.get(o.material).push(geo); dead.push(o); });
  for (const o of dead) o.parent.remove(o);
  for (const [mat, geos] of groups) { const m = new THREE.Mesh(merge(geos), mat); m.castShadow = m.receiveShadow = true; g.add(m); }
}
const L2W = (b, v) => { const [x, z] = toWorld(v.x, v.z, b.rec.x, b.rec.z, b.rec.rot); return new THREE.Vector3(x, b.y + v.y, z); };

export function createBuilding(rec, opts = {}) {
  const def = CAT_BY_ID[rec.id]; if (!def) return null;
  const g = buildModel(def, rec.lvl || 1);
  const ud = { ...g.userData };
  optimize(g);
  const y = opts.y ?? footY(def, rec.x, rec.z, rec.rot);
  g.position.set(rec.x, y, rec.z); g.rotation.y = rec.rot; E.scene.add(g);
  const b = { rec, def, group: g, y, ud, occupants: 0, guests: [], incomeToday: 0, usesToday: 0, emitters: [], lights: [] };
  b.obbTight = obbOf(def, rec.x, rec.z, rec.rot, 0.95);
  const bx = defBox(def);
  if (def.type !== 'path') {
    if (Math.max(bx.hw, bx.hd) < 1.1) b.col = colliders.add({ x: b.obbTight.x, z: b.obbTight.z, r: Math.max(bx.hw, bx.hd) * 0.8 });
    else if (!['flowerbed', 'garden', 'playground', 'botanical', 'camping', 'hotspring', 'stonecircle', 'pond', 'fishdock'].includes(def.id) || true) {
      const o = obbOf(def, rec.x, rec.z, rec.rot, def.type === 'decor' ? 0.8 : 0.86);
      if (['garden', 'playground', 'camping', 'botanical', 'stonecircle', 'hotspring', 'fishdock', 'lanternarch', 'pumpkins'].includes(def.id)) { /* walk-through areas: collide only on solid centre bits */ b.col = null; }
      else b.col = colliders.add({ x: o.x, z: o.z, obb: o });
    }
    if (def.type !== 'decor' || bx.h > 2.4) { g.updateMatrixWorld(true); b.box = new THREE.Box3().setFromObject(g); b.box.expandByScalar(-0.15); }
  }
  // clear the ground: hide natural trees, grass and small rocks under the footprint
  const r = Math.max(bx.hw, bx.hd) + 0.6, cx = b.obbTight.x, cz = b.obbTight.z;
  let cleared = 0;
  for (const t of things.query(cx, cz, r + 2)) {
    if (t.type === 'tree' && t.alive && obbOverlap(obbOf(def, rec.x, rec.z, rec.rot, 1.05), { x: t.x, z: t.z, hw: 0.6, hd: 0.6, rot: 0 })) { t.alive = false; t.cleared = rec.uid; E.S.trees[world.trees.indexOf(t)] = -1; setTreeVisible(t, 0); colliders.remove(t.col); cleared++; }
    if ((t.type === 'clump' || t.type === 'rock') && t.alive && Math.hypot(t.x - cx, t.z - cz) < r) { hideThing(t, Infinity); }
  }
  if (cleared && opts.fresh) give('wood', cleared * 2, rec.x, rec.z);
  if (def.type !== 'decor' || def.id === 'path') clearGrass(cx, cz, Math.min(r, 8));
  if (opts.fresh) world.darken(cx, cz, r * 1.1, 0.18);
  // emitters & lights
  if (ud.smoke) b.emitters.push({ pos: L2W(b, ud.smoke), steam: false, t: Math.random() });
  if (ud.steam) b.emitters.push({ pos: L2W(b, ud.steam), steam: true, t: Math.random() });
  for (const e of b.emitters) E.fx.emitters.push(e);
  if (def.light) b.lights.push(L2W(b, ud.light || new THREE.Vector3(0, 3, 0)));
  if (ud.fire) b.lights.push(L2W(b, new THREE.Vector3(0, 0.8, -0.2)));
  // walkways
  if (def.type === 'path' && !def.bridge) b.nav = E.nav.addPiece([[rec.x, rec.z]], { tile: true });
  if (def.bridge) {
    const a = toWorld(0, -4.6, rec.x, rec.z, rec.rot), c = toWorld(0, 4.6, rec.x, rec.z, rec.rot);
    b.nav = E.nav.addPiece([a, [rec.x, rec.z], c], { bridge: true });
    b.surface = addSurface({ x: rec.x, z: rec.z, rot: -rec.rot, hw: 1.25, hd: 3.95, y: y + 0.68, kind: 'wood' });
  }
  if (def.id === 'fishdock') { const dl = defBox(def); const [sx, sz] = toWorld(0, (dl.minz + dl.maxz) / 2 + 1.4, rec.x, rec.z, rec.rot); b.surface = addSurface({ x: sx, z: sz, rot: -rec.rot, hw: 1.5, hd: 3.6, y: y + 0.65, kind: 'wood' }); b.fishSpot = toWorld(0, dl.maxz - 0.6, rec.x, rec.z, rec.rot); }
  if (def.seat) b.seat = { x: rec.x, z: rec.z, ry: rec.rot, b };
  b.entrance = entranceOf(def, rec.x, rec.z, rec.rot);
  g.traverse(o => { o.userData.building = b; });
  E.buildings.push(b);
  if (opts.anim) { b.grow = 0; g.scale.set(1, 0.01, 1); E.fx.burst(cx, y + 0.5, cz, def.type === 'decor' ? 6 : 18); }
  return b;
}
export function removeBuilding(b) {
  E.scene.remove(b.group);
  b.group.traverse(o => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
  if (b.col) colliders.remove(b.col);
  if (b.nav) E.nav.removePiece(b.nav);
  if (b.surface) removeSurface(b.surface);
  for (const e of b.emitters) { const i = E.fx.emitters.indexOf(e); if (i >= 0) E.fx.emitters.splice(i, 1); }
  for (const t of world.trees) if (t.cleared === b.rec.uid) { t.cleared = 0; E.S.trees[world.trees.indexOf(t)] = gameHours() + 24; }
  for (const g of b.guests) g.lodging = null;
  E.buildings.splice(E.buildings.indexOf(b), 1);
}
export function syncRecords() { E.S.buildings = E.buildings.map(b => ({ ...b.rec })); }

// ---------- construction mode ----------
export const build = { active: false, def: null, rot: 0, ghost: null, ghostMeshes: [], valid: null, x: 0, z: 0, tool: 'build', moving: null, hover: null };
export function selectDef(def) {
  clearGhost(); build.def = def; if (build.moving) build.tool = 'move';
  if (!def) return;
  const g = buildModel(def, build.moving ? build.moving.rec.lvl : 1); build.ghost = g; build.ghostMeshes = [];
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; build.ghostMeshes.push(o); } });
  // footprint outline
  const bb = defBox(def); const fp = new THREE.Mesh(new THREE.PlaneGeometry(bb.hw * 2, bb.hd * 2), ghostOK); fp.rotation.x = -Math.PI / 2; fp.position.set(bb.cx, 0.08, bb.cz); g.add(fp); build.ghostMeshes.push(fp);
  if (def.type !== 'decor' && def.type !== 'path') { const en = entranceOf(def, 0, 0, 0); const ar = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 3), ghostOK); ar.rotation.x = Math.PI / 2 * (def.id === 'fishdock' ? 1 : -1); ar.position.set(en[0], 0.3, en[1]); g.add(ar); build.ghostMeshes.push(ar); }
  E.scene.add(g);
}
export function clearGhost() { if (build.ghost) { E.scene.remove(build.ghost); build.ghost = null; } }
export function updateGhost(hit) {
  if (!build.ghost || !build.def) return;
  if (!hit) { build.ghost.visible = false; build.valid = { ok: false, why: 'Point at the ground' }; return; }
  const snap = build.def.type === 'path' ? 1.5 : 0.5;
  let x = Math.round(hit.x / snap) * snap, z = Math.round(hit.z / snap) * snap;
  build.x = x; build.z = z;
  const v = validate(build.def, x, z, build.rot, build.moving);
  if (v.ok && E.player.pos.distanceTo(new THREE.Vector3(x, E.player.pos.y, z)) > 70) { v.ok = false; v.why = 'Walk closer to build here'; }
  build.valid = v;
  build.ghost.visible = true;
  build.ghost.position.set(x, v.ok ? v.y : footY(build.def, x, z, build.rot), z); build.ghost.rotation.y = build.rot;
  const m = v.ok ? ghostOK : ghostBad; for (const o of build.ghostMeshes) o.material = m;
}
export function confirmPlace() {
  const def = build.def, v = build.valid; if (!def || !v) return;
  if (!v.ok) { E.audio.error(); E.ui.toast(v.why, 'warn'); return; }
  if (build.moving) {
    const old = build.moving; const rec = { ...old.rec, x: build.x, z: build.z, rot: build.rot };
    const inc = old.incomeTotal; removeBuilding(old); const nb = createBuilding(rec, { anim: true, fresh: false }); nb.incomeTotal = inc;
    build.moving = null; selectDef(null); build.tool = 'move'; E.audio.build(); E.ui.toast(`${def.name} moved`); syncRecords(); E.ui.buildBar(); return;
  }
  pay(def.cost);
  const rec = { uid: E.S.uid++, id: def.id, x: build.x, z: build.z, rot: build.rot, lvl: 1 };
  createBuilding(rec, { anim: true, fresh: true }); syncRecords();
  E.audio.build(); E.ui.toast(`${def.name} built!`);
  E.S.stats.built = (E.S.stats.built || 0) + 1;
  if (E.S.seasonal && E.S.seasonal.ids && E.S.seasonal.ids.includes(def.id)) E.S.seasonal.count++;
  E.game.checkProgress();
  if (!canAfford(def.cost) || def.unique) selectDef(null);
  E.ui.buildBar();
}
export function demolish(b) {
  if (b.def.type === 'home') { E.ui.toast('This is your home — it stays.', 'warn'); return; }
  const refund = {}; for (const [k, v] of Object.entries(b.def.cost)) refund[k] = Math.floor(v * 0.5);
  for (const [k, v] of Object.entries(refund)) give(RES[k], v, undefined, undefined, true);
  E.fx.burst(b.rec.x, b.y + 0.5, b.rec.z, 16); removeBuilding(b); syncRecords(); E.audio.demolish();
  E.ui.toast(`${b.def.name} removed · half the materials returned`); E.ui.res();
}
export function upgrade(b) {
  const lvl = b.rec.lvl || 1; if (lvl >= 3 || b.def.type === 'decor' || b.def.type === 'path') return false;
  const c = upgradeCost(b.def, lvl); if (!canAfford(c)) { E.audio.error(); E.ui.toast('Not enough resources to upgrade', 'warn'); return false; }
  pay(c); const rec = { ...b.rec, lvl: lvl + 1 }; const keep = { incomeTotal: b.incomeTotal, incomeToday: b.incomeToday, guests: b.guests, occupants: b.occupants };
  removeBuilding(b); const nb = createBuilding(rec, { anim: true }); Object.assign(nb, keep); for (const g of nb.guests) g.lodging = nb;
  syncRecords(); E.audio.build(); E.audio.fanfare(); E.ui.toast(`${b.def.name} upgraded to level ${lvl + 1}!`, 'gold');
  E.S.stats.maxLvl = Math.max(E.S.stats.maxLvl, lvl + 1); E.game.checkProgress(); return nb;
}

// ---------- resource nodes ----------
export function hideThing(t, until) {
  t.alive = false;
  if (t.type === 'rock') { const [im, i] = t.inst; const m = new THREE.Matrix4(); im.getMatrixAt(i, m); t._m = m.clone(); m.makeScale(0, 0, 0); im.setMatrixAt(i, m); im.instanceMatrix.needsUpdate = true; if (t.col) colliders.remove(t.col); E.S.rocks[world.rocks.indexOf(t)] = until; }
  if (t.type === 'clump') { const [im, i] = t.inst; const m = new THREE.Matrix4(); im.getMatrixAt(i, m); t._m = m.clone(); m.makeScale(0, 0, 0); im.setMatrixAt(i, m); im.instanceMatrix.needsUpdate = true; E.S.clumps[world.clumps.indexOf(t)] = until; }
}
function showThing(t) {
  t.alive = true; const [im, i] = t.inst; if (t._m) { im.setMatrixAt(i, t._m); im.instanceMatrix.needsUpdate = true; }
  if (t.type === 'rock' && t.col) colliders.add(t.col);
}
export function chopTree(t) {
  t.alive = false; colliders.remove(t.col); t.fall = 0; E.fallingTrees.push(t);
  const idx = world.trees.indexOf(t); E.S.trees[idx] = gameHours() + 48;
  const si = world.stumpFree.pop(); if (si !== undefined) { t.stump = si; const m = new THREE.Matrix4().compose(new THREE.Vector3(t.x, t.y, t.z), new THREE.Quaternion(), new THREE.Vector3(t.s, t.s, t.s)); world.stumps.setMatrixAt(si, m); world.stumps.instanceMatrix.needsUpdate = true; }
}
function regrowTree(t) {
  t.alive = true; t.regrowT = 0; colliders.add(t.col); E.growingTrees.push(t);
  if (t.stump !== undefined) { const m = new THREE.Matrix4().makeScale(0, 0, 0); world.stumps.setMatrixAt(t.stump, m); world.stumps.instanceMatrix.needsUpdate = true; world.stumpFree.push(t.stump); t.stump = undefined; }
}
export function tickRegrowth() {
  const now = gameHours(), S = E.S;
  for (const [k, v] of Object.entries(S.trees)) if (v > 0 && v < now) { const t = world.trees[k]; delete S.trees[k]; if (t && !t.cleared) regrowTree(t); }
  for (const [k, v] of Object.entries(S.rocks)) if (v < now) { const t = world.rocks[k]; delete S.rocks[k]; if (t) showThing(t); }
  for (const [k, v] of Object.entries(S.clumps)) if (v < now) { const t = world.clumps[k]; delete S.clumps[k]; if (t) showThing(t); }
}

// ---------- fishing ----------
const FISH = [
  { n: 'Minnow', v: 4, w: 10 }, { n: 'Perch', v: 8, w: 8 }, { n: 'Brook Trout', v: 13, w: 6, river: true }, { n: 'Pike', v: 19, w: 4, lake: true },
  { n: 'Carp', v: 11, w: 6, lake: true }, { n: 'Catfish', v: 16, w: 4, night: true }, { n: 'Salmon', v: 24, w: 3, season: 2 }, { n: 'Rainbow Trout', v: 18, w: 3, season: 0 },
  { n: 'Lake Sturgeon', v: 45, w: 1, lake: true }, { n: 'Golden Carp', v: 80, w: 0.4, lake: true },
];
export function rollFish(lake, river) {
  const S = E.S, night = S.hour > 20 || S.hour < 5;
  const pool = FISH.filter(f => (!f.lake || lake) && (!f.river || river) && (!f.night || night) && (f.season === undefined || f.season === S.season));
  let tot = pool.reduce((a, f) => a + f.w, 0), r = Math.random() * tot; for (const f of pool) { r -= f.w; if (r <= 0) return f; } return pool[0];
}

// ---------- visitors ----------
const NEEDS = ['food', 'nature', 'fun', 'relax', 'shop', 'photo'];
const SEASON_BOOST = [{ nature: 0.8 }, { fun: 0.7, food: 0.2 }, { food: 0.6, nature: 0.3, shop: 0.3 }, { relax: 1.0, food: 0.4 }];
const serves = d => d.id === 'teahouse' ? ['food', 'relax'] : d.need ? [d.need] : [];
export function factors() {
  const S = E.S, B = E.buildings, biz = B.filter(b => !['decor', 'path', 'home'].includes(b.def.type));
  const types = new Set(); for (const b of biz) { if (b.def.type === 'lodging') types.add('lodging'); for (const s of serves(b.def)) types.add(s); }
  const facilities = clamp((types.size / 6) * 100, 0, 100);
  const hall = B.some(b => b.def.id === 'hall') ? 25 : 0;
  const clean = clamp(100 - E.litter.length * 5 + hall, 0, 100);
  const appeal = B.reduce((a, b) => a + (b.def.appeal || 0) * levelMul(b.rec.lvl || 1), 0);
  const decoration = clamp(appeal / Math.max(1, biz.length) * 9, 0, 100);
  let trees = 0; for (const t of things.query(0, 0, 45)) if (t.type === 'tree' && t.alive && Math.hypot(t.x, t.z) < 45) trees++;
  const natureB = B.reduce((a, b) => a + (b.def.nature || 0), 0);
  const nature = clamp(trees * 0.9 + natureB * 3, 0, 100);
  const near = biz.filter(b => E.nav.distTo(b.entrance[0], b.entrance[1]) < 10).length;
  const access = clamp((biz.length ? near / biz.length * 85 : 85) + (B.some(b => b.def.id === 'visitor') ? 15 : 0), 0, 100);
  const price = clamp(100 - (S.priceMul - 0.8) * 120, 0, 100);
  const quality = clamp(biz.length ? biz.reduce((a, b) => a + (b.rec.lvl || 1), 0) / biz.length * 33 : 33, 0, 100);
  return { Facilities: facilities, Cleanliness: clean, Decoration: decoration, Nature: nature, Accessibility: access, Price: price, Quality: quality };
}
export function satisfaction() { const s = E.S.sats; return s.length ? s.reduce((a, b) => a + b, 0) / s.length : 65; }
const lodgingCap = () => E.buildings.filter(b => b.def.type === 'lodging').reduce((a, b) => a + Math.round(b.def.cap * levelMul(b.rec.lvl || 1)), 0);
export function maxVisitors() { const at = E.buildings.filter(b => b.def.slots).reduce((a, b) => a + b.def.slots, 0); return Math.min(46, 5 + E.S.level * 2 + lodgingCap() + Math.floor(at * 0.5)); }
function nearAppeal(x, z, r = 14) { let a = 0, n = 0; for (const b of E.buildings) { const d = Math.hypot(b.rec.x - x, b.rec.z - z); if (d < r) { a += (b.def.appeal || 0) * (b.def.type === 'decor' ? 1 : 0.4); n += b.def.nature || 0; } } let trees = 0; for (const t of things.query(x, z, r)) if (t.type === 'tree' && t.alive) trees++; return { a, n: n + trees * 0.5 }; }
function lit(x, z) { for (const b of E.buildings) for (const l of b.lights) if (Math.hypot(l.x - x, l.z - z) < 12) return true; return Math.hypot(x + 3, z - 10) < 10; }

export function spawnVisitor() {
  const S = E.S, rich = (S.level >= 4 && Math.random() < (S.level >= 5 ? 0.3 : 0.15));
  const v = new Visitor(E.scene, { rich, winter: S.season === 3, boost: SEASON_BOOST[S.season] });
  E.visitors.push(v); S.today.arrivals++; S.stats.arrivals++;
  v.emote('heart', 1.5);
}
function seasonalMul(d) { const s = d.seasonal; if (!s) return 1; return s[['spring', 'summer', 'autumn', 'winter'][E.S.season]] ?? 1; }
export const vctx = {
  near(v) { const out = []; for (const o of E.visitors) if (o !== v && Math.abs(o.pos.x - v.pos.x) < 1 && Math.abs(o.pos.z - v.pos.z) < 1) out.push(o.pos); const p = E.player.pos; if (Math.abs(p.x - v.pos.x) < 1 && Math.abs(p.z - v.pos.z) < 1) out.push(p); return out; },
  litterRate(v) { let bins = 0; for (const b of E.buildings) if (b.def.bin && Math.hypot(b.rec.x - v.pos.x, b.rec.z - v.pos.z) < 14) bins++; return 0.006 * (1 - Math.min(0.9, bins * 0.45)) * (E.buildings.some(b => b.def.id === 'hall') ? 0.6 : 1); },
  dropLitter(x, z) { if (E.litter.length >= 40) return; const m = new THREE.Mesh(E.litterGeo, E.litterMat[Math.floor(Math.random() * 3)]); const y = ground(x, z).y; m.position.set(x, y + 0.08, z); m.rotation.set(Math.random() * 3, Math.random() * 3, 0); m.castShadow = true; E.scene.add(m); E.litter.push({ type: 'litter', x, z, mesh: m }); },
  think(v) { think(v); },
};
function leave(v, why) {
  if (v.state === 'leave') return;
  if (why) v.notes.push(why);
  if (v.lodging) { const i = v.lodging.guests.indexOf(v); if (i >= 0) v.lodging.guests.splice(i, 1); v.lodging = null; }
  v.goTo(E.nav, TRAILHEAD.x + (Math.random() - 0.5) * 2, TRAILHEAD.z + 3, null); v.state = 'leave';
  // review
  const S = E.S, f = factors(); const env = (f.Cleanliness + f.Decoration + f.Nature + f.Accessibility) / 4;
  let sat = clamp(v.sat + (env - 55) * 0.25 + (S.festival ? 6 : 0), 0, 100);
  if (v.served === 0) sat = Math.min(sat, 45);
  const stars = clamp(Math.round(sat / 20 + 0.2), 1, 5);
  S.sats.push(sat); if (S.sats.length > 30) S.sats.shift(); S.today.sat.push(sat); S.today.departures++; S.stats.departed++;
  if (stars === 5) S.stats.five++;
  const repGain = (sat - 48) / 5 + v.spent / 50 + (v.rich ? 2 : 0);
  give('rep', repGain, undefined, undefined, true);
  const good = v.notes.filter(n => n[0] === '+').map(n => n.slice(1)), bad = v.notes.filter(n => n[0] === '-').map(n => n.slice(1));
  let text = stars >= 4 ? pick(['What a magical little village.', 'I could stay here forever.', 'Pure cozy. Coming back next season!', 'The forest air and the people — perfect.']) : stars === 3 ? pick(['A nice day out.', 'Pleasant, with room to grow.', 'Lovely spot, a few things missing.']) : pick(['Not much to do yet.', 'I expected more.', 'Hmm. Maybe next time.']);
  if (good.length) text += ' Loved ' + good.slice(0, 2).join(' and ') + '.';
  if (bad.length) text += ' ' + bad[0][0].toUpperCase() + bad[0].slice(1) + '.';
  S.reviews.unshift({ name: v.name, stars, text, day: S.day, spent: Math.round(v.spent) }); if (S.reviews.length > 14) S.reviews.pop();
  v.emote(stars >= 4 ? 'star' : stars <= 2 ? 'sad' : 'heart', 2.5);
}
function useBuilding(v, b) {
  const d = b.def, S = E.S, slots = Math.round((d.slots || 3) * levelMul(b.rec.lvl || 1));
  if (b.occupants >= slots) { v.sat -= 4; v.notes.push('-the wait at the ' + d.name.toLowerCase()); v.emote('sad'); v.timer = 0.6; v.state = 'think'; return; }
  const mul = levelMul(b.rec.lvl || 1);
  let price = (d.price || 0) * mul * S.priceMul * (v.rich ? 1.5 : 1);
  if (d.id === 'bakery' && S.season === 2) price *= 1.5;
  if (d.id === 'grocery' && S.season === 2) price *= 1.3;
  if (price > 0 && v.budget < price) { v.sat -= 3; v.notes.push('-the prices'); v.emote('sad'); v.state = 'think'; v.timer = 0.5; return; }
  if (price > 0) { v.budget -= price; v.spent += price; earn(price, b, b.rec.x, b.rec.z); }
  b.occupants++; b.usesToday++; v.served++; S.today.served++; S.stats.served++;
  const env = nearAppeal(b.rec.x, b.rec.z);
  let gain = 7 + (b.rec.lvl || 1) * 2.5 + Math.min(6, env.a * 0.35) + Math.min(4, env.n * 0.15) - (S.priceMul - 1) * 14 + (seasonalMul(d) > 1 ? 3 : 0) + (S.festival ? 3 : 0);
  if (S.weather === 'rainy' && ['garden', 'tower', 'fishdock', 'playground', 'botanical', 'stage'].includes(d.id)) gain -= 4;
  if (v.lodging && d.lodgingBoost) gain += d.lodgingBoost;
  if (d.family && v.kid) gain += 6;
  v.sat = clamp(v.sat + gain, 0, 100);
  if (gain > 10) v.notes.push('+the ' + d.name.toLowerCase());
  const inside = d.type === 'food' || d.type === 'shop';
  const done = () => { b.occupants = Math.max(0, b.occupants - 1); if (inside) v.rig.root.visible = true; v.emote(gain > 9 ? 'heart' : 'note', 1.6); };
  if (inside) { v.state = 'inside'; v.rig.root.visible = false; v.timer = 6 + Math.random() * 6; v.emote(d.type === 'food' ? 'food' : 'coin', 1.4); v.finish = done; return; }
  // visible activities
  const bb = defBox(d); const [px, pz] = toWorld(bb.cx + (Math.random() - 0.5) * bb.hw, bb.cz + (Math.random() - 0.5) * bb.hd, b.rec.x, b.rec.z, b.rec.rot);
  const act = d.id === 'stage' ? 'cheer' : d.id === 'fishdock' ? 'fish' : d.id === 'tower' ? 'photo' : d.need === 'nature' ? (Math.random() < 0.5 ? 'gather' : 'photo') : d.id === 'hotspring' ? 'sit' : d.id === 'playground' ? (v.kid ? 'cheer' : null) : null;
  let tx = px, tz = pz;
  if (d.id === 'fishdock' && b.fishSpot) { tx = b.fishSpot[0] + (Math.random() - 0.5) * 2; tz = b.fishSpot[1]; }
  v.route = [new THREE.Vector2(tx, tz)]; v.state = 'walk';
  v.then = () => { v.state = 'act'; v.st.action = act; v.st.actionT = 0; v.timer = 9 + Math.random() * 8; if (act === 'photo') { v.emote('photo', 1.5); } v.yaw = Math.atan2(b.rec.x - v.pos.x, b.rec.z - v.pos.z) + (act === 'fish' ? Math.PI : 0); if (act === 'fish') v.yaw = b.rec.rot; v.finish = () => { done(); }; };
}
function think(v) {
  const S = E.S, h = S.hour;
  if (v.state === 'leave') return;
  // evening: check in or head home
  if (h >= 19 || h < 6) {
    if (!v.lodging) {
      const lodges = E.buildings.filter(b => b.def.type === 'lodging' && b.guests.length < Math.round(b.def.cap * levelMul(b.rec.lvl || 1)) && (!b.def.rich || v.rich || v.budget > 120));
      if (lodges.length && v.nights > 0 && v.budget > 10) {
        const b = lodges.sort((a, c) => (c.def.appeal - a.def.appeal) + Math.random() * 2 - 1)[0];
        v.lodging = b; b.guests.push(v);
      } else return leave(v, lodges.length ? null : (E.buildings.some(b => b.def.type === 'lodging') ? '-no free rooms' : '-nowhere to stay the night'));
    }
    const b = v.lodging;
    v.goTo(E.nav, b.entrance[0], b.entrance[1], () => {
      const price = b.def.price * levelMul(b.rec.lvl || 1) * S.priceMul * (v.rich ? 1.4 : 1);
      const paid = Math.min(price, Math.max(0, v.budget + 20)); v.budget -= paid; v.spent += paid; earn(paid, b, b.rec.x, b.rec.z); S.stats.nights++;
      v.sat = clamp(v.sat + 6 + (b.rec.lvl || 1) * 3 + (b.def.appeal || 0) * 0.5 - (S.priceMul - 1) * 10, 0, 100); v.notes.push('+a cosy night in the ' + b.def.name.toLowerCase());
      v.state = 'inside'; v.rig.root.visible = false; v.emote('zzz', 2);
      const hoursLeft = (h >= 19 ? 24 - S.hour + 7.5 : 7.5 - S.hour) + Math.random();
      v.timer = Math.max(2, hoursLeft * SEC_PER_HOUR());
      v.finish = () => { v.nights--; v.goals += 2; v.budget += v.rich ? 60 : 25; if (v.nights <= 0 || Math.random() < 0.3) { const i = b.guests.indexOf(v); if (i >= 0) b.guests.splice(i, 1); v.lodging = null; v.goals = Math.min(v.goals, 2); } };
    });
    return;
  }
  if (v.goals <= 0) return leave(v);
  v.goals--;
  // weighted choice of what to do next
  const opts = [];
  for (const need of NEEDS) {
    const cands = E.buildings.filter(b => serves(b.def).includes(need) && !(b.def.evening && h < 16));
    for (const b of cands) { const d = Math.hypot(b.rec.x - v.pos.x, b.rec.z - v.pos.z); let w = v.prefs[need] * (1 + (b.def.appeal || 0) * 0.08 + (b.rec.lvl || 1) * 0.2) * seasonalMul(b.def) / (1 + d / 50); if (v.done.has(b)) w *= 0.25; if (S.festival && b.def.id === 'stage') w *= 4; if (need === 'food' && v.served === 0) w *= 1.3; opts.push({ w, b }); }
  }
  const benches = E.buildings.filter(b => b.seat);
  if (benches.length) opts.push({ w: 0.35 * v.prefs.relax, bench: pick(benches) });
  opts.push({ w: 0.4 * v.prefs.nature + (E.buildings.length < 3 ? 1 : 0), stroll: true });
  if (h > 17 && h < 19) opts.push({ w: 0.4, campfire: true });
  let tot = opts.reduce((a, o) => a + o.w, 0), r = Math.random() * tot, choice = opts[opts.length - 1];
  for (const o of opts) { r -= o.w; if (r <= 0) { choice = o; break; } }
  if (choice.b) { const b = choice.b; v.done.add(b); v.goTo(E.nav, b.entrance[0], b.entrance[1], () => useBuilding(v, b)); return; }
  if (choice.bench) { const s = choice.bench.seat; v.goTo(E.nav, s.x + Math.sin(s.ry) * 0.6, s.z + Math.cos(s.ry) * 0.6, () => { v.pos.x = s.x; v.pos.z = s.z; v.yaw = s.ry; v.state = 'act'; v.st.action = 'sit'; v.timer = 8 + Math.random() * 8; v.sat = clamp(v.sat + 3 + Math.min(4, nearAppeal(s.x, s.z).a * 0.3), 0, 100); v.finish = () => v.emote('heart', 1.2); }); return; }
  if (choice.campfire) { const seat = pick(world.benchSeats); v.goTo(E.nav, seat.x, seat.z, () => { v.yaw = seat.ry; v.state = 'act'; v.st.action = 'sit'; v.timer = 10; v.sat = clamp(v.sat + 4, 0, 100); v.notes.push('+the campfire'); v.finish = () => v.emote('note', 1.4); }); return; }
  // stroll: pick a scenic path node, enjoy nature there
  const nodes = E.nav.nodes.filter(n => !n.dead && E.S.unlocked[regionAt(n.x, n.z)] && Math.hypot(n.x - v.pos.x, n.z - v.pos.z) < 45);
  const n = pick(nodes.length ? nodes : E.nav.nodes);
  v.goTo(E.nav, n.x + (Math.random() - 0.5) * 2, n.z + (Math.random() - 0.5) * 2, () => { const env = nearAppeal(v.pos.x, v.pos.z); v.state = 'act'; v.st.action = Math.random() < 0.4 ? 'photo' : null; v.timer = 3 + Math.random() * 4; v.sat = clamp(v.sat + Math.min(5, env.n * 0.2 + env.a * 0.2) - (lit(v.pos.x, v.pos.z) || S.hour < 18 ? 0 : 2), 0, 100); if (env.n > 8) v.emote('leaf', 1.3); });
}
export function updateVisitors(dt) {
  for (const v of E.visitors) { v.update(dt, vctx); if (v.state === 'idle') { v.state = 'think'; v.timer = 0.3; } }
  for (let i = E.visitors.length - 1; i >= 0; i--) { const v = E.visitors[i]; if (!v.alive) { v.dispose(E.scene); E.visitors.splice(i, 1); } }
}
export function hourlyArrivals() {
  const S = E.S, h = S.hour;
  if (h < 7 || h > 17.5) return 0;
  const f = factors(), appeal = E.buildings.reduce((a, b) => a + (b.def.appeal || 0), 0);
  let lam = 0.6 + appeal * 0.03 + S.rep * 0.0022 + (f.Facilities / 100) * 0.8;
  if (E.buildings.some(b => b.def.id === 'visitor')) lam *= 1.3;
  lam *= { sunny: 1.15, cloudy: 1, rainy: 0.55, snowy: 0.75, foggy: 0.8 }[S.weather];
  lam *= [1.05, 1.2, 1, 0.85][S.season];
  lam *= 0.6 + satisfaction() / 100 * 0.6;
  if (S.festival) lam *= 2.2;
  return lam;
}

// ---------- progression ----------
export const QUESTS = [
  { t: 'Gather supplies', d: 'Chop 3 trees and break 2 rocks (walk up and press E).', p: S => Math.min(1, (Math.min(3, S.stats.trees) + Math.min(2, S.stats.rocks)) / 5), r: { coins: 60 } },
  { t: 'Open a café', d: 'Press B, pick the Small Café and place it near a path.', p: S => E.buildings.some(b => b.def.id === 'cafe') ? 1 : 0, r: { coins: 80, wood: 10 } },
  { t: 'Plant a flower garden', d: 'Build a Flower Garden — visitors love to stroll.', p: S => E.buildings.some(b => b.def.id === 'garden') ? 1 : 0, r: { coins: 50, flowers: 6 } },
  { t: 'Welcome your first guests', d: 'See 5 visitors enjoy their day and head home.', p: S => Math.min(1, S.stats.departed / 5), r: { coins: 100 } },
  { t: 'A place to stay', d: 'Build a Wooden Cabin or a Camping Ground for overnight guests.', p: S => E.buildings.some(b => b.def.type === 'lodging') ? 1 : 0, r: { coins: 120 } },
  { t: 'Become a Cozy Hamlet', d: 'Reach 100 reputation through happy visitors.', p: S => Math.min(1, S.rep / 100), r: { coins: 150 } },
  { t: 'Down to the lake', d: 'Unlock the Lakeside at its gate south of the village.', p: S => S.unlocked[1] ? 1 : 0, r: { coins: 200 } },
  { t: 'Gone fishing', d: 'Face the water and press E to cast. Catch 3 fish.', p: S => Math.min(1, S.stats.fish / 3), r: { coins: 120 } },
  { t: 'Fields of gold', d: 'Unlock the Meadow, east across the bridge.', p: S => S.unlocked[3] ? 1 : 0, r: { coins: 200, flowers: 10 } },
  { t: 'Green thumb', d: 'Build a Greenhouse to grow flowers all year.', p: S => E.buildings.some(b => b.def.id === 'greenhouse') ? 1 : 0, r: { coins: 150 } },
  { t: 'Become a Forest Village', d: 'Reach 350 reputation.', p: S => Math.min(1, S.rep / 350), r: { coins: 300 } },
  { t: 'Up the mountain', d: 'Unlock the Highlands to the north.', p: S => S.unlocked[2] ? 1 : 0, r: { coins: 300 } },
  { t: 'Soak it in', d: 'Build a Hot Spring in the Highlands.', p: S => E.buildings.some(b => b.def.id === 'hotspring') ? 1 : 0, r: { coins: 400 } },
  { t: 'Become a Popular Resort', d: 'Reach 900 reputation.', p: S => Math.min(1, S.rep / 900), r: { coins: 500 } },
  { t: 'Into the Old Woodland', d: 'Unlock the ancient forest to the west.', p: S => S.unlocked[4] ? 1 : 0, r: { coins: 400 } },
  { t: 'Keeper of relics', d: 'Find the three relics hidden among the ruins.', p: S => S.found.filter(f => f.startsWith('relic')).length / 3, r: { coins: 600 } },
  { t: 'Evergreen Paradise', d: 'Reach 2000 reputation and complete your village.', p: S => Math.min(1, S.rep / 2000), r: { coins: 1000 } },
];
const DAILY = [
  { t: 'Busy day', d: 'Serve 14 visitor activities today', p: T => T.served / 14, r: { coins: 60 } },
  { t: 'Good business', d: 'Earn 250 coins today', p: T => T.income / 250, r: { wood: 15, stone: 10 } },
  { t: 'Forager', d: 'Gather 12 resources today', p: T => T.gathered / 12, r: { coins: 50 } },
  { t: 'Open doors', d: 'Welcome 8 new visitors today', p: T => T.arrivals / 8, r: { flowers: 8, coins: 30 } },
  { t: 'Tidy trails', d: 'Pick up 3 pieces of litter today', p: T => T.litter / 3, r: { coins: 40 } },
];
const SEASONAL = [
  { t: 'Spring planting', d: 'Place 3 Flower Beds this spring', ids: ['flowerbed', 'moonbed', 'rarebed'], n: 3, r: { coins: 120, rep: 15 } },
  { t: 'Summer on the water', d: 'Catch 4 fish this summer', fish: 4, r: { coins: 150, rep: 15 } },
  { t: 'Harvest fair', d: 'Place 2 Harvest Pumpkins this autumn', ids: ['pumpkins'], n: 2, r: { coins: 150, rep: 15 } },
  { t: 'Winter wonderland', d: 'Build a Snowman and a Light Tree', ids: ['snowman', 'lighttree'], n: 2, r: { coins: 200, rep: 20 } },
];
export const ACH = [
  ['first', 'Groundbreaking', 'Place your first building', S => (S.stats.built || 0) >= 1],
  ['lumber', 'Lumberjack', 'Chop 25 trees', S => S.stats.trees >= 25],
  ['mason', 'Stonemason', 'Break 25 rocks', S => S.stats.rocks >= 25],
  ['florist', 'Florist', 'Pick 30 wildflower clumps', S => S.stats.clumps >= 30],
  ['angler', 'Angler', 'Catch 10 fish', S => S.stats.fish >= 10],
  ['golden', 'Golden Catch', 'Land a Golden Carp', S => !!S.fish['Golden Carp']],
  ['host', 'Good Host', '50 visitors enjoyed their stay', S => S.stats.departed >= 50],
  ['crowd', 'Crowd Pleaser', '300 visitors enjoyed their stay', S => S.stats.departed >= 300],
  ['five', 'Five Stars', 'Receive a 5-star review', S => S.stats.five >= 1],
  ['nest', 'Nest Egg', 'Hold 5,000 coins at once', S => S.coins >= 5000],
  ['upgrade', 'Master Builder', 'Upgrade a building to level 3', S => S.stats.maxLvl >= 3],
  ['explorer', 'Explorer', 'Unlock every region', S => S.unlocked.every(Boolean)],
  ['wander', 'Wanderer', 'Make 10 discoveries', S => S.found.length >= 10],
  ['story', 'Storyteller', "Read all five Caretaker's Journals", S => S.found.filter(f => f.startsWith('journal')).length >= 5],
  ['carto', 'Cartographer', 'Make every discovery', S => S.found.length >= 20],
  ['tidy', 'Tidy Trails', 'Pick up 20 pieces of litter', S => S.stats.litter >= 20],
  ['festival', 'Festival Night', 'Host a seasonal festival', S => S.stats.festivals >= 1],
  ['year', 'A Full Year', 'See all four seasons', S => S.seasonsSeen.length >= 4],
  ['owl', 'Night Owl', 'Be out exploring at 2 a.m.', S => !!S.stats.owl],
  ['paradise', 'Evergreen Paradise', 'Reach the highest reputation level', S => S.level >= 5],
];
export function grant(r, x, z) { for (const [k, v] of Object.entries(r)) if (k !== 'unlock') give(k, v, x, z, x === undefined); }
export function newDaily() { const d = pick(DAILY); E.S.daily = { i: DAILY.indexOf(d), done: false }; }
export function dailyDef() { return E.S.daily ? DAILY[E.S.daily.i] : null; }
export function seasonalDef() { return E.S.seasonal ? SEASONAL[E.S.seasonal.i] : null; }
export function newSeasonal() { const i = E.S.season; E.S.seasonal = { i, count: 0, ids: SEASONAL[i].ids || null, fish0: E.S.stats.fish, done: false }; }
export function checkProgress() {
  const S = E.S;
  const q = QUESTS[S.quest]; if (q && q.p(S) >= 1) { grant(q.r); E.audio.fanfare(); E.ui.toast(`Objective complete: ${q.t}`, 'gold'); S.quest++; }
  const dd = dailyDef(); if (dd && !S.daily.done && dd.p(S.today) >= 1) { S.daily.done = true; grant(dd.r); E.ui.toast(`Daily goal done: ${dd.t}`, 'gold'); E.audio.coin(); }
  const sd = seasonalDef(); if (sd && !S.seasonal.done) { const prog = sd.fish ? (S.stats.fish - S.seasonal.fish0) / sd.fish : S.seasonal.count / sd.n; if (prog >= 1) { S.seasonal.done = true; grant(sd.r); E.ui.toast(`Seasonal goal done: ${sd.t}`, 'gold'); E.audio.fanfare(); } }
  const lvl = levelOf(S.rep); if (lvl > S.level) { S.level = lvl; E.audio.fanfare(); E.ui.levelUp(lvl); }
  for (const [id, name, desc, f] of ACH) if (!S.ach.includes(id) && f(S)) { S.ach.push(id); E.ui.toast(`Achievement: ${name}`, 'gold'); }
  E.ui.objective();
}

// ---------- save / load ----------
const KEY = 'evergreen-save-v1';
export function serialize() {
  syncRecords(); const S = E.S, p = E.player;
  S.player = { x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, camYaw: E.camRig.yaw };
  S.savedAt = Date.now();
  return JSON.stringify(S);
}
// PlayCraft: when the player is signed in, the village is also kept in their PlayCraft account
// (PCA.writeSave, at most every 25 s and when the page is hidden). localStorage stays as a fallback,
// kept per player so two kids on one computer never see each other's village.
const PCA = (() => { try { return window.parent !== window && window.parent.Account ? window.parent.Account : null; } catch (e) { return null; } })();
const SLUG = 'evergreen', CLOUD_GAP = 25000;
const pcUser = () => { try { return PCA && PCA.signedIn && PCA.profile ? String(PCA.profile.username || '') : ''; } catch (e) { return ''; } };
const lsKey = () => { const u = pcUser(); return u ? KEY + ':' + u : KEY; };
let cloudStr = null, cloudPending = null, cloudLast = 0, cloudTimer = 0;
const stampOf = str => { try { return +(JSON.parse(str).savedAt) || 0; } catch (e) { return 0; } };
export async function initCloud() {
  if (!PCA) return;
  for (let i = 0; i < 50 && !PCA.ready; i++) await new Promise(r => setTimeout(r, 100));
  if (!pcUser()) return;
  try { const sv = await PCA.loadSave(SLUG); const d = sv && sv.data; if (d && d.state && d.state.v === 1) cloudStr = JSON.stringify(d.state); } catch (e) { }
}
function cloudPush() {
  cloudTimer = 0; if (!cloudPending || !pcUser()) return;
  const str = cloudPending; cloudPending = null; cloudLast = Date.now();
  let state; try { state = JSON.parse(str); } catch (e) { return; }
  // safety net: an account save should stay small (normally ~1-20 KB); drop the history lists if it ever grows past 200 KB
  if (str.length > 200000) { state.reviews = []; state.ledger = state.ledger.slice(-7); state.sats = []; state.festivalDone = {}; }
  try { const p = PCA.writeSave(SLUG, { state }); if (p && p.catch) p.catch(() => { }); cloudStr = str; } catch (e) { }
}
function cloudQueue(str) {
  if (!pcUser()) return; cloudPending = str;
  if (cloudTimer) return; const wait = Math.max(0, CLOUD_GAP - (Date.now() - cloudLast));
  cloudTimer = setTimeout(cloudPush, wait);
}
export function flushCloud() { if (cloudTimer) { clearTimeout(cloudTimer); cloudTimer = 0; } cloudPush(); }
export function saveGame(silent) {
  const data = serialize(); let ok = false;
  try { localStorage.setItem(lsKey(), data); ok = true; } catch (e) { ok = false; }
  E.lastSave = data; cloudQueue(data);
  const signed = !!pcUser();
  if (!silent) { if (signed) flushCloud(); E.ui.toast(ok || signed ? `Saved · Day ${E.S.day}, ${SEASONS[E.S.season]}` : 'Saved for now, but this browser could not keep it. Copy a save code from the menu to be safe.', ok || signed ? '' : 'warn'); }
  return ok || signed;
}
function localSave() { try { return localStorage.getItem(lsKey()); } catch (e) { return null; } }
export function hasSave() { return !!(cloudStr || localSave() || E.lastSave); }
export function readSave() {
  const loc = localSave();
  if (cloudStr && loc) return stampOf(loc) > stampOf(cloudStr) ? loc : cloudStr;
  return cloudStr || loc || E.lastSave;
}
export function resetWorldState() {
  for (const b of [...E.buildings]) removeBuilding(b);
  for (const v of E.visitors) v.dispose(E.scene); E.visitors.length = 0;
  for (const l of E.litter) E.scene.remove(l.mesh); E.litter.length = 0;
  world.trees.forEach(t => { if (!t.alive || t.cleared) { t.alive = true; t.cleared = 0; setTreeVisible(t, 1); colliders.remove(t.col); colliders.add(t.col); if (t.stump !== undefined) { world.stumps.setMatrixAt(t.stump, new THREE.Matrix4().makeScale(0, 0, 0)); world.stumpFree.push(t.stump); t.stump = undefined; } } });
  world.stumps.instanceMatrix.needsUpdate = true;
  for (const t of [...world.rocks, ...world.clumps]) if (!t.alive) showThing(t);
  for (const d of world.discoveries) { d.found = false; d.group.visible = true; }
}
export function applyState(S) {
  resetWorldState();
  const base = newState(); S = Object.assign(base, S); S.stats = Object.assign(base.stats, S.stats || {}); S.settings = Object.assign(newState().settings, S.settings || {});
  E.S = S; S.today = Object.assign(newDay(), S.today || {}); S.today.by = S.today.by || {};
  // gates
  world.gates.forEach(g => { if (S.unlocked[g.region] && !g.open) openGate(g, true); });
  // buildings (home first)
  if (!S.buildings.some(b => b.id === 'home')) S.buildings.unshift({ uid: S.uid++, id: 'home', x: -9, z: 3, rot: 0.25, lvl: 1 });
  for (const rec of S.buildings) createBuilding(rec);
  // resource nodes
  const trees = { ...S.trees }; S.trees = {};
  for (const [k, v] of Object.entries(trees)) { const t = world.trees[k]; if (!t || !t.alive) continue; if (v === -1) { if (!t.cleared) { t.alive = false; setTreeVisible(t, 0); colliders.remove(t.col); S.trees[k] = gameHours() + 24; } } else { t.alive = false; setTreeVisible(t, 0); colliders.remove(t.col); S.trees[k] = v; const si = world.stumpFree.pop(); if (si !== undefined) { t.stump = si; world.stumps.setMatrixAt(si, new THREE.Matrix4().compose(new THREE.Vector3(t.x, t.y, t.z), new THREE.Quaternion(), new THREE.Vector3(t.s, t.s, t.s))); } } }
  world.stumps.instanceMatrix.needsUpdate = true;
  const rocks = { ...S.rocks }, clumps = { ...S.clumps }; S.rocks = {}; S.clumps = {};
  for (const [k, v] of Object.entries(rocks)) { const t = world.rocks[k]; if (t && t.alive) hideThing(t, v === null ? Infinity : v); }
  for (const [k, v] of Object.entries(clumps)) { const t = world.clumps[k]; if (t && t.alive) hideThing(t, v === null ? Infinity : v); }
  for (const d of world.discoveries) if (S.found.includes(d.id)) { d.found = true; d.group.visible = false; }
  if (S.player) { E.player.pos.set(S.player.x, S.player.y, S.player.z); E.player.yaw = S.player.yaw; E.camRig.yaw = S.player.camYaw ?? S.player.yaw + Math.PI; }
  else { E.player.pos.set(-4, height(-4, 9), 9); E.player.yaw = Math.PI * 0.9; E.camRig.yaw = Math.PI * 0.9 + Math.PI; }
  E.camRig.target.copy(E.player.pos);
  if (!S.daily) newDaily(); if (!S.seasonal) newSeasonal();
  E.ui.res(); E.ui.objective();
}
export function loadGame(str) {
  try { const S = JSON.parse(str); if (!S || S.v !== 1) throw 0; applyState(S); return true; } catch (e) { E.ui.toast('That save could not be read', 'warn'); return false; }
}
export function newGame() { applyState(newState()); }
