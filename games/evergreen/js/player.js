// EVERGREEN — stylised character rig, third-person controller and collision-aware camera
import * as THREE from 'three';
import { clamp, damp, angDiff, lerp } from './util.js';
import { ground, height, slopeAt, WL } from './terrain.js';
import { colliders } from './world.js';
import { patch } from './materials.js';

const matCache = new Map();
const mat = (c, r = 0.75) => { const k = c + '_' + r; if (!matCache.has(k)) matCache.set(k, patch(new THREE.MeshStandardMaterial({ color: c, roughness: r }), { snow: 0.25 })); return matCache.get(k); };
const capsule = (r, l, m) => { const g = new THREE.CapsuleGeometry(r, l, 4, 10); const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; return mesh; };

export function makeCharacter(o = {}) {
  const skin = mat(o.skin ?? 0xf1c9a5, 0.6), shirt = mat(o.shirt ?? 0x3f7d58), pants = mat(o.pants ?? 0x5a4636), boots = mat(o.boots ?? 0x4a3020, 0.9), hairM = mat(o.hair ?? 0x5a3a22, 0.9);
  const root = new THREE.Group(), hips = new THREE.Group(); hips.position.y = 0.92; root.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  const body = capsule(0.27, 0.42, shirt); body.position.y = 0.36; body.scale.set(1, 1, 0.82); torso.add(body);
  if (o.scarf !== false) { const sc = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.07, 6, 14), mat(o.scarf ?? 0xd2483c)); sc.rotation.x = Math.PI / 2; sc.position.y = 0.72; torso.add(sc); }
  if (o.backpack) { const bp = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.18), mat(o.backpack, 0.9)); bp.position.set(0, 0.42, -0.27); bp.castShadow = true; torso.add(bp); const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8), mat(0x6b4a2f)); roll.rotation.z = Math.PI / 2; roll.position.set(0, 0.68, -0.27); torso.add(roll); }
  const neck = new THREE.Group(); neck.position.y = 0.74; torso.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), skin); head.position.y = 0.22; head.castShadow = true; neck.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.262, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM); hair.position.y = 0.24; hair.rotation.x = -0.25; neck.add(hair);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 6), mat(0x2a2220, 0.4)); e.position.set(s * 0.09, 0.25, 0.22); neck.add(e); const ck = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), mat(0xf09a8a, 0.8)); ck.position.set(s * 0.15, 0.17, 0.19); ck.scale.z = 0.4; neck.add(ck); }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), skin); nose.position.set(0, 0.2, 0.25); neck.add(nose);
  if (o.hat === 'beanie') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(o.hatColor ?? 0xd2483c, 0.95)); b.position.y = 0.27; neck.add(b); const pom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(0xf5f1e8)); pom.position.y = 0.55; neck.add(pom); const rim = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.04, 6, 16), mat(o.hatColor ?? 0xd2483c)); rim.rotation.x = Math.PI / 2; rim.position.y = 0.3; neck.add(rim); }
  else if (o.hat === 'sun') { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 16), mat(o.hatColor ?? 0xe8d29a, 0.9)); b.position.y = 0.36; neck.add(b); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.18, 14), mat(o.hatColor ?? 0xe8d29a, 0.9)); c.position.y = 0.45; neck.add(c); }
  else if (o.hat === 'cap') { const c = new THREE.Mesh(new THREE.SphereGeometry(0.265, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), mat(o.hatColor ?? 0x3d6ea8)); c.position.y = 0.27; neck.add(c); const v = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 12, 1, false, 0, Math.PI), mat(o.hatColor ?? 0x3d6ea8)); v.position.set(0, 0.34, 0.18); neck.add(v); }
  const mkArm = s => { const sh = new THREE.Group(); sh.position.set(s * 0.33, 0.6, 0); torso.add(sh); const up = capsule(0.085, 0.32, shirt); up.position.y = -0.2; sh.add(up); const el = new THREE.Group(); el.position.y = -0.38; sh.add(el); const lo = capsule(0.075, 0.24, shirt); lo.position.y = -0.14; el.add(lo); const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), skin); hand.position.y = -0.33; hand.castShadow = true; el.add(hand); return { sh, el, hand }; };
  const mkLeg = s => { const hp = new THREE.Group(); hp.position.set(s * 0.14, 0.02, 0); hips.add(hp); const up = capsule(0.105, 0.3, pants); up.position.y = -0.22; hp.add(up); const kn = new THREE.Group(); kn.position.y = -0.44; hp.add(kn); const lo = capsule(0.095, 0.26, pants); lo.position.y = -0.18; kn.add(lo); const bt = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.14, 0.3), boots); bt.position.set(0, -0.42, 0.05); bt.castShadow = true; kn.add(bt); return { hp, kn }; };
  const rig = { root, hips, torso, neck, armL: mkArm(1), armR: mkArm(-1), legL: mkLeg(1), legR: mkLeg(-1), phase: Math.random() * 6, idleT: Math.random() * 10, look: 0 };
  root.scale.setScalar(o.scale ?? 1);
  // held tool (axe / rod), hidden unless needed
  const tool = new THREE.Group(); rig.armR.hand.add(tool); tool.visible = false; rig.tool = tool;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.75, 6), mat(0x8a5a3c)); handle.position.y = -0.25; handle.rotation.x = Math.PI / 2; handle.position.z = 0.25; tool.add(handle);
  const headA = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.16), mat(0x9aa0a6, 0.3)); headA.position.set(0, -0.25, 0.6); tool.add(headA); rig.axe = headA;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 2.2, 5), mat(0x6b4a2f)); rod.rotation.x = Math.PI / 2 - 0.5; rod.position.set(0, 0.2, 0.9); rod.visible = false; tool.add(rod); rig.rod = rod;
  return rig;
}

