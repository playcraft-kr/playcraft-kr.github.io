// EVERGREEN — world construction: terrain, water, vegetation, sky, landmarks
import * as THREE from 'three';
import { rng, fbm, smooth, clamp, lerp, hash2 } from './util.js';
import { HALF, WL, height, regionAt, pathDist, PATHS, riverX, RIVER_Z0, nearLake, isRiverZone, slopeAt, lakeD, addSurface, TRAILHEAD } from './terrain.js';
import { M, U, patch, TEX } from './materials.js';
import * as G from './geo.js';

// ---------- spatial grid for colliders & interactables ----------
export class Grid {
  constructor(cell = 8) { this.c = cell; this.m = new Map(); }
  key(x, z) { return (Math.floor(x / this.c) + 500) * 1000 + (Math.floor(z / this.c) + 500); }
  add(o) { const k = this.key(o.x, o.z); let a = this.m.get(k); if (!a) this.m.set(k, a = []); a.push(o); o._k = k; return o; }
  remove(o) { const a = this.m.get(o._k); if (a) { const i = a.indexOf(o); if (i >= 0) a.splice(i, 1); } }
  query(x, z, r, out = []) {
    const c = this.c, x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c), z0 = Math.floor((z - r) / c), z1 = Math.floor((z + r) / c);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const a = this.m.get((i + 500) * 1000 + (j + 500)); if (a) for (const o of a) out.push(o); }
    return out;
  }
}
export const colliders = new Grid(8);   // {x,z,r} circles or {obb}
export const things = new Grid(8);      // interactables: trees, rocks, flowers, discoveries

const GRASS_RES = 256;
export const world = { trees: [], rocks: [], clumps: [], props: [], gates: [], discoveries: [], mapImage: null, grassMask: null };

// ---------- colours ----------
const C = (h) => new THREE.Color(h);
const PAL = {
  forest: [C(0x5c9a3e), C(0x7fb24f)], meadow: [C(0x8cbf4c), C(0xb5cc5c)], high: [C(0x7c9a58), C(0x9aa66c)], old: [C(0x4a7a38), C(0x3b6a33)],
  rock: C(0x7d7a74), pineSlope: C(0x2f5a3c), sand: C(0xdcc68f), bed: C(0x7d6c4e), path: C(0xa9825a), path2: C(0x8d6a45), snow: C(0xf1f4f8), soil: C(0x6b4a2f),
};
function groundColor(x, z, h, out) {
  const reg = regionAt(x, z), n = fbm(x * 0.05 + 3, z * 0.05, 3) * 0.5 + 0.5, n2 = fbm(x * 0.3, z * 0.3, 2) * 0.5 + 0.5;
  const pal = reg === 3 ? PAL.meadow : reg === 2 ? PAL.high : reg === 4 ? PAL.old : PAL.forest;
  // blend toward neighbouring palettes near region seams for soft transitions
  out.copy(pal[0]).lerp(pal[1], n);
  const r = Math.hypot(x, z);
  if (r > 48 && r < 70) { const f = PAL.forest; const t = smooth(70, 50, r) * 0.6; out.lerp(f[0].clone().lerp(f[1], n), t); }
  out.multiplyScalar(0.92 + n2 * 0.16);
  const sl = slopeAt(x, z);
  if (r > 138) out.lerp(PAL.pineSlope, smooth(138, 156, r) * 0.85);
  if (sl > 0.55 || h > 26) out.lerp(PAL.rock, clamp((sl - 0.55) * 2.5 + (h - 26) * 0.08, 0, 0.9));
  if (h > 48) out.lerp(PAL.snow, clamp((h - 48) * 0.12, 0, 0.9));
  const watery = nearLake(x, z) || isRiverZone(x, z);
  if (watery && h < 0.9) out.lerp(PAL.sand, smooth(0.9, 0.25, h));
  if (h < -0.2) out.lerp(PAL.bed, smooth(-0.2, -1.4, h));
  const pd = pathDist(x, z);
  if (pd < 2.6) { const t = smooth(2.6, 1.3, pd); out.lerp(n2 > 0.5 ? PAL.path : PAL.path2, t); }
  return out;
}

// ---------- terrain ----------
function buildTerrain(scene) {
  const S = 300, size = HALF * 2;
  const g = new THREE.PlaneGeometry(size, size, S, S); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), h = height(x, z); p.setY(i, h); }
  g.computeVertexNormals();
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); groundColor(x, z, p.getY(i), c); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // detail grain
  const dc = document.createElement('canvas'); dc.width = dc.height = 128; const dg = dc.getContext('2d'), im = dg.createImageData(128, 128), r = rng(7);
  for (let i = 0; i < im.data.length; i += 4) { const v = 215 + r() * 40; im.data[i] = v; im.data[i + 1] = v; im.data[i + 2] = v; im.data[i + 3] = 255; }
  dg.putImageData(im, 0, 0); const dt = new THREE.CanvasTexture(dc); dt.wrapS = dt.wrapT = THREE.RepeatWrapping; dt.repeat.set(140, 140); dt.colorSpace = THREE.SRGBColorSpace;
  const mat = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, map: dt }), { snow: 1 });
  const mesh = new THREE.Mesh(g, mat); mesh.receiveShadow = true; mesh.name = 'terrain';
  scene.add(mesh);
  world.terrain = mesh; world.terrainColors = col;
  return mesh;
}
// darken terrain vertex colours near tree bases — baked ambient occlusion
function bakeAO() {
  const p = world.terrain.geometry.attributes.position, col = world.terrainColors, S = 301, step = HALF * 2 / 300;
  const darken = (x, z, rad, k) => {
    const i0 = Math.floor((x + HALF) / step), j0 = Math.floor((z + HALF) / step), rr = Math.ceil(rad / step);
    for (let i = i0 - rr; i <= i0 + rr; i++) for (let j = j0 - rr; j <= j0 + rr; j++) {
      if (i < 0 || j < 0 || i >= S || j >= S) continue; const idx = j * S + i;
      const d = Math.hypot(p.getX(idx) - x, p.getZ(idx) - z); if (d > rad) continue;
      const f = 1 - k * (1 - d / rad); col[idx * 3] *= f; col[idx * 3 + 1] *= f; col[idx * 3 + 2] *= f;
    }
  };
  for (const t of world.trees) darken(t.x, t.z, 2.2 * t.s, 0.28);
  for (const r of world.rocks) darken(r.x, r.z, 1.6 * r.s, 0.3);
  world.terrain.geometry.attributes.color.needsUpdate = true;
  world.darken = (x, z, rad, k) => { darken(x, z, rad, k); world.terrain.geometry.attributes.color.needsUpdate = true; };
}

