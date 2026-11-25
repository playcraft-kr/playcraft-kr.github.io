// EVERGREEN — path network navigation and visitor agents
import * as THREE from 'three';
import { PATHS, TRAILHEAD, ground, WL } from './terrain.js';
import { makeCharacter, animate } from './player.js';
import { clamp, damp, angDiff, pick, distToSeg } from './util.js';

// ---------- navigation graph ----------
export class Nav {
  constructor() {
    this.nodes = [];
    for (const p of PATHS) {
      let prev = null;
      for (let i = 0; i < p.length - 1; i++) {
        const [ax, az] = p[i], [bx, bz] = p[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 5));
        for (let k = (i === 0 ? 0 : 1); k <= n; k++) { const t = k / n, nd = this.node(ax + (bx - ax) * t, az + (bz - az) * t, true); if (prev && prev !== nd) this.link(prev, nd); prev = nd; }
      }
    }
  }
  node(x, z, merge, extra) {
    if (merge) for (const n of this.nodes) if (Math.hypot(n.x - x, n.z - z) < 1.6) return n;
    const n = { x, z, adj: [], id: this.nodes.length, ...extra }; this.nodes.push(n); return n;
  }
  link(a, b) { if (!a.adj.includes(b)) a.adj.push(b); if (!b.adj.includes(a)) b.adj.push(a); }
  unlinkNode(n) { for (const o of n.adj) o.adj.splice(o.adj.indexOf(n), 1); n.adj = []; n.dead = true; }
  crossesWater(a, b) { for (let t = 0.2; t < 1; t += 0.2) { const g = ground(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t); if (g.water && g.depth > 0.6) return true; } return false; }
  // add a walkable piece (path tile / bridge end) and connect it to nearby nodes
  addPiece(points, tag) {
    const made = points.map(([x, z]) => this.node(x, z, false, { tag }));
    for (let i = 0; i < made.length - 1; i++) this.link(made[i], made[i + 1]);
    for (const m of made) for (const n of this.nodes) { if (n === m || n.dead || made.includes(n)) continue; const d = Math.hypot(n.x - m.x, n.z - m.z); if (d < 6.5 && (tag.bridge || !this.crossesWater(m, n))) this.link(m, n); }
    return made;
  }
  removePiece(nodes) { for (const n of nodes) this.unlinkNode(n); }
  nearest(x, z) { let best = null, bd = 1e9; for (const n of this.nodes) { if (n.dead) continue; const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n; } } return best; }
  distTo(x, z) { let m = 1e9; for (const n of this.nodes) { if (n.dead) continue; for (const o of n.adj) if (o.id > n.id) { const d = distToSeg(x, z, n.x, n.z, o.x, o.z); if (d < m) m = d; } } return m; }
  route(ax, az, bx, bz) {
    const s = this.nearest(ax, az), e = this.nearest(bx, bz); if (!s || !e) return [];
    const open = [s], came = new Map(), gS = new Map([[s, 0]]), fS = new Map([[s, Math.hypot(s.x - e.x, s.z - e.z)]]);
    const closed = new Set();
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (fS.get(open[i]) < fS.get(open[bi])) bi = i;
      const cur = open.splice(bi, 1)[0];
      if (cur === e) { const out = [cur]; let c = cur; while (came.has(c)) { c = came.get(c); out.unshift(c); } return out.map(n => new THREE.Vector2(n.x, n.z)); }
      closed.add(cur);
      for (const nb of cur.adj) {
        if (closed.has(nb)) continue; const g = gS.get(cur) + Math.hypot(nb.x - cur.x, nb.z - cur.z);
        if (!gS.has(nb) || g < gS.get(nb)) { came.set(nb, cur); gS.set(nb, g); fS.set(nb, g + Math.hypot(nb.x - e.x, nb.z - e.z)); if (!open.includes(nb)) open.push(nb); }
      }
    }
    return [new THREE.Vector2(s.x, s.z), new THREE.Vector2(e.x, e.z)];
  }
}