// procedural animation: idle breathing, walk/run cycle, jump, sit, chop, fish, wave, photo
export function animate(rig, st, dt) {
  const sp = st.speed || 0, run = clamp((sp - 4.2) / 3, 0, 1), moving = clamp(sp / 1.5, 0, 1);
  rig.phase += dt * (sp > 0.1 ? 2.2 + sp * 1.35 : 0);
  const p = rig.phase, sw = Math.sin(p), sw2 = Math.cos(p);
  const k = 1 - Math.exp(-14 * dt);
  const set = (o, x, y = 0, z = 0) => { o.rotation.x += (x - o.rotation.x) * k; o.rotation.y += (y - o.rotation.y) * k; o.rotation.z += (z - o.rotation.z) * k; };
  rig.idleT += dt;
  const breathe = Math.sin(rig.idleT * 2.1) * 0.02;
  const amp = lerp(0.55, 0.95, run) * moving;
  let hipY = 0.92 + Math.abs(sw2) * 0.07 * moving * (1 + run) - 0.03 * moving + breathe * (1 - moving);
  set(rig.torso, 0.08 * moving + 0.16 * run + (st.lean || 0) * 0, 0, -(st.turn || 0) * 0.25 * moving);
  set(rig.legL.hp, sw * amp, 0, 0); set(rig.legR.hp, -sw * amp, 0, 0);
  set(rig.legL.kn, Math.max(0, -sw2) * amp * 1.4 + 0.05, 0, 0); set(rig.legR.kn, Math.max(0, sw2) * amp * 1.4 + 0.05, 0, 0);
  set(rig.armL.sh, -sw * amp * 0.9, 0, 0.08 + breathe); set(rig.armR.sh, sw * amp * 0.9, 0, -0.08 - breathe);
  set(rig.armL.el, -0.25 - run * 0.9, 0, 0); set(rig.armR.el, -0.25 - run * 0.9, 0, 0);
  // idle look-around
  if (moving < 0.1 && !st.action) { const t = rig.idleT * 0.4; rig.look = Math.sin(t) * Math.sin(t * 0.37) * 0.6; } else rig.look *= 0.9;
  set(rig.neck, -0.05 * moving, rig.look, 0);
  if (!st.grounded) { set(rig.legL.hp, -0.6, 0, 0); set(rig.legR.hp, 0.3, 0, 0); set(rig.legL.kn, 0.9, 0, 0); set(rig.legR.kn, 0.4, 0, 0); set(rig.armL.sh, -2.4, 0, 0.3); set(rig.armR.sh, -2.4, 0, -0.3); }
  const a = st.action, at = st.actionT || 0;
  rig.tool.visible = a === 'chop' || a === 'mine' || a === 'fish'; rig.axe.visible = a === 'chop' || a === 'mine'; rig.rod.visible = a === 'fish';
  if (a === 'sit') { hipY = 0.5; set(rig.legL.hp, -1.5, 0, 0.1); set(rig.legR.hp, -1.5, 0, -0.1); set(rig.legL.kn, 1.5, 0, 0); set(rig.legR.kn, 1.5, 0, 0); set(rig.armL.sh, -0.3, 0, 0.1); set(rig.armR.sh, -0.3, 0, -0.1); set(rig.torso, -0.05, 0, 0); }
  else if (a === 'chop' || a === 'mine') { const c = (at * 2.4) % 1, swing = c < 0.6 ? -2.6 * (c / 0.6) : -2.6 + 3.4 * ((c - 0.6) / 0.4); set(rig.armR.sh, swing, 0, -0.2); set(rig.armL.sh, swing * 0.8, 0, 0.3); set(rig.armR.el, -0.2, 0, 0); set(rig.torso, 0.2 - swing * 0.06, 0, 0); }
  else if (a === 'fish') { set(rig.armR.sh, -1.0 + Math.sin(at * 2) * 0.05, 0, -0.1); set(rig.armL.sh, -0.9, 0, 0.25); set(rig.armR.el, -0.4, 0, 0); }
  else if (a === 'gather') { const c = Math.sin(at * 6) * 0.2; hipY = 0.7; set(rig.torso, 0.8, 0, 0); set(rig.armR.sh, -1.2 + c, 0, 0); set(rig.armL.sh, -1.0 - c, 0, 0); set(rig.legL.hp, -0.6, 0, 0); set(rig.legR.hp, -0.6, 0, 0); set(rig.legL.kn, 1.1, 0, 0); set(rig.legR.kn, 1.1, 0, 0); }
  else if (a === 'wave') { set(rig.armR.sh, -2.8, 0, -0.3 + Math.sin(at * 10) * 0.3); }
  else if (a === 'photo') { set(rig.armR.sh, -1.6, 0, 0.3); set(rig.armL.sh, -1.6, 0, -0.3); set(rig.armR.el, -1.3, 0, 0); set(rig.armL.el, -1.3, 0, 0); set(rig.neck, 0.1, 0, 0); }
  else if (a === 'eat') { set(rig.armR.sh, -1.2 + Math.sin(at * 4) * 0.3, 0, 0); set(rig.armR.el, -1.6, 0, 0); }
  else if (a === 'cheer') { const b = Math.abs(Math.sin(at * 6)); hipY += b * 0.15; set(rig.armR.sh, -2.9, 0, -0.4); set(rig.armL.sh, -2.9, 0, 0.4); }
  rig.hips.position.y += (hipY - rig.hips.position.y) * k;
  // landing squash
  if (st.squash) { rig.root.scale.y = rig.root.scale.x * (1 - st.squash * 0.15); st.squash = Math.max(0, st.squash - dt * 4); } else rig.root.scale.y = rig.root.scale.x;
}