// ---------- grass mask + height texture (used by the GPU grass field) ----------
function buildGrassData() {
  const N = GRASS_RES, hd = new Uint16Array(N * N), md = new Uint8Array(N * N * 4), c = new THREE.Color();
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -HALF + (i + 0.5) / N * HALF * 2, z = -HALF + (j + 0.5) / N * HALF * 2, h = height(x, z), k = j * N + i;
    hd[k] = THREE.DataUtils.toHalfFloat(h);
    groundColor(x, z, h, c);
    const reg = regionAt(x, z), pd = pathDist(x, z), sl = slopeAt(x, z);
    let a = smooth(1.6, 3.2, pd) * smooth(0.5, 1.1, h) * smooth(0.9, 0.5, sl) * smooth(30, 22, h);
    a *= reg === 3 ? 1 : reg === 2 ? 0.75 : reg === 4 ? 0.8 : 0.9;
    a *= 0.6 + 0.4 * (fbm(x * 0.07, z * 0.07, 2) * 0.5 + 0.5);
    md[k * 4] = c.r * 255; md[k * 4 + 1] = c.g * 255; md[k * 4 + 2] = c.b * 255; md[k * 4 + 3] = a * 255;
  }
  const ht = new THREE.DataTexture(hd, N, N, THREE.RedFormat, THREE.HalfFloatType); ht.magFilter = ht.minFilter = THREE.LinearFilter; ht.needsUpdate = true;
  const mt = new THREE.DataTexture(md, N, N, THREE.RGBAFormat); mt.magFilter = mt.minFilter = THREE.LinearFilter; mt.needsUpdate = true;
  world.grassMask = { tex: mt, data: md, N };
  world.heightTex = ht;
  // minimap image
  const mc = document.createElement('canvas'); mc.width = mc.height = N; const mg = mc.getContext('2d'), im = mg.createImageData(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i, x = -HALF + (i + 0.5) / N * HALF * 2, z = -HALF + (j + 0.5) / N * HALF * 2, h = height(x, z);
    let r = md[k * 4], g = md[k * 4 + 1], b = md[k * 4 + 2];
    if (h < WL) { const d = clamp(-h / 4, 0, 1); r = lerp(120, 50, d); g = lerp(190, 120, d); b = lerp(210, 175, d); }
    const sh = clamp(1 + (height(x - 1, z - 1) - h) * -0.25, 0.7, 1.25);
    im.data[k * 4] = r * sh; im.data[k * 4 + 1] = g * sh; im.data[k * 4 + 2] = b * sh; im.data[k * 4 + 3] = 255;
  }
  mg.putImageData(im, 0, 0); world.mapImage = mc;
}
export function clearGrass(x, z, rad) {
  const { data, N, tex } = world.grassMask, s = HALF * 2 / N;
  const i0 = Math.floor((x - rad + HALF) / s), i1 = Math.ceil((x + rad + HALF) / s), j0 = Math.floor((z - rad + HALF) / s), j1 = Math.ceil((z + rad + HALF) / s);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    if (i < 0 || j < 0 || i >= N || j >= N) continue;
    const wx = -HALF + (i + 0.5) * s, wz = -HALF + (j + 0.5) * s;
    if (Math.hypot(wx - x, wz - z) < rad) data[(j * N + i) * 4 + 3] = 0;
  }
  tex.needsUpdate = true;
}

function buildGrass(scene, quality) {
  const AREA = 70, count = quality === 'low' ? 14000 : quality === 'high' ? 52000 : 32000;
  const blade = G.grassBladeGeo();
  const geo = new THREE.InstancedBufferGeometry(); geo.index = blade.index; geo.attributes.position = blade.attributes.position; geo.attributes.uv = blade.attributes.uv;
  const off = new Float32Array(count * 4), r = rng(99);
  for (let i = 0; i < count; i++) { off[i * 4] = r() * AREA; off[i * 4 + 1] = r() * AREA; off[i * 4 + 2] = r() * Math.PI * 2; off[i * 4 + 3] = r(); }
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4)); geo.instanceCount = count;
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uCenter: { value: new THREE.Vector2() }, uPlayer: { value: new THREE.Vector3() }, uHeight: { value: world.heightTex }, uMask: { value: world.grassMask.tex }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) }, uAmb: { value: new THREE.Color(0.5, 0.5, 0.5) }, uFogCol: { value: new THREE.Color() }, uFogDen: { value: 0.01 }, uArea: { value: AREA } }, U),
    vertexShader: `
      attribute vec4 aOff; uniform vec2 uCenter; uniform vec3 uPlayer; uniform sampler2D uHeight, uMask; uniform float uTime, uWind, uSnow, uArea;
      varying vec3 vCol; varying float vT; varying vec3 vW; varying float vSn;
      void main(){
        vec2 o = aOff.xy; vec2 wp = o + uArea * floor((uCenter - o) / uArea + 0.5);
        vec2 uv = (wp + ${HALF.toFixed(1)}) / ${(HALF * 2).toFixed(1)};
        vec4 m = texture2D(uMask, uv); float h = texture2D(uHeight, uv).r;
        float dist = length(wp - uCenter);
        float keep = step(aOff.w, m.a) * smoothstep(uArea*0.5, uArea*0.36, dist);
        float sc = (0.35 + aOff.w * 0.4) * keep * (1.0 - uSnow * 0.7);
        vec3 p = position; float t = p.y; p.y *= sc * 0.95; p.xz *= 1.0 + sc * 0.4;
        float ca = cos(aOff.z), sa = sin(aOff.z); p.xz = mat2(ca,-sa,sa,ca) * p.xz;
        float w = sin(uTime*1.8 + wp.x*0.35 + wp.y*0.25) * 0.5 + sin(uTime*3.3 + wp.x*0.9) * 0.2;
        p.x += w * t * t * 0.28 * uWind; p.z += cos(uTime*1.4 + wp.y*0.3) * t * t * 0.12 * uWind;
        vec2 away = wp - uPlayer.xz; float pd = length(away);
        if (pd < 1.4) { p.xz += normalize(away + 0.001) * (1.4 - pd) * t * 0.6; p.y *= 0.7 + pd * 0.2; }
        vec3 world = vec3(wp.x, h, wp.y) + p;
        vT = t; vW = world; vSn = uSnow;
        vCol = m.rgb * (1.15 + aOff.w * 0.25);
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uSunDir, uSunCol, uAmb, uFogCol; uniform float uFogDen, uAutumn, uWet;
      varying vec3 vCol; varying float vT; varying vec3 vW; varying float vSn;
      void main(){
        vec3 base = vCol * mix(0.5, 1.15, vT);
        base = mix(base, base * vec3(1.25, 1.0, 0.55), uAutumn * 0.55);
        base = mix(base, vec3(0.9,0.93,0.97), vSn * smoothstep(0.2, 1.0, vT));
        base *= 1.0 - uWet * 0.15;
        float ndl = clamp(uSunDir.y * 0.7 + 0.3, 0.0, 1.0);
        vec3 c = base * (uAmb + uSunCol * ndl * 0.75);
        c += uSunCol * pow(vT, 4.0) * 0.08;
        float d = length(vW - cameraPosition); float f = 1.0 - exp(-uFogDen*uFogDen*d*d);
        gl_FragColor = vec4(mix(c, uFogCol, f), 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; scene.add(mesh); world.grass = mesh;
  return mesh;
}

// ---------- water ----------
function buildWater(scene) {
  const S = 220, size = HALF * 2, step = size / S, pos = [], dep = [], idx = [];
  const map = new Int32Array((S + 1) * (S + 1)).fill(-1); let n = 0;
  const hs = new Float32Array((S + 1) * (S + 1));
  for (let j = 0; j <= S; j++) for (let i = 0; i <= S; i++) hs[j * (S + 1) + i] = height(-HALF + i * step, -HALF + j * step);
  const vid = (i, j) => { const k = j * (S + 1) + i; if (map[k] < 0) { map[k] = n++; pos.push(-HALF + i * step, WL, -HALF + j * step); dep.push(WL - hs[k]); } return map[k]; };
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const a = hs[j * (S + 1) + i], b = hs[j * (S + 1) + i + 1], c = hs[(j + 1) * (S + 1) + i], d = hs[(j + 1) * (S + 1) + i + 1];
    if (Math.min(a, b, c, d) > WL + 0.35) continue;
    const A = vid(i, j), B = vid(i + 1, j), Cc = vid(i, j + 1), D = vid(i + 1, j + 1);
    idx.push(A, Cc, B, B, Cc, D);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1)); g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uSunDir: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() }, uSky: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uFogCol: { value: new THREE.Color() }, uFogDen: { value: 0.01 }, uRain: { value: 0 }, uNight: { value: 0 } }, U),
    vertexShader: `attribute float aDepth; varying float vD; varying vec3 vW; uniform float uTime;
      void main(){ vD = aDepth; vec3 p = position; p.y += sin(uTime*1.2 + p.x*0.4 + p.z*0.3)*0.03; vW = (modelMatrix*vec4(p,1.0)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vW,1.0); }`,
    fragmentShader: `uniform float uTime, uFogDen, uRain, uNight, uSnow; uniform vec3 uSunDir, uSunCol, uSky, uHorizon, uFogCol; varying float vD; varying vec3 vW;
      float wav(vec2 p, vec2 d, float f, float s){ return sin(dot(p,d)*f + uTime*s); }
      void main(){
        if (vD < -0.02) discard;
        vec2 p = vW.xz;
        float e = 0.0;
        vec2 g = vec2(0.0);
        g += vec2(0.8,0.6) * cos(dot(p,vec2(0.8,0.6))*0.9 + uTime*1.1) * 0.10;
        g += vec2(-0.5,0.85) * cos(dot(p,vec2(-0.5,0.85))*1.7 + uTime*1.6) * 0.07;
        g += vec2(0.3,-0.95) * cos(dot(p,vec2(0.3,-0.95))*3.1 + uTime*2.3) * 0.04;
        g += vec2(0.95,0.2) * cos(dot(p,vec2(0.95,0.2))*6.3 + uTime*3.2) * (0.025 + uRain*0.05);
        float rr = sin(length(fract(p*0.35)-0.5)*40.0 - uTime*9.0) * uRain * 0.05; g += vec2(rr);
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
        vec3 shallow = vec3(0.32,0.72,0.70), deep = vec3(0.07,0.30,0.45);
        vec3 col = mix(shallow, deep, smoothstep(0.0, 3.2, vD));
        col *= mix(1.0, 0.35, uNight);
        vec3 refl = mix(uHorizon, uSky, clamp(reflect(-V, n).y*2.0, 0.0, 1.0));
        col = mix(col, refl, 0.15 + fres * 0.6);
        vec3 H = normalize(uSunDir + V);
        col += uSunCol * pow(max(dot(n, H), 0.0), 220.0) * 2.5 * step(0.0, uSunDir.y);
        float foam = smoothstep(0.32, 0.0, vD) * (0.55 + 0.45*sin(uTime*2.0 + p.x*2.1 + p.y*1.7));
        col = mix(col, vec3(0.95,0.98,1.0)*mix(1.0,0.4,uNight), foam*0.75);
        float a = mix(0.6, 0.93, smoothstep(0.0, 1.6, vD)) + fres*0.08;
        float d = length(vW - cameraPosition); float f = 1.0 - exp(-uFogDen*uFogDen*d*d);
        gl_FragColor = vec4(mix(col, uFogCol, f), a);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false,
  });
  const mesh = new THREE.Mesh(g, mat); mesh.renderOrder = 2; scene.add(mesh); world.water = mesh;
  // waterfall into the highland gorge
  const z = RIVER_Z0 + 1, x = riverX(z), top = height(x, RIVER_Z0 - 4);
  const wg = new THREE.PlaneGeometry(4.2, top + 1.2, 1, 12); wg.translate(0, (top + 1.2) / 2 - 0.6, 0);
  const wm = new THREE.ShaderMaterial({ uniforms: Object.assign({ uNight: { value: 0 } }, U), transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; vec3 p = position; p.z -= pow(1.0-uv.y, 2.0)*-0.0 + sin(uv.y*3.0)*0.3; gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0);} `,
    fragmentShader: `uniform float uTime, uNight; varying vec2 vUv; void main(){ float s = fract(vUv.y*3.0 + uTime*1.6 + sin(vUv.x*20.0)*0.08); float st = smoothstep(0.0,0.5,s)*smoothstep(1.0,0.6,s); vec3 c = mix(vec3(0.55,0.82,0.9), vec3(0.97,1.0,1.0), st*0.8); c *= mix(1.0,0.4,uNight); float a = 0.78*smoothstep(0.0,0.12,vUv.x)*smoothstep(1.0,0.88,vUv.x); gl_FragColor = vec4(c, a);\n#include <colorspace_fragment>\n}` });
  const wf = new THREE.Mesh(wg, wm); wf.position.set(x, 0, z + 0.4); scene.add(wf); world.waterfall = wf; world.waterfallPos = new THREE.Vector3(x, 1, z);
}