// ---------- emote bubbles ----------
const ICONS = {};
function icon(kind) {
  if (ICONS[kind]) return ICONS[kind];
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(32, 30, 24, 0, 7); g.fill(); g.beginPath(); g.moveTo(24, 50); g.lineTo(32, 62); g.lineTo(38, 50); g.fill();
  g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round';
  const col = { heart: '#e0475b', coin: '#d9a431', star: '#e8b42f', sad: '#6a7a8a', note: '#3f6ea8', zzz: '#6a5aa8', photo: '#3a3a3a', leaf: '#3f8a4a', food: '#b8652f' }[kind];
  g.fillStyle = col; g.strokeStyle = col;
  if (kind === 'heart') { g.beginPath(); g.moveTo(32, 42); g.bezierCurveTo(14, 30, 20, 14, 32, 23); g.bezierCurveTo(44, 14, 50, 30, 32, 42); g.fill(); }
  else if (kind === 'coin') { g.beginPath(); g.arc(32, 30, 13, 0, 7); g.fill(); g.fillStyle = '#fff3c4'; g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.fillText('$', 32, 37); }
  else if (kind === 'star') { g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 7 : 15, a = i / 10 * Math.PI * 2 - Math.PI / 2; g.lineTo(32 + Math.cos(a) * r, 30 + Math.sin(a) * r); } g.fill(); }
  else if (kind === 'sad') { g.beginPath(); g.arc(25, 25, 2.5, 0, 7); g.arc(39, 25, 2.5, 0, 7); g.fill(); g.beginPath(); g.arc(32, 42, 9, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
  else if (kind === 'note') { g.beginPath(); g.arc(26, 38, 6, 0, 7); g.fill(); g.fillRect(30, 16, 4, 22); g.fillRect(30, 16, 12, 4); }
  else if (kind === 'zzz') { g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.fillText('z z', 32, 38); }
  else if (kind === 'photo') { g.fillRect(18, 22, 28, 18); g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(32, 31, 6, 0, 7); g.fill(); g.fillStyle = col; g.fillRect(26, 18, 10, 5); }
  else if (kind === 'leaf') { g.beginPath(); g.ellipse(32, 30, 8, 14, 0.7, 0, 7); g.fill(); }
  else if (kind === 'food') { g.beginPath(); g.arc(32, 32, 12, 0, Math.PI); g.fill(); g.fillRect(19, 30, 26, 3); g.strokeStyle = '#b8652f'; g.beginPath(); g.moveTo(28, 22); g.quadraticCurveTo(30, 16, 28, 12); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return ICONS[kind] = new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true });
}

const SHIRTS = [0xd2483c, 0x3d6ea8, 0xf2c14e, 0x6fa077, 0x9a7bd1, 0xe08a3c, 0x2f5d45, 0xf29bb5, 0x5b8fd6, 0xe8dcc0, 0x7a4f30];
const PANTS = [0x3b4a66, 0x5a4636, 0x2b2622, 0x7a6a58, 0x4a5a3a, 0x8a7a68];
const SKIN = [0xf1c9a5, 0xe0ac85, 0xc68a62, 0x9a6a48, 0x6e4a32, 0xf5d6bc];
const HAIR = [0x2a1d14, 0x5a3a22, 0xb08040, 0xd9c08a, 0x8a3a20, 0x3a3a3a, 0xe8e2d6];
const NAMES = ['Ada', 'Bo', 'Cleo', 'Dev', 'Elin', 'Finn', 'Gus', 'Hana', 'Iris', 'Jun', 'Kai', 'Lena', 'Milo', 'Nia', 'Oskar', 'Pia', 'Quinn', 'Rui', 'Sol', 'Tove', 'Uma', 'Vik', 'Wren', 'Yara', 'Zed', 'Noor', 'Theo', 'Mei', 'Ravi', 'Lumi'];