// ---------- player controller ----------
export class Player {
  constructor(scene) {
    this.rig = makeCharacter({ hat: 'beanie', hatColor: 0xd2483c, shirt: 0x3f7d58, pants: 0x5a4636, backpack: 0x8a5a3c, scarf: 0xf2c14e });
    scene.add(this.rig.root);
    this.pos = new THREE.Vector3(0, height(0, 6), 6); this.vel = new THREE.Vector3(); this.vy = 0; this.yaw = Math.PI; this.grounded = true;
    this.st = { speed: 0, grounded: true, action: null, actionT: 0 };
    this.surface = 'grass'; this.stepPhase = 0; this.canEnter = () => true; this.onStep = null; this.onLand = null; this.frozen = false;
  }
  update(dt, input, camYaw) {
    const st = this.st;
    let mx = 0, mz = 0;
    if (!this.frozen && !st.action) { if (input.f) mz += 1; if (input.b) mz -= 1; if (input.l) mx -= 1; if (input.r) mx += 1; }
    if ((mx || mz) && st.action === 'sit') st.action = null;
    const len = Math.hypot(mx, mz);
    const g0 = ground(this.pos.x, this.pos.z);
    const inWater = g0.water && g0.depth > 0.15;
    const maxS = (input.sprint ? 7.6 : 4.3) * (inWater ? 0.55 : 1);
    let tx = 0, tz = 0;
    if (len) { mx /= len; mz /= len; const s = Math.sin(camYaw), c = Math.cos(camYaw); tx = (mx * c - mz * s) * maxS; tz = (-mx * s - mz * c) * maxS; }
    const acc = len ? (this.grounded ? 11 : 4) : (this.grounded ? 13 : 2);
    this.vel.x = damp(this.vel.x, tx, acc, dt); this.vel.z = damp(this.vel.z, tz, acc, dt);
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp > 0.3 && len) { const want = Math.atan2(this.vel.x, this.vel.z), d = angDiff(this.yaw, want); this.yaw += d * (1 - Math.exp(-10 * dt)); st.turn = clamp(d, -1, 1); } else st.turn = 0;
    // horizontal move with blocking (world edge, cliffs, deep water, locked regions)
    let nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    const blocked = (x, z) => {
      if (Math.hypot(x, z) > 152) return true;
      const g = ground(x, z);
      if (g.water && g.depth > 0.95) return true;
      if (g.y - this.pos.y > 0.6 && slopeAt(x, z) > 1.25) return true;
      return !this.canEnter(x, z);
    };
    if (blocked(nx, nz)) { if (!blocked(nx, this.pos.z)) nz = this.pos.z; else if (!blocked(this.pos.x, nz)) nx = this.pos.x; else { nx = this.pos.x; nz = this.pos.z; } }
    // collider push-out
    const near = colliders.query(nx, nz, 4);
    for (let it = 0; it < 2; it++) for (const c of near) {
      if (c.obb) {
        const o = c.obb, dx = nx - o.x, dz = nz - o.z, cs = Math.cos(-o.rot), sn = Math.sin(-o.rot);
        let lx = dx * cs - dz * sn, lz = dx * sn + dz * cs; const R = 0.35;
        if (Math.abs(lx) < o.hw + R && Math.abs(lz) < o.hd + R) {
          const px = o.hw + R - Math.abs(lx), pz = o.hd + R - Math.abs(lz);
          if (px < pz) lx = Math.sign(lx) * (o.hw + R); else lz = Math.sign(lz) * (o.hd + R);
          const c2 = Math.cos(o.rot), s2 = Math.sin(o.rot); nx = o.x + lx * c2 - lz * s2; nz = o.z + lx * s2 + lz * c2;
        }
      } else {
        const dx = nx - c.x, dz = nz - c.z, d = Math.hypot(dx, dz), m = c.r + 0.33;
        if (d < m && d > 1e-4) { nx = c.x + dx / d * m; nz = c.z + dz / d * m; }
      }
    }
    this.pos.x = nx; this.pos.z = nz;
    // vertical
    const g = ground(nx, nz);
    const gy = g.water ? Math.max(g.y, WL - 0.75) : g.y;
    if (input.jump && this.grounded && !this.frozen && st.action !== 'fish') { this.vy = 8.2; this.grounded = false; input.jump = false; if (st.action === 'sit') st.action = null; }
    this.vy -= 24 * dt; this.pos.y += this.vy * dt;
    if (this.pos.y <= gy) {
      if (!this.grounded && this.vy < -6) { st.squash = 1; this.onLand && this.onLand(g); }
      this.pos.y = gy; this.vy = 0; this.grounded = true;
    } else if (this.grounded && this.pos.y - gy < 0.45 && this.vy <= 0) { this.pos.y = gy; this.vy = 0; } // stick to slopes
    else this.grounded = false;
    this.surface = g.kind || (g.water ? 'water' : 'grass');
    st.speed = this.grounded ? sp : sp * 0.5; st.grounded = this.grounded;
    if (st.action && st.action !== 'sit') st.actionT += dt; else if (st.action === 'sit') st.actionT += dt;
    // footstep events
    if (this.grounded && sp > 0.8) { const prev = Math.floor(this.rig.phase / Math.PI); animate(this.rig, st, dt); if (Math.floor(this.rig.phase / Math.PI) !== prev) this.onStep && this.onStep(this.surface, sp); }
    else animate(this.rig, st, dt);
    this.rig.root.position.copy(this.pos); this.rig.root.rotation.y = this.yaw;
  }
}