// ---------- vegetation ----------
function makeIM(geo, mat, n, shadow = true) { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = shadow; m.receiveShadow = true; m.count = 0; return m; }
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
function setInst(im, i, x, y, z, s, ry, sy = 1, tilt = 0) {
  _e.set(tilt, ry, tilt * 0.5); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(s, s * sy, s); _m.compose(_p, _q, _s); im.setMatrixAt(i, _m);
}
export function setTreeVisible(t, scale) {
  const s = t.s * scale;
  for (const [im, i] of t.inst) { setInst(im, i, t.x, t.y, t.z, s, t.ry, t.sy); im.instanceMatrix.needsUpdate = true; }
}

function canPlant(x, z, minPath = 3.4) {
  const h = height(x, z);
  if (h < 0.55 || h > 34) return false;
  if (slopeAt(x, z) > 0.9) return false;
  if (pathDist(x, z) < minPath) return false;
  if (Math.hypot(x, z) > 168) return false;
  for (const ex of world.exclusions) if (Math.hypot(x - ex.x, z - ex.z) < ex.r) return false;
  return true;
}

function buildVegetation(scene, quality) {
  const r = rng(2024);
  const trunkMat = patch(new THREE.MeshStandardMaterial({ map: TEX.bark, color: 0x7a5434, roughness: 0.95 }), { snow: 0.4 });
  const birchMat = patch(new THREE.MeshStandardMaterial({ map: TEX.birch, color: 0xffffff, roughness: 0.9 }), { snow: 0.3 });
  const oakLeaf = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), { wind: 0.012, autumn: true, snow: 0.85 });
  const pineLeaf = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), { wind: 0.006, snow: 1 });
  const bushMat = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), { wind: 0.03, autumn: true, snow: 1 });
  const rockMat = patch(new THREE.MeshStandardMaterial({ map: TEX.stone, color: 0xa7a299, roughness: 0.95, bumpMap: TEX.stone, bumpScale: 2 }), { snow: 1 });
  const ancientLeaf = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), { wind: 0.004, autumn: true, blossom: false, snow: 0.8 });
  world.mats = { trunkMat, oakLeaf, pineLeaf, bushMat, rockMat };

  const types = {
    oak: [0, 1, 2].map(i => G.oakGeo(100 + i * 17)),
    pine: [0, 1].map(i => G.pineGeo(300 + i * 13)),
    birch: [0, 1].map(i => G.birchGeo(500 + i * 7)),
  };
  const cap = { oak: 520, pine: 900, birch: 220 };
  const ims = {};
  for (const k of Object.keys(types)) ims[k] = types[k].map(v => ({ trunk: makeIM(v.trunk, k === 'birch' ? birchMat : trunkMat, cap[k]), leaves: makeIM(v.leaves, k === 'pine' ? pineLeaf : oakLeaf, cap[k]), top: v.top }));
  const leafCol = { oak: [0x6aa84f, 0x7db84f, 0x5b9a45, 0x8fbf50], pine: [0x3f7a4a, 0x356e43, 0x4b8a52, 0x2f6a46], birch: [0x9cc75a, 0xb3d06a, 0x8ec052] };

  const addTree = (kind, x, z, s, regrow = true) => {
    const vs = ims[kind], v = Math.floor(r() * vs.length), set = vs[v];
    if (set.trunk.count >= cap[kind]) return null;
    const i = set.trunk.count++; set.leaves.count++;
    const y = height(x, z) - 0.15, ry = r() * Math.PI * 2, sy = 0.85 + r() * 0.35;
    setInst(set.trunk, i, x, y, z, s, ry, sy); setInst(set.leaves, i, x, y, z, s, ry, sy);
    _c.set(leafCol[kind][Math.floor(r() * leafCol[kind].length)]).multiplyScalar(0.9 + r() * 0.2);
    set.leaves.setColorAt(i, _c); set.trunk.setColorAt(i, _c.setRGB(1, 1, 1).multiplyScalar(0.85 + r() * 0.3));
    const t = { type: 'tree', kind, x, y, z, s, ry, sy, inst: [[set.trunk, i], [set.leaves, i]], alive: true, regrow, top: set.top * s * sy };
    world.trees.push(t); things.add(t);
    t.col = colliders.add({ x, z, r: (kind === 'pine' ? 0.42 : 0.38) * s, tree: t });
    return t;
  };
  world.addTree = (x, z, kind = 'oak', s = 1) => addTree(kind, x, z, s, false);

  // grove-based distribution: density field + region flavour, avoids uniform scatter
  const tries = quality === 'low' ? 6000 : 9000;
  for (let k = 0; k < tries; k++) {
    const x = (r() * 2 - 1) * 168, z = (r() * 2 - 1) * 168;
    const reg = regionAt(x, z), rr = Math.hypot(x, z);
    const grove = fbm(x * 0.028 + 9, z * 0.028 - 4, 3);
    let dens = reg === 0 ? 0.25 + grove * 0.9 : reg === 1 ? 0.05 + grove * 0.6 : reg === 2 ? 0.25 + grove * 0.8 : reg === 3 ? -0.15 + grove * 0.6 : 0.5 + grove * 0.7;
    if (rr > 140) dens += 0.35;
    if (reg === 0 && rr < 30) dens -= 0.8;
    if (r() > dens) continue;
    if (!canPlant(x, z)) continue;
    // keep a minimum spacing
    let close = false; for (const o of things.query(x, z, 2.4)) if (o.type === 'tree' && Math.hypot(o.x - x, o.z - z) < 2.2 * o.s) { close = true; break; }
    if (close) continue;
    const h = height(x, z);
    let kind;
    if (reg === 2 || h > 14) kind = r() < 0.85 ? 'pine' : 'birch';
    else if (reg === 3) kind = r() < 0.5 ? 'birch' : 'oak';
    else if (reg === 4) kind = r() < 0.7 ? 'oak' : 'pine';
    else if (reg === 1) kind = r() < 0.5 ? 'birch' : r() < 0.5 ? 'pine' : 'oak';
    else kind = r() < 0.45 ? 'pine' : r() < 0.7 ? 'oak' : 'birch';
    const s = (reg === 4 ? 1.25 : 0.85) + r() * 0.55 + (rr > 140 ? 0.4 : 0);
    addTree(kind, x, z, s);
  }
  // a few deliberate trees framing the starting clearing
  for (const [x, z, k, s] of [[-16, -12, 'oak', 1.25], [14, -16, 'pine', 1.1], [-20, 10, 'birch', 1.0], [9, 18, 'oak', 1.05], [-24, -2, 'pine', 1.2], [26, -8, 'birch', 1.1], [-12, 24, 'pine', 1.0], [18, 22, 'oak', 1.3]])
    if (canPlant(x, z, 2.6)) addTree(k, x, z, s);
  for (const k of Object.keys(ims)) for (const set of ims[k]) { scene.add(set.trunk, set.leaves); set.trunk.instanceMatrix.needsUpdate = set.leaves.instanceMatrix.needsUpdate = true; if (set.leaves.instanceColor) set.leaves.instanceColor.needsUpdate = true; if (set.trunk.instanceColor) set.trunk.instanceColor.needsUpdate = true; }
  world.treeIMs = ims;

  // ancient trees — the Old Woodland's giants
  const anc = G.ancientTreeGeo(77);
  const ancT = makeIM(anc.trunk, trunkMat, 20), ancL = makeIM(anc.leaves, ancientLeaf, 20);
  const ancSpots = [[-142, -30, 1.6], [-96, -40, 1], [-118, 38, 1.1], [-88, 30, 0.9], [-128, -2, 1], [-104, 62, 0.95], [-76, -26, 0.8], [-134, 58, 0.9], [-150, 12, 1.05], [-110, -62, 1], [-82, 54, 0.85]];
  for (const [x, z, s] of ancSpots) {
    const i = ancT.count++; ancL.count++; const y = height(x, z) - 0.3, ry = r() * 6;
    setInst(ancT, i, x, y, z, s, ry); setInst(ancL, i, x, y, z, s, ry);
    ancL.setColorAt(i, _c.set(0x4f8a45).multiplyScalar(0.9 + r() * 0.2)); ancT.setColorAt(i, _c.setRGB(0.8, 0.8, 0.75));
    colliders.add({ x, z, r: 1.8 * s });
  }
  scene.add(ancT, ancL); world.ancient = ancSpots;

  // stumps (shown when a tree is chopped)
  const stumpG = new THREE.CylinderGeometry(0.3, 0.42, 0.45, 8); stumpG.translate(0, 0.2, 0);
  world.stumps = makeIM(stumpG, trunkMat, 400); world.stumps.count = 400; for (let i = 0; i < 400; i++) setInst(world.stumps, i, 0, -50, 0, 0, 0);
  scene.add(world.stumps); world.stumpFree = [...Array(400).keys()];

  // bushes
  const bushV = [0, 1, 2].map(i => G.bushGeo(700 + i * 5)), bushIM = bushV.map(g => makeIM(g, bushMat, 900));
  const bushCol = [0x5c9a44, 0x6aa84a, 0x4f8a3e, 0x7ab352];
  // rocks
  const rockV = [0, 1, 2, 3].map(i => G.rockGeo(900 + i * 11)), rockIM = rockV.map(g => makeIM(g, rockMat, 260));
  // ferns & mushrooms
  const fernIM = makeIM(G.fernGeo(), bushMat, 1600, false);
  const mushIM = makeIM(G.mushroomGeo(), patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), { snow: 1 }), 500, false);
  const reedIM = makeIM(G.reedGeo(), patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), { wind: 0.05, snow: 0.6, autumn: true }), 700, false);
  const lilyG = new THREE.CylinderGeometry(0.45, 0.45, 0.03, 9, 1, false, 0.3, Math.PI * 1.85); const lilyIM = makeIM(lilyG, patch(new THREE.MeshStandardMaterial({ color: 0x4f9a48, roughness: 0.6 }), { snow: 0 }), 260, false);

  for (let k = 0; k < 14000; k++) {
    const x = (r() * 2 - 1) * 166, z = (r() * 2 - 1) * 166, reg = regionAt(x, z), h = height(x, z), pd = pathDist(x, z);
    const roll = r();
    if (roll < 0.28) { // bushes near tree groves & path edges
      if (!canPlant(x, z, 2.2)) continue; const g = fbm(x * 0.028 + 9, z * 0.028 - 4, 3); if (r() > 0.25 + g + (pd < 5 ? 0.3 : 0)) continue;
      const v = Math.floor(r() * 3), im = bushIM[v]; if (im.count >= 900) continue; const i = im.count++; const s = 0.7 + r() * 0.8;
      setInst(im, i, x, h - 0.1, z, s, r() * 6, 0.8 + r() * 0.4); im.setColorAt(i, _c.set(bushCol[Math.floor(r() * 4)]).multiplyScalar(0.9 + r() * 0.25));
      if (s > 1.1) colliders.add({ x, z, r: 0.5 * s });
    } else if (roll < 0.36) { // rocks: denser in highlands, clustered
      const want = reg === 2 ? 0.8 : reg === 4 ? 0.5 : 0.25; if (r() > want) continue; if (h < -0.5 || h > 26 || pd < 2.6 || Math.hypot(x, z) > 146) continue;
      let bad = false; for (const ex of world.exclusions) if (Math.hypot(x - ex.x, z - ex.z) < ex.r) { bad = true; break; } if (bad) continue;
      const v = Math.floor(r() * 4), im = rockIM[v]; if (im.count >= 260) continue; const i = im.count++;
      const s = (reg === 2 ? 0.8 : 0.5) + r() * r() * 2.2; setInst(im, i, x, h - 0.2 * s, z, s, r() * 6, 0.7 + r() * 0.6);
      im.setColorAt(i, _c.setRGB(1, 1, 1).multiplyScalar(0.8 + r() * 0.3));
      const rk = { type: 'rock', x, z, s, y: h, inst: [im, i], alive: s < 2.2, regrow: true };
      world.rocks.push(rk); if (s < 2.2 && s > 0.55) things.add(rk);
      if (s > 0.6) rk.col = colliders.add({ x, z, r: 0.85 * s });
    } else if (roll < 0.52) { // ferns & mushrooms in shady woods
      if (!(reg === 4 || reg === 0 || reg === 2)) continue; if (!canPlant(x, z, 1.8)) continue;
      const g = fbm(x * 0.028 + 9, z * 0.028 - 4, 3); if (r() > 0.2 + g * 1.2 + (reg === 4 ? 0.4 : 0)) continue;
      if (r() < 0.8) { if (fernIM.count >= 1600) continue; const i = fernIM.count++; setInst(fernIM, i, x, h, z, 0.7 + r() * 0.8, r() * 6); fernIM.setColorAt(i, _c.set(reg === 4 ? 0x4f8a3a : 0x5e9a44)); }
      else { if (mushIM.count >= 500) continue; const i = mushIM.count++; setInst(mushIM, i, x, h, z, 0.7 + r() * 1.4, r() * 6); mushIM.setColorAt(i, _c.set(r() < 0.6 ? 0xd94a3a : r() < 0.5 ? 0xe8b062 : 0xc9a5e8)); }
    } else if (roll < 0.72) { // reeds and lily pads along water
      if (!(nearLake(x, z) || isRiverZone(x, z))) continue;
      if (h > -0.35 && h < 0.45 && reedIM.count < 700) { const i = reedIM.count++; setInst(reedIM, i, x, h, z, 0.8 + r() * 0.5, r() * 6); reedIM.setColorAt(i, _c.setRGB(1, 1, 1)); }
      else if (h < -0.8 && h > -2.6 && nearLake(x, z) && lilyIM.count < 260 && r() < 0.5) { const i = lilyIM.count++; setInst(lilyIM, i, x, WL + 0.02, z, 0.6 + r() * 0.6, r() * 6); lilyIM.setColorAt(i, _c.set(0x5aa14f).multiplyScalar(0.85 + r() * 0.3)); }
    }
  }
  for (const im of [...bushIM, ...rockIM, fernIM, mushIM, reedIM, lilyIM]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; scene.add(im); }
  fernIM.castShadow = false; lilyIM.receiveShadow = true;
  world.rockIMs = rockIM; world.lily = lilyIM;

  // ---------- flowers ----------
  const fg = G.flowerGeo();
  const stemMat = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), { wind: 0.12, bloom: true, snow: 0 });
  const headMat = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: 0x000000 }), { wind: 0.12, bloom: true, snow: 0 });
  const NF = quality === 'low' ? 6000 : 12000;
  const stems = makeIM(fg.stem, stemMat, NF, false), heads = makeIM(fg.head, headMat, NF, false);
  const palettes = { 0: [0xf7f3e8, 0xf2c14e, 0xe88aa8], 1: [0xf7f3e8, 0x9ac8f0, 0xf29bb5], 2: [0xf3f0ff, 0xb59ae8, 0xf7e27a], 3: [0xf2c14e, 0xe84a5f, 0xf29bb5, 0x9a7bd1, 0xffffff, 0xff9f45], 4: [0x7ea6f2, 0x9a7bd1, 0xf7f3e8] };
  for (let k = 0; k < NF * 3 && stems.count < NF; k++) {
    // flower fields: clustered patches with a single dominant colour each
    const x = (r() * 2 - 1) * 160, z = (r() * 2 - 1) * 160, reg = regionAt(x, z);
    const field = fbm(x * 0.04 + 31, z * 0.04 + 17, 3);
    const want = reg === 3 ? 0.15 + field * 1.4 : reg === 0 ? -0.15 + field : reg === 4 ? -0.2 + field * 0.8 : -0.3 + field * 0.8;
    if (r() > want) continue;
    if (!canPlant(x, z, 1.8)) continue;
    const i = stems.count++; heads.count++;
    const s = 0.8 + r() * 0.7, h = height(x, z), ry = r() * 6;
    setInst(stems, i, x, h - 0.02, z, s, ry); setInst(heads, i, x, h - 0.02, z, s, ry);
    const pal = palettes[reg], ci = Math.floor((fbm(x * 0.09, z * 0.09, 2) * 0.5 + 0.5) * pal.length * 0.999 + (r() < 0.15 ? 1 : 0)) % pal.length;
    heads.setColorAt(i, _c.set(pal[ci])); stems.setColorAt(i, _c.setRGB(1, 1, 1));
  }
  for (const im of [stems, heads]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; scene.add(im); }

  // harvestable wild-flower clumps (gather FLOWERS)
  const clumpG = G.merge([G.flowerGeo().head, G.flowerGeo().stem]);
  const clumpParts = [];
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28, d = i ? 0.35 : 0; const st = fg.stem.clone(); st.translate(Math.cos(a) * d, 0, Math.sin(a) * d); const hd = fg.head.clone(); hd.scale(1.6, 1.6, 1.6); hd.translate(Math.cos(a) * d, 0.25, Math.sin(a) * d); clumpParts.push(st, hd); }
  const cg = G.merge(clumpParts);
  const clumpIM = makeIM(cg, headMat, 160, false);
  for (let k = 0; k < 4000 && clumpIM.count < 160; k++) {
    const x = (r() * 2 - 1) * 158, z = (r() * 2 - 1) * 158, reg = regionAt(x, z);
    if (r() > (reg === 3 ? 0.4 : 0.12)) continue; if (!canPlant(x, z, 2.5)) continue;
    const i = clumpIM.count++; const h = height(x, z); setInst(clumpIM, i, x, h, z, 1.1, r() * 6);
    const col = palettes[reg][Math.floor(r() * palettes[reg].length)]; clumpIM.setColorAt(i, _c.set(col));
    const c = { type: 'clump', x, z, y: h, inst: [clumpIM, i], alive: true, rare: false }; world.clumps.push(c); things.add(c);
  }
  clumpIM.instanceMatrix.needsUpdate = true; clumpIM.instanceColor.needsUpdate = true; scene.add(clumpIM);
  world.clumpIM = clumpIM;
}