export class Visitor {
  constructor(scene, opts) {
    const r = Math.random;
    this.kid = r() < 0.15; this.rich = opts.rich;
    this.rig = makeCharacter({ shirt: pick(SHIRTS), pants: pick(PANTS), skin: pick(SKIN), hair: pick(HAIR), hat: r() < 0.45 ? pick(['sun', 'cap', 'beanie']) : null, hatColor: pick(SHIRTS), scarf: opts.winter || r() < 0.2 ? pick(SHIRTS) : false, backpack: r() < 0.35 ? pick([0x8a5a3c, 0x3f6a3a, 0x3d6ea8]) : null, scale: this.kid ? 0.68 : 0.88 + r() * 0.16 });
    scene.add(this.rig.root);
    this.name = pick(NAMES);
    this.prefs = { food: 0.6 + r(), nature: 0.4 + r(), fun: 0.3 + r() + (this.kid ? 1 : 0), relax: 0.3 + r(), shop: 0.3 + r() * 0.8, photo: 0.2 + r() };
    for (const k of Object.keys(opts.boost || {})) this.prefs[k] = (this.prefs[k] || 0) + opts.boost[k];
    this.budget = (this.rich ? 160 : 40) + r() * (this.rich ? 200 : 90);
    this.spent = 0; this.sat = 54; this.notes = []; this.served = 0; this.nights = r() < 0.4 ? 2 : 1;
    this.pos = new THREE.Vector3(TRAILHEAD.x + (r() - 0.5) * 3, 0, TRAILHEAD.z + (r() - 0.5) * 3);
    this.pos.y = ground(this.pos.x, this.pos.z).y; this.yaw = 0; this.speed = 1.5 + r() * 0.6; if (this.kid) this.speed += 0.4;
    this.st = { speed: 0, grounded: true, action: null, actionT: 0 };
    this.route = []; this.state = 'think'; this.timer = 0.5 + r(); this.target = null; this.goals = 3 + Math.floor(r() * 4); this.done = new Set();
    this.bubble = new THREE.Sprite(icon('heart')); this.bubble.scale.set(0.6, 0.6, 1); this.bubble.visible = false; scene.add(this.bubble); this.bubbleT = 0;
    this.lodging = null; this.fade = 0; this.alive = true; this.vx = 0; this.vz = 0;
    this.rig.root.position.copy(this.pos); this.baseScale = this.rig.root.scale.x; this.rig.root.scale.setScalar(0.01); this.grow = 0;
  }
  emote(kind, t = 2.2) { this.bubble.material = icon(kind); this.bubble.visible = true; this.bubbleT = t; }
  goTo(nav, x, z, then) {
    this.route = nav.route(this.pos.x, this.pos.z, x, z); this.route.push(new THREE.Vector2(x, z));
    // drop the first node if we are already past it
    if (this.route.length > 2 && Math.hypot(this.route[1].x - this.pos.x, this.route[1].y - this.pos.z) < Math.hypot(this.route[0].x - this.route[1].x, this.route[0].y - this.route[1].y)) this.route.shift();
    this.state = 'walk'; this.then = then;
  }
  update(dt, ctx) {
    if (this.grow < 1) { this.grow = Math.min(1, this.grow + dt * 2); this.rig.root.scale.setScalar(this.baseScale * Math.max(0.01, this.grow)); }
    if (this.state === 'leave' && this.route.length === 0) this.rig.root.scale.setScalar(this.baseScale * Math.max(0.01, 1 - this.fade / 0.6));
    if (this.bubbleT > 0) { this.bubbleT -= dt; this.bubble.position.set(this.pos.x, this.pos.y + 2.6 * (this.kid ? 0.75 : 1), this.pos.z); this.bubble.material.opacity = Math.min(1, this.bubbleT * 2); if (this.bubbleT <= 0) this.bubble.visible = false; }
    if (this.state === 'walk' || this.state === 'leave') {
      const wp = this.route[0];
      if (!wp) { if (this.state === 'walk') this.state = 'arrive'; }
      else {
        const dx = wp.x - this.pos.x, dz = wp.y - this.pos.z, d = Math.hypot(dx, dz);
        if (d < (this.route.length > 1 ? 1.2 : 0.4)) this.route.shift();
        else {
          let vx = dx / d * this.speed, vz = dz / d * this.speed;
          // gentle separation from other walkers and the player
          for (const o of ctx.near(this)) { const ox = this.pos.x - o.x, oz = this.pos.z - o.z, od = Math.hypot(ox, oz); if (od < 0.9 && od > 0.01) { vx += ox / od * 0.9; vz += oz / od * 0.9; } }
          this.vx = damp(this.vx, vx, 6, dt); this.vz = damp(this.vz, vz, 6, dt);
          this.pos.x += this.vx * dt; this.pos.z += this.vz * dt;
          const want = Math.atan2(this.vx, this.vz); this.yaw += angDiff(this.yaw, want) * (1 - Math.exp(-8 * dt));
          if (Math.random() < dt * ctx.litterRate(this)) ctx.dropLitter(this.pos.x, this.pos.z);
        }
      }
      this.st.speed = Math.hypot(this.vx, this.vz);
    } else { this.vx = damp(this.vx, 0, 8, dt); this.vz = damp(this.vz, 0, 8, dt); this.st.speed = 0; }
    if (this.state === 'arrive') { this.state = 'idle'; this.then && this.then(); }
    if (this.state === 'act' || this.state === 'think' || this.state === 'inside') { this.timer -= dt; if (this.timer <= 0) { if (this.state === 'inside') { this.rig.root.visible = true; } this.finish && this.finish(); this.finish = null; this.state = 'think'; this.st.action = null; ctx.think(this); } }
    if (this.st.action) this.st.actionT += dt;
    const g = ground(this.pos.x, this.pos.z); this.pos.y = damp(this.pos.y, g.water ? Math.max(g.y, WL - 0.6) : g.y, 20, dt);
    if (this.state !== 'inside') { animate(this.rig, this.st, dt); this.rig.root.position.copy(this.pos); this.rig.root.rotation.y = this.yaw; }
    if (this.state === 'leave' && this.route.length === 0) { this.fade += dt; if (this.fade > 0.6) this.alive = false; }
  }
  dispose(scene) { scene.remove(this.rig.root); scene.remove(this.bubble); this.rig.root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
}