// ---------- camera ----------
export class CameraRig {
  constructor(cam) { this.cam = cam; this.yaw = Math.PI; this.pitch = 0.32; this.dist = 7; this.cur = 7; this.target = new THREE.Vector3(); this.blockers = () => []; this.ray = new THREE.Ray(); this.tmp = new THREE.Vector3(); this.maxDist = 16; }
  update(dt, focus, build) {
    const tgt = this.tmp.set(focus.x, focus.y + 1.55, focus.z);
    this.target.lerp(tgt, 1 - Math.exp(-12 * dt));
    const maxD = build ? 42 : this.maxDist;
    this.dist = clamp(this.dist, 2.6, maxD);
    const cp = Math.cos(this.pitch), dir = new THREE.Vector3(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    // camera collision: buildings (boxes) + terrain march
    let allowed = this.dist;
    this.ray.origin.copy(this.target); this.ray.direction.copy(dir);
    const hit = new THREE.Vector3();
    for (const b of this.blockers(this.target)) { if (b.containsPoint(this.target)) continue; if (this.ray.intersectBox(b, hit)) { const d = hit.distanceTo(this.target) - 0.35; if (d < allowed) allowed = Math.max(0.8, d); } }
    for (let i = 1; i <= 24; i++) { const d = allowed * i / 24, x = this.target.x + dir.x * d, y = this.target.y + dir.y * d, z = this.target.z + dir.z * d; if (height(x, z) + 0.45 > y) { allowed = Math.max(0.8, d - allowed / 24); break; } }
    // pull in fast, ease back out slowly
    this.cur = allowed < this.cur ? damp(this.cur, allowed, 25, dt) : damp(this.cur, allowed, 3, dt);
    this.cam.position.copy(this.target).addScaledVector(dir, this.cur);
    const hmin = Math.max(height(this.cam.position.x, this.cam.position.z), WL) + 0.35;
    if (this.cam.position.y < hmin) this.cam.position.y = hmin;
    this.cam.lookAt(this.target);
  }
}