// ---------- sky, sun & clouds ----------
function buildSky(scene) {
  const g = new THREE.SphereGeometry(900, 32, 16);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() }, uNight: { value: 0 }, uCloud: { value: 0 } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 uTop,uHorizon,uBottom,uSunDir,uSunCol; uniform float uNight,uCloud; varying vec3 vD;
      float h3(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
      void main(){
        vec3 d = normalize(vD); float y = d.y;
        vec3 c = y > 0.0 ? mix(uHorizon, uTop, pow(clamp(y,0.0,1.0), 0.55)) : mix(uHorizon, uBottom, clamp(-y*3.0,0.0,1.0));
        float sd = max(dot(d, normalize(uSunDir)), 0.0);
        c += uSunCol * (pow(sd, 900.0) * 6.0 + pow(sd, 18.0) * 0.35) * (1.0 - uCloud*0.8);
        vec3 md = -normalize(uSunDir); float mm = max(dot(d, md), 0.0);
        c += vec3(0.85,0.9,1.0) * (smoothstep(0.9993, 0.9996, mm) * 1.4 + pow(mm, 40.0)*0.08) * uNight;
        vec3 sp = floor(d * 280.0); float st = step(0.9965, h3(sp)) * smoothstep(0.0, 0.3, y);
        c += vec3(st) * uNight * (0.6 + 0.4*sin(h3(sp+1.0)*40.0)) * (1.0 - uCloud);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const sky = new THREE.Mesh(g, mat); sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky); world.sky = sky;

  // stylised clouds
  const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.95, flatShading: true, emissive: 0xffffff, emissiveIntensity: 0.15 });
  const r = rng(5); const clouds = new THREE.Group();
  for (let i = 0; i < 22; i++) {
    const parts = []; const n = 4 + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) parts.push(G.blob(6 + r() * 6, k * 7 - n * 3.5, r() * 3, r() * 6 - 3, i * 10 + k, 1, 0.6));
    const m = new THREE.Mesh(G.merge(parts), cm); m.position.set((r() * 2 - 1) * 400, 85 + r() * 40, (r() * 2 - 1) * 400); m.rotation.y = r() * 6; m.scale.setScalar(0.8 + r() * 0.8);
    m.userData.v = 1 + r(); clouds.add(m);
  }
  scene.add(clouds); world.clouds = clouds; world.cloudMat = cm;
}

