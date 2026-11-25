// EVERGREEN — lightweight particle effects: rain, snow, leaves, motes, fireflies, smoke & steam
import * as THREE from 'three';
import { TEX } from './materials.js';
import { height } from './terrain.js';

const BOX = 36;
function cloud(n, size, color, blending = THREE.NormalBlending, opacity = 1) {
  const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - 0.5) * BOX * 2; p[i * 3 + 1] = Math.random() * 24; p[i * 3 + 2] = (Math.random() - 0.5) * BOX * 2; }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.PointsMaterial({ size, color, map: TEX.glow, transparent: true, opacity, depthWrite: false, blending, sizeAttenuation: true });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; return pts;
}
export class Effects {
  constructor(scene) {
    this.scene = scene;
    // rain as short streaks
    const RN = 2600, rg = new THREE.BufferGeometry(), rp = new Float32Array(RN * 6);
    for (let i = 0; i < RN; i++) { const x = (Math.random() - 0.5) * BOX * 2, y = Math.random() * 24, z = (Math.random() - 0.5) * BOX * 2; rp.set([x, y, z, x + 0.05, y - 0.7, z], i * 6); }
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xb8cde0, transparent: true, opacity: 0, depthWrite: false })); this.rain.frustumCulled = false; scene.add(this.rain);
    this.snow = cloud(2200, 0.22, 0xffffff, THREE.NormalBlending, 0); scene.add(this.snow);
    this.motes = cloud(260, 0.16, 0xfff3c0, THREE.AdditiveBlending, 0); scene.add(this.motes);
    this.flies = cloud(140, 0.34, 0xd8ff7a, THREE.AdditiveBlending, 0); scene.add(this.flies);
    // falling leaves (autumn) — instanced little quads
    const lg = new THREE.PlaneGeometry(0.22, 0.16); this.leafN = 220;
    this.leaves = new THREE.InstancedMesh(lg, new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.8 }), this.leafN);
    this.leafData = []; const cols = [0xe8902a, 0xd2483c, 0xf2c14e, 0xb8652f];
    for (let i = 0; i < this.leafN; i++) { this.leafData.push({ x: (Math.random() - 0.5) * 60, y: Math.random() * 14, z: (Math.random() - 0.5) * 60, r: Math.random() * 6, s: 0.6 + Math.random() * 0.8 }); this.leaves.setColorAt(i, new THREE.Color(cols[i % 4])); }
    this.leaves.frustumCulled = false; this.leaves.visible = false; scene.add(this.leaves);
    // smoke / steam puffs (pooled sprites)
    this.puffMat = new THREE.SpriteMaterial({ map: TEX.glow, color: 0xdddddd, transparent: true, depthWrite: false, opacity: 0.5 });
    this.puffs = []; for (let i = 0; i < 90; i++) { const s = new THREE.Sprite(this.puffMat.clone()); s.visible = false; scene.add(s); this.puffs.push({ s, life: 0 }); }
    this.emitters = []; this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._v = new THREE.Vector3(); this._sc = new THREE.Vector3();
    // build dust burst
    this.dust = [];
  }
  puff(x, y, z, steam) { const p = this.puffs.find(p => p.life <= 0); if (!p) return; p.life = 1; p.max = steam ? 2.2 : 3.2; p.t = 0; p.s.visible = true; p.s.position.set(x, y, z); p.vx = (Math.random() - 0.5) * 0.3 + 0.25; p.vz = (Math.random() - 0.5) * 0.3; p.steam = steam; p.s.material.color.set(steam ? 0xffffff : 0xcfc8c0); }
  burst(x, y, z, n = 14) { for (let i = 0; i < n; i++) { const p = this.puffs.find(p => p.life <= 0); if (!p) return; p.life = 1; p.max = 1.2; p.t = 0; p.s.visible = true; p.s.position.set(x + (Math.random() - 0.5) * 3, y + Math.random(), z + (Math.random() - 0.5) * 3); p.vx = (Math.random() - 0.5) * 2; p.vz = (Math.random() - 0.5) * 2; p.steam = false; p.s.material.color.set(0xd8c8a8); } }
  update(dt, s) {
    const c = s.center, t = s.time;
    // rain
    const rp = this.rain.geometry.attributes.position, ra = rp.array;
    this.rain.material.opacity = s.rain * 0.55; this.rain.visible = s.rain > 0.02;
    if (this.rain.visible) { for (let i = 0; i < ra.length; i += 6) { ra[i + 1] -= 26 * dt; ra[i + 4] -= 26 * dt; if (ra[i + 1] < 0) { const x = c.x + (Math.random() - 0.5) * BOX * 2, z = c.z + (Math.random() - 0.5) * BOX * 2, y = c.y + 14 + Math.random() * 10; ra[i] = x; ra[i + 1] = y; ra[i + 2] = z; ra[i + 3] = x + 0.08; ra[i + 4] = y - 0.7; ra[i + 5] = z; } else if (Math.abs(ra[i] - c.x) > BOX || Math.abs(ra[i + 2] - c.z) > BOX) { ra[i] = c.x + (Math.random() - 0.5) * BOX * 2; ra[i + 3] = ra[i] + 0.08; ra[i + 2] = ra[i + 5] = c.z + (Math.random() - 0.5) * BOX * 2; } } rp.needsUpdate = true; }
    // snow
    this.snow.material.opacity = s.snow * 0.95; this.snow.visible = s.snow > 0.02;
    if (this.snow.visible) { const a = this.snow.geometry.attributes.position.array; for (let i = 0; i < a.length; i += 3) { a[i + 1] -= (1.2 + (i % 7) * 0.12) * dt; a[i] += Math.sin(t + i) * 0.4 * dt; if (a[i + 1] < c.y - 4 || Math.abs(a[i] - c.x) > BOX || Math.abs(a[i + 2] - c.z) > BOX) { a[i] = c.x + (Math.random() - 0.5) * BOX * 2; a[i + 1] = c.y + 12 + Math.random() * 10; a[i + 2] = c.z + (Math.random() - 0.5) * BOX * 2; } } this.snow.geometry.attributes.position.needsUpdate = true; }
    // floating motes by day / fireflies at night
    this.motes.material.opacity = s.day * 0.7 * (1 - s.rain); this.flies.material.opacity = s.night * (1 - s.rain) * (s.season === 3 ? 0 : 1);
    for (const [pts, amp, yr] of [[this.motes, 0.3, 6], [this.flies, 0.6, 3]]) {
      if (pts.material.opacity < 0.02) { pts.visible = false; continue; } pts.visible = true;
      const a = pts.geometry.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) { a[i] += Math.sin(t * 0.7 + i) * amp * dt; a[i + 1] += Math.cos(t * 0.9 + i * 1.3) * amp * 0.6 * dt; a[i + 2] += Math.cos(t * 0.6 + i * 0.7) * amp * dt; if (Math.abs(a[i] - c.x) > 22 || Math.abs(a[i + 2] - c.z) > 22 || a[i + 1] < c.y - 3 || a[i + 1] > c.y + yr) { a[i] = c.x + (Math.random() - 0.5) * 44; a[i + 2] = c.z + (Math.random() - 0.5) * 44; a[i + 1] = height(a[i], a[i + 2]) + 0.4 + Math.random() * yr * 0.6; } }
      pts.geometry.attributes.position.needsUpdate = true;
      if (pts === this.flies) pts.material.size = 0.3 + Math.sin(t * 3) * 0.06;
    }
    // autumn leaves
    this.leaves.visible = s.autumn > 0.3;
    if (this.leaves.visible) { for (let i = 0; i < this.leafN; i++) { const L = this.leafData[i]; L.y -= dt * (0.6 + L.s * 0.4); L.x += Math.sin(t * 1.3 + i) * dt * 0.8 + s.windX * dt; L.r += dt * 2 * L.s; if (L.y < -1 || Math.abs(L.x) > 30 || Math.abs(L.z) > 30) { L.x = (Math.random() - 0.5) * 60; L.z = (Math.random() - 0.5) * 60; L.y = 6 + Math.random() * 8; } const wx = c.x + L.x, wz = c.z + L.z, gy = height(wx, wz); this._e.set(L.r, L.r * 0.7, L.r * 0.3); this._q.setFromEuler(this._e); this._v.set(wx, Math.max(gy + 0.05, gy + L.y), wz); this._sc.setScalar(L.s); this._m.compose(this._v, this._q, this._sc); this.leaves.setMatrixAt(i, this._m); } this.leaves.instanceMatrix.needsUpdate = true; }
    // emitters: chimneys, hot springs
    for (const e of this.emitters) { e.t -= dt; if (e.t <= 0 && e.pos.distanceToSquared(c) < 4900) { this.puff(e.pos.x, e.pos.y, e.pos.z, e.steam); e.t = e.steam ? 0.25 : 0.7 + Math.random() * 0.6; } }
    for (const p of this.puffs) { if (p.life <= 0) continue; p.t += dt; const k = p.t / p.max; if (k >= 1) { p.life = 0; p.s.visible = false; continue; } p.s.position.x += (p.vx + s.windX * 0.3) * dt; p.s.position.y += (p.steam ? 0.7 : 0.9) * dt; p.s.position.z += p.vz * dt; const sc = (p.steam ? 0.6 : 0.5) + k * (p.steam ? 1.6 : 2.2); p.s.scale.set(sc, sc, 1); p.s.material.opacity = (1 - k) * (p.steam ? 0.35 : 0.45) * (1 - s.night * 0.5); }
  }
}