// ---------- landmarks & environmental stories ----------
function box(w, h, d, mat, x, y, z, parent, ry = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
function cyl(rt, rb, h, mat, x, y, z, parent, seg = 8) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
function placeGroup(scene, g, x, z, ry = 0, colR = 0) { g.position.set(x, height(x, z), z); g.rotation.y = ry; scene.add(g); if (colR) colliders.add({ x, z, r: colR }); world.props.push(g); return g; }

function buildLandmarks(scene) {
  // --- arched footbridge over the river on the east path ---
  const bx = riverX(1.5), bz = 1.5;
  const bridge = new THREE.Group();
  const len = 13, segs = 14;
  for (let i = 0; i < segs; i++) {
    const u = (i + 0.5) / segs * 2 - 1, y = 1.2 * (1 - u * u);
    const plank = box(len / segs + 0.02, 0.18, 2.6, i % 2 ? M.wood : M.woodLight, u * len / 2, y + 1.85, 0, bridge);
    plank.rotation.z = -2 * 1.2 * u / (len / 2) * 0.9;
  }
  for (const side of [-1, 1]) for (let i = 0; i <= 6; i++) {
    const u = i / 6 * 2 - 1, y = 1.2 * (1 - u * u);
    cyl(0.08, 0.1, 1.1, M.woodDark, u * len / 2, y + 2.4, side * 1.25, bridge, 6);
    if (i < 6) { const u2 = (i + 1) / 6 * 2 - 1, y2 = 1.2 * (1 - u2 * u2); const rail = box(len / 6 + 0.1, 0.12, 0.12, M.wood, (u + u2) / 2 * len / 2, (y + y2) / 2 + 2.9, side * 1.25, bridge); rail.rotation.z = Math.atan2(y2 - y, len / 6); }
  }
  for (const s of [-1, 1]) { cyl(0.25, 0.3, 3.2, M.stoneDark, s * 6.2, 0.6, 1.1, bridge); cyl(0.25, 0.3, 3.2, M.stoneDark, s * 6.2, 0.6, -1.1, bridge); }
  bridge.position.set(bx, 0, bz); scene.add(bridge); world.props.push(bridge);
  addSurface({ x: bx, z: bz, rot: 0, hw: len / 2, hd: 1.3, y: 1.95, arch: 1.2, kind: 'wood' });

  // --- trailhead: bus-stop shelter, signpost, parked cart ---
  const th = new THREE.Group();
  box(3.6, 0.2, 2, M.woodDark, 0, 0.1, 0, th); for (const [x, z] of [[-1.6, -0.8], [1.6, -0.8], [-1.6, 0.8], [1.6, 0.8]]) cyl(0.08, 0.08, 2.4, M.wood, x, 1.3, z, th, 6);
  const tr = box(4.2, 0.15, 2.6, M.roofGreen, 0, 2.6, 0, th); tr.rotation.x = 0.12; box(3, 0.12, 0.5, M.woodLight, 0, 0.6, -0.6, th);
  box(1.8, 0.6, 0.08, M.woodPaintCream, 0, 2.15, 0.95, th);
  placeGroup(scene, th, TRAILHEAD.x - 2.5, TRAILHEAD.z + 2, -0.6, 2);
  world.exclusions.push({ x: TRAILHEAD.x, z: TRAILHEAD.z, r: 6 });

  // --- central signpost pointing to each region ---
  const sp = new THREE.Group(); cyl(0.12, 0.15, 3.4, M.woodDark, 0, 1.7, 0, sp, 6);
  const dirs = [[Math.PI / 2, 0x6fa04a], [0, 0xd8b84a], [-Math.PI / 2, 0x4f9ac0], [Math.PI, 0x4a6a48]];
  dirs.forEach(([a], i) => { const b = box(1.6, 0.32, 0.08, M.woodPaintCream, 0.7, 2.9 - i * 0.42, 0, sp); b.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), a); b.rotation.y = a; });
  placeGroup(scene, sp, 3, 4, 0, 0.3);

  // --- campfire & woodpile near the home cabin ---
  const cf = new THREE.Group();
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25, 0), M.stoneDark); s.position.set(Math.cos(a) * 0.75, 0.12, Math.sin(a) * 0.75); s.castShadow = true; cf.add(s); }
  for (let i = 0; i < 4; i++) { const l = cyl(0.08, 0.08, 1.0, M.logDark, 0, 0.18, 0, cf, 6); l.rotation.z = Math.PI / 2 - 0.4; l.rotation.y = i * 0.8; }
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.8, 7), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9 })); fire.position.y = 0.5; cf.add(fire); world.fire = fire;
  for (const [x, z, a] of [[-2.2, 0, 0], [2.2, 0.3, 0.2], [0, 2.3, 1.57]]) { const l = cyl(0.28, 0.28, 2, M.log, x, 0.3, z, cf, 8); l.rotation.z = Math.PI / 2; l.rotation.y = a; }
  placeGroup(scene, cf, -3, 10, 0.3, 1.0); world.firePos = new THREE.Vector3(-3, height(-3, 10) + 0.6, 10);
  world.benchSeats = [{ x: -5.2, z: 10, ry: Math.PI / 2 }, { x: -0.8, z: 10.3, ry: -Math.PI / 2 }, { x: -3, z: 12.3, ry: Math.PI }];
  const wp = new THREE.Group(); for (let i = 0; i < 9; i++) { const l = cyl(0.18, 0.18, 1.6, M.log, (i % 3) * 0.38 - 0.38, 0.2 + Math.floor(i / 3) * 0.34, 0, wp, 8); l.rotation.x = Math.PI / 2; }
  placeGroup(scene, wp, -12, -1, 0.4, 1);

  // --- construction site marker in the clearing ---
  const cs = new THREE.Group(); const flagM = new THREE.MeshStandardMaterial({ color: 0xf08f3a, side: THREE.DoubleSide });
  for (const [x, z] of [[-6, -6], [6, -6], [6, 6], [-6, 6]]) { cyl(0.05, 0.05, 1.1, M.woodLight, x, 0.55, z, cs, 5); const f = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.25), flagM); f.position.set(x + 0.2, 1.0, z); cs.add(f); }
  const ropeM = new THREE.LineBasicMaterial({ color: 0xe8dcc0 }); const rp = [[-6, -6], [6, -6], [6, 6], [-6, 6], [-6, -6]].map(([x, z]) => new THREE.Vector3(x, 0.8, z));
  cs.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(rp), ropeM));
  placeGroup(scene, cs, 12, -14, 0.2); world.siteMarker = cs;

  // --- windmill in the meadow (landmark, spinning) ---
  const wm = new THREE.Group();
  const tower = cyl(1.6, 2.6, 9, M.plaster, 0, 4.5, 0, wm, 10); const cap = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.4, 10), M.roofBrown); cap.position.y = 10.1; cap.castShadow = true; wm.add(cap);
  box(1.1, 1.8, 0.2, M.woodDark, 0, 0.9, 2.5, wm);
  const blades = new THREE.Group(); blades.position.set(0, 8.4, 2.4); wm.add(blades);
  for (let i = 0; i < 4; i++) { const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2; blades.add(arm); box(0.18, 6, 0.12, M.woodDark, 0, 3, 0, arm); box(1.2, 4.8, 0.05, M.canvasTent, 0.65, 3.4, 0, arm); }
  placeGroup(scene, wm, 110, 30, -0.9, 3); world.windmill = blades;
  world.exclusions.push({ x: 110, z: 30, r: 7 });

  // --- old fisherman's hut ruin on the lakeshore ---
  const fh = new THREE.Group();
  box(3.4, 1.6, 0.2, M.woodDark, 0, 0.8, -1.6, fh); box(0.2, 1.2, 3.2, M.woodDark, -1.6, 0.6, 0, fh); box(0.2, 2.2, 3.2, M.woodDark, 1.6, 1.1, 0, fh);
  const rf = box(3.8, 0.12, 2.2, M.woodDark, 0.4, 2.1, -0.6, fh); rf.rotation.z = 0.25; rf.rotation.x = 0.15;
  const boat = new THREE.Group(); const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 3.4, 10, 1, true, 0, Math.PI), M.woodPaintBlue); hull.rotation.z = Math.PI / 2; hull.rotation.y = Math.PI / 2; hull.rotation.x = Math.PI; hull.material.side = THREE.DoubleSide; boat.add(hull); boat.position.set(3.2, 0.2, 1.4); boat.rotation.z = 0.5; fh.add(boat);
  placeGroup(scene, fh, 48, 92, -2.2, 2.2); world.exclusions.push({ x: 48, z: 92, r: 5 });

  // --- moored rowboat on the lake ---
  const rb = new THREE.Group(); const h2 = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 3.2, 12, 1, true, 0, Math.PI), new THREE.MeshStandardMaterial({ map: TEX.planks, color: 0xd97a4a, side: THREE.DoubleSide, roughness: 0.8 })); h2.rotation.set(Math.PI, 0, Math.PI / 2); rb.add(h2); box(1.2, 0.08, 0.3, M.woodLight, 0, -0.1, 0, rb, Math.PI / 2);
  rb.position.set(6, 0.15, 98); scene.add(rb); world.rowboat = rb;

  // --- hermit's cairn & mine in the highlands ---
  const cn = new THREE.Group(); for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 - i * 0.08, 0), M.stone); s.position.set(Math.sin(i) * 0.1, 0.4 + i * 0.75, 0); s.rotation.y = i; s.castShadow = true; cn.add(s); }
  placeGroup(scene, cn, -30, -110, 0, 0.8); world.exclusions.push({ x: -30, z: -110, r: 4 });
  const mine = new THREE.Group(); box(0.4, 3.4, 0.4, M.logDark, -1.6, 1.7, 0, mine); box(0.4, 3.4, 0.4, M.logDark, 1.6, 1.7, 0, mine); box(4, 0.45, 0.45, M.logDark, 0, 3.4, 0, mine); box(2.8, 3.1, 0.3, M.dark, 0, 1.55, -0.3, mine);
  for (let i = 0; i < 5; i++) box(0.2, 0.08, 1.4, M.woodDark, 0, 0.05, 1 + i * 0.8, mine); for (const s of [-0.5, 0.5]) box(0.08, 0.08, 4.4, M.metal, s, 0.12, 2.6, mine);
  const cart = box(1.2, 0.7, 1.4, M.metal, 0, 0.55, 3.4, mine);
  placeGroup(scene, mine, 40, -96, Math.PI * 0.85, 2.4); world.exclusions.push({ x: 40, z: -96, r: 5 });

  // --- abandoned campsite (forest edge) ---
  const camp = new THREE.Group(); const tent = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2, 4, 1, true), M.canvasOrange); tent.position.y = 1; tent.rotation.y = Math.PI / 4; tent.rotation.z = 0.25; tent.castShadow = true; camp.add(tent);
  for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), M.stoneDark); s.position.set(2.5 + Math.cos(i) * 0.6, 0.1, Math.sin(i) * 0.6); camp.add(s); }
  const pot = cyl(0.25, 0.2, 0.3, M.metal, 2.5, 0.2, 0, camp, 10);
  placeGroup(scene, camp, -42, -26, 0.6, 1.6); world.exclusions.push({ x: -42, z: -26, r: 5 });

  // --- ruins in the Old Woodland ---
  const ruinSpots = [[-100, -20], [-130, 20], [-112, 52], [-140, -30]];
  ruinSpots.forEach(([x, z], k) => {
    const g = new THREE.Group(); const rr = rng(k + 50);
    for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28, d = 4.2; const hgt = 1 + rr() * 3.6; const c = cyl(0.42, 0.5, hgt, M.mossStone, Math.cos(a) * d, hgt / 2, Math.sin(a) * d, g, 8); c.rotation.z = (rr() - 0.5) * 0.2; colliders.add({ x: x + Math.cos(a) * d, z: z + Math.sin(a) * d, r: 0.55 }); if (hgt > 3.2 && i % 2 === 0) { box(1.4, 0.4, 1.4, M.mossStone, Math.cos(a) * d, hgt + 0.2, Math.sin(a) * d, g); } }
    if (k < 3) { const alt = box(1.6, 0.9, 1.0, M.mossStone, 0, 0.45, 0, g); box(2, 0.2, 1.3, M.stone, 0, 0.95, 0, g); }
    const arch = new THREE.Group(); box(0.6, 3.2, 0.6, M.mossStone, -1.4, 1.6, 0, arch); box(0.6, 3.2, 0.6, M.mossStone, 1.4, 1.6, 0, arch); box(3.6, 0.6, 0.8, M.mossStone, 0, 3.4, 0, arch); arch.position.set(0, 0, 5.8); g.add(arch);
    colliders.add({ x: x - 1.4, z: z + 5.8, r: 0.5 }); colliders.add({ x: x + 1.4, z: z + 5.8, r: 0.5 });
    placeGroup(scene, g, x, z, rr() * 6); world.exclusions.push({ x, z, r: 8 });
  });
  // fallen log across a forest trail (environmental detail)
  const fl = new THREE.Group(); const lg = cyl(0.5, 0.55, 7, M.log, 0, 0.45, 0, fl, 10); lg.rotation.z = Math.PI / 2; for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(G.mushroomGeo(), new THREE.MeshStandardMaterial({ vertexColors: true })); m.position.set(-2.5 + i, 0.8, 0.3); m.scale.setScalar(0.8); fl.add(m); }
  placeGroup(scene, fl, -28, 18, 0.8); colliders.add({ x: -28, z: 18, r: 1 }); colliders.add({ x: -30, z: 16.3, r: 0.8 }); colliders.add({ x: -26, z: 19.7, r: 0.8 });
}

// ---------- region gates ----------
function buildGates(scene) {
  const spots = [[1, 0, 60], [2, -7, -60], [3, 60, 3], [4, -60, 1]];
  for (const [reg, x, z] of spots) {
    const ang = Math.atan2(x, z);
    const g = new THREE.Group();
    const arch = new THREE.Group();
    cyl(0.25, 0.3, 4.4, M.logDark, -2.4, 2.2, 0, arch, 8); cyl(0.25, 0.3, 4.4, M.logDark, 2.4, 2.2, 0, arch, 8);
    const top = cyl(0.22, 0.22, 5.8, M.log, 0, 4.3, 0, arch, 8); top.rotation.z = Math.PI / 2;
    box(3, 0.7, 0.12, M.woodPaintCream, 0, 3.6, 0.2, arch);
    g.add(arch);
    const barrier = new THREE.Group();
    for (let i = 0; i < 3; i++) { const l = cyl(0.2, 0.22, 5, M.log, 0, 0.5 + i * 0.55, 0, barrier, 8); l.rotation.z = Math.PI / 2 + (i - 1) * 0.06; }
    const sign = new THREE.Group(); cyl(0.07, 0.07, 1.4, M.woodDark, 0, 0.7, 0, sign, 5); box(1.1, 0.7, 0.08, M.woodPaintCream, 0, 1.4, 0, sign); sign.position.set(2.9, 0, 1.4); barrier.add(sign);
    g.add(barrier);
    g.position.set(x, height(x, z), z); g.rotation.y = ang; scene.add(g);
    // label texture on the arch sign
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const cx = c.getContext('2d');
    cx.fillStyle = '#f1e3c4'; cx.fillRect(0, 0, 512, 128); cx.fillStyle = '#4a3423'; cx.font = '600 52px "Fraunces", Georgia, serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(REGION_NAMES[reg], 256, 66);
    const lt = new THREE.CanvasTexture(c); lt.colorSpace = THREE.SRGBColorSpace; const lab = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 0.68), new THREE.MeshStandardMaterial({ map: lt, roughness: 0.8 })); lab.position.set(0, 3.6, 0.27); arch.add(lab);
    const lab2 = lab.clone(); lab2.rotation.y = Math.PI; lab2.position.z = 0.13; arch.add(lab2);
    const gate = { region: reg, x, z, ang, group: g, barrier, sign, open: false, blockers: [] };
    for (let i = -2; i <= 2; i++) gate.blockers.push(colliders.add({ x: x + Math.cos(ang) * i * 1.1, z: z - Math.sin(ang) * i * 1.1, r: 0.8, gate }));
    colliders.add({ x: x + Math.cos(ang) * 2.4, z: z - Math.sin(ang) * 2.4, r: 0.35 }); colliders.add({ x: x - Math.cos(ang) * 2.4, z: z + Math.sin(ang) * 2.4, r: 0.35 });
    world.gates.push(gate); things.add(Object.assign(gate, { type: 'gate' }));
    world.exclusions.push({ x, z, r: 6 });
  }
}
const REGION_NAMES = ['The Forest', 'The Lakeside', 'The Highlands', 'The Meadow', 'The Old Woodland'];
export function openGate(gate, instant) {
  gate.open = true;
  for (const b of gate.blockers) colliders.remove(b);
  if (instant) { gate.barrier.visible = false; return; }
  gate.anim = 0;
}

// ---------- discoveries ----------
export const DISCOVERY_DEFS = [
  { id: 'journal1', kind: 'journal', x: -41, z: -24, title: "Caretaker's Journal · I", text: '“Day one. The old cabin still stands. Nobody has lived out here in years, but the clearing feels like it has been waiting for someone. I will plant a garden by the door.”', reward: { coins: 60 } },
  { id: 'chest1', kind: 'chest', x: 31, z: -38, title: 'Buried Chest', text: 'Under the roots of a riverside oak: a tin box of old coins, wrapped in oilcloth.', reward: { coins: 150 } },
  { id: 'compass', kind: 'lost', x: 38, z: 28, title: 'Lost Compass', text: 'A brass compass, its needle still steady. Engraved: “for whoever finds the way home.” The traveller who lost it left a few planks of lumber behind as well.', reward: { wood: 20 } },
  { id: 'moonbell', kind: 'rare', x: -47, z: 9, title: 'Moonbell', text: 'A pale blue flower that only opens in shade. Seeds gathered — you can now plant Moonbell Beds.', reward: { flowers: 10, unlock: 'moonbed' } },
  { id: 'view1', kind: 'view', x: 40, z: -46, title: 'Owl Rock Lookout', text: 'From the top of the rock the whole valley opens up: the clearing, the river, and the lake glinting to the south.', reward: { rep: 15 } },
  { id: 'journal2', kind: 'journal', x: 45, z: 90, title: "Caretaker's Journal · II", text: '“The fisherman says the lake gives back what you are patient with. I caught nothing all morning, and still came home happy.”', reward: { coins: 90 } },
  { id: 'chest2', kind: 'chest', x: -29, z: 98, title: "Smuggler's Strongbox", text: 'Half-buried in the reeds of the western shore. Whoever hid it never came back.', reward: { coins: 240 } },
  { id: 'goldrod', kind: 'lost', x: 45, z: 133, title: 'Golden Fishing Rod', text: 'A beautiful old rod, gilded at the grip. Fish bite twice as eagerly for it — catches now sell for double.', reward: { unlock: 'goldrod' } },
  { id: 'view2', kind: 'view', x: -30, z: 130, title: 'Heron Point', text: 'The lake looks endless from here. Herons stand in the shallows like grey statues.', reward: { rep: 20 } },
  { id: 'journal3', kind: 'journal', x: -28, z: -108, title: "Caretaker's Journal · III", text: '“A hermit used to stack these stones, one for every winter he spent up here. I counted six. I think he was waiting for spring, too.”', reward: { coins: 120 } },
  { id: 'edelweiss', kind: 'rare', x: 26, z: -126, title: 'Star Edelweiss', text: 'A woolly white star on a windy slope. You can now plant Alpine Rock Gardens.', reward: { flowers: 15, unlock: 'alpine' } },
  { id: 'view3', kind: 'view', x: 0, z: -138, title: 'Summit Cairn', text: 'The highest point of the valley. On a clear day you can see every corner of Evergreen.', reward: { rep: 30 } },
  { id: 'chest3', kind: 'chest', x: 37, z: -93, title: "Miner's Lockbox", text: 'Left by the mouth of the old mine: silver coins and a sack of cut stone.', reward: { coins: 300, stone: 40 } },
  { id: 'journal4', kind: 'journal', x: 106, z: 34, title: "Caretaker's Journal · IV", text: '“Fixed the windmill’s sails today. It turns again — slowly, like it remembered how. The meadow hums with bees.”', reward: { coins: 120 } },
  { id: 'orchid', kind: 'rare', x: 140, z: -20, title: 'Sunstar Orchid', text: 'A golden orchid that glows faintly at dusk. You can now plant Rare Flower Beds.', reward: { flowers: 20, unlock: 'rarebed' } },
  { id: 'kite', kind: 'lost', x: 95, z: -35, title: 'Lost Kite', text: 'A patchwork kite tangled in a birch. A child’s name is stitched on the tail. Someone in the village will be glad.', reward: { flowers: 15, rep: 10 } },
  { id: 'relic1', kind: 'relic', x: -100, z: -20, title: 'Relic of Roots', text: 'A smooth stone carved with spiralling roots. You can now build the Moss Statue.', reward: { unlock: 'statue', rep: 20 } },
  { id: 'relic2', kind: 'relic', x: -130, z: 20, title: 'Relic of Rings', text: 'A stone disc marked with tree rings. You can now build the Stone Circle.', reward: { unlock: 'stonecircle', rep: 20 } },
  { id: 'relic3', kind: 'relic', x: -112, z: 52, title: 'Relic of Light', text: 'A shard of pale crystal that holds the evening light. You can now build the Lantern Arch.', reward: { unlock: 'lanternarch', rep: 20 } },
  { id: 'journal5', kind: 'journal', x: -138, z: -27, title: "Caretaker's Journal · V", text: '“Under the Elder Tree I finally understood. The forest was never waiting for a village. It was waiting for someone who would listen.” — the last page.', reward: { rep: 60, coins: 400 } },
];
function buildDiscoveries(scene) {
  const mats = { journal: new THREE.MeshStandardMaterial({ color: 0x8a4a2a, roughness: 0.7 }), chest: M.woodDark, lost: M.brass, rare: new THREE.MeshStandardMaterial({ color: 0x9ac8ff, emissive: 0x4a7ad6, emissiveIntensity: 0.6 }), relic: M.crystal };
  const sparkG = new THREE.BufferGeometry(); const sp = []; for (let i = 0; i < 16; i++) sp.push((Math.random() - 0.5) * 1.4, Math.random() * 2, (Math.random() - 0.5) * 1.4); sparkG.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const sparkM = new THREE.PointsMaterial({ color: 0xfff0b0, size: 0.18, map: TEX.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const d of DISCOVERY_DEFS) {
    const g = new THREE.Group(); const y = height(d.x, d.z);
    if (d.kind === 'journal') { box(0.5, 0.12, 0.38, mats.journal, 0, 0.75, 0, g); box(0.3, 0.7, 0.3, M.stone, 0, 0.35, 0, g); }
    else if (d.kind === 'chest') { box(0.9, 0.5, 0.6, M.woodDark, 0, 0.25, 0, g); const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 10, 1, false, 0, Math.PI), M.wood); lid.rotation.z = Math.PI / 2; lid.position.y = 0.5; g.add(lid); box(0.95, 0.08, 0.08, M.brass, 0, 0.45, 0.3, g); }
    else if (d.kind === 'lost') { const s = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.06, 8, 16), M.brass); s.rotation.x = -Math.PI / 2; s.position.y = 0.6; g.add(s); box(0.25, 0.5, 0.25, M.woodDark, 0, 0.25, 0, g); }
    else if (d.kind === 'rare') { for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), mats.rare); f.position.set(Math.cos(i * 1.3) * 0.3, 0.4 + (i % 2) * 0.1, Math.sin(i * 1.3) * 0.3); g.add(f); } }
    else if (d.kind === 'relic') { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), M.crystal); c.position.y = 1.5; g.add(c); g.userData.spin = c; }
    else if (d.kind === 'view') { const s = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.8, 24), new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.6, side: THREE.DoubleSide })); s.rotation.x = -Math.PI / 2; s.position.y = 0.08; g.add(s); }
    const spark = new THREE.Points(sparkG, sparkM); g.add(spark);
    g.position.set(d.x, y, d.z); g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(g);
    const o = Object.assign({ type: 'discovery', y, group: g, found: false, region: regionAt(d.x, d.z) }, d);
    world.discoveries.push(o); things.add(o);
  }
}

export function buildWorld(scene, quality = 'med') {
  world.exclusions = [{ x: 0, z: 0, r: 6 }, { x: -9, z: 3, r: 7, home: true }];
  buildTerrain(scene);
  buildSky(scene);
  buildWater(scene);
  buildLandmarks(scene);
  buildGates(scene);
  for (const d of DISCOVERY_DEFS) world.exclusions.push({ x: d.x, z: d.z, r: 3 });
  buildVegetation(scene, quality);
  bakeAO();
  buildGrassData();
  buildGrass(scene, 'high');
  buildDiscoveries(scene);
  return world;
}
export { REGION_NAMES };
