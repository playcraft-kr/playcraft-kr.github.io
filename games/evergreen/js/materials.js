// EVERGREEN — procedural textures, shared materials and the global season/wind shader patch
import * as THREE from 'three';
import { rng } from './util.js';

// Global uniforms shared by every patched material
export const U = {
  uTime: { value: 0 },
  uSnow: { value: 0 },     // 0..1 snow cover
  uAutumn: { value: 0 },   // 0..1 autumn foliage
  uSpring: { value: 0 },   // 0..1 blossom
  uBloom: { value: 1 },    // flower scale (0 in winter)
  uWind: { value: 1 },     // wind strength
  uWet: { value: 0 },      // rain darkening
};

/**
 * Patch a standard material with snow, wetness, wind sway, autumn colours and fake AO.
 * opts: {snow:0..1, wind:amount, autumn:bool, ao:[minY,maxY], bloom:bool}
 */
export function patch(mat, opts = {}) {
  const snow = opts.snow ?? 1;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    const head = `uniform float uTime,uSnow,uAutumn,uSpring,uBloom,uWind,uWet;\nvarying vec3 vWN;\nflat varying vec3 vIP;\nvarying float vAO;\n`;
    sh.vertexShader = head + sh.vertexShader
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 ip = vec3(0.0);
        #ifdef USE_INSTANCING
          ip = instanceMatrix[3].xyz;
        #endif
        ip = (modelMatrix * vec4(ip,1.0)).xyz;
        vIP = ip;
        vAO = 1.0;
        ${opts.ao ? `vAO = mix(0.5, 1.08, smoothstep(${opts.ao[0].toFixed(2)}, ${opts.ao[1].toFixed(2)}, position.y));` : ''}
        ${opts.bloom ? `transformed *= uBloom;` : ''}
        ${opts.wind ? `
          float sw = sin(uTime*1.6 + ip.x*0.21 + ip.z*0.17) * 0.6 + sin(uTime*2.7 + ip.z*0.5) * 0.4;
          float hgt = max(position.y, 0.0);
          transformed.x += sw * ${opts.wind.toFixed(3)} * hgt * uWind;
          transformed.z += cos(uTime*1.3 + ip.x*0.3) * ${(opts.wind * 0.6).toFixed(3)} * hgt * uWind;
          transformed.y += sin(uTime*4.0 + position.x*3.0 + position.z*2.0 + ip.x) * 0.02 * hgt * uWind;` : ''}
      `)
      .replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
        #ifdef USE_INSTANCING
          vWN = normalize((modelMatrix * instanceMatrix * vec4(objectNormal,0.0)).xyz);
        #else
          vWN = normalize((modelMatrix * vec4(objectNormal,0.0)).xyz);
        #endif
      `);
    sh.fragmentShader = head + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${opts.autumn ? `
          float hh = fract(sin(dot(floor(vIP.xz * 4.0) * 0.25, vec2(12.9898,78.233))) * 43758.5453);
          float lum = dot(diffuseColor.rgb, vec3(0.3,0.59,0.11)) * 2.2;
          vec3 aut = mix(vec3(0.98,0.58,0.12), vec3(0.85,0.22,0.08), hh);
          aut = mix(aut, vec3(0.97,0.8,0.22), step(0.72, hh));
          diffuseColor.rgb = mix(diffuseColor.rgb, aut * clamp(lum, 0.55, 1.15), uAutumn);
          ${opts.blossom === false ? '' : 'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.97,0.58,0.74) * clamp(lum,0.85,1.15), uSpring * step(hh, 0.18));'}
        ` : ''}
        diffuseColor.rgb *= vAO;
        diffuseColor.rgb *= 1.0 - uWet * 0.18;
        float sn = smoothstep(0.3, 0.8, vWN.y) * uSnow * ${snow.toFixed(2)};
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92,0.95,1.0), sn);
      `);
  };
  mat.customProgramCacheKey = () => JSON.stringify(opts) + mat.type;
  return mat;
}

// ---------- canvas textures ----------
function canvasTex(size, draw, repeat = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function noiseFill(g, s, base, amp, r) {
  const img = g.getImageData(0, 0, s, s), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * amp; d[i] = Math.max(0, Math.min(255, d[i] + n)); d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n)); d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n)); }
  g.putImageData(img, 0, 0);
}
const R = rng(42);

export const TEX = {};
TEX.planks = canvasTex(256, (g, s) => {
  const rows = 8, h = s / rows;
  for (let i = 0; i < rows; i++) {
    const v = 200 + R() * 40; g.fillStyle = `rgb(${v},${v * 0.97},${v * 0.92})`; g.fillRect(0, i * h, s, h);
    g.strokeStyle = 'rgba(60,40,20,0.12)';
    for (let k = 0; k < 7; k++) { g.beginPath(); const y = i * h + R() * h; g.moveTo(0, y); g.bezierCurveTo(s * 0.3, y + R() * 6 - 3, s * 0.6, y + R() * 6 - 3, s, y); g.stroke(); }
    g.fillStyle = 'rgba(40,25,10,0.45)'; g.fillRect(0, i * h, s, 2);
    const off = R() * s; g.fillRect(off, i * h, 2, h);
  }
  noiseFill(g, s, 0, 18, R);
});
TEX.logs = canvasTex(256, (g, s) => {
  const rows = 6, h = s / rows;
  for (let i = 0; i < rows; i++) {
    const grd = g.createLinearGradient(0, i * h, 0, i * h + h);
    grd.addColorStop(0, '#8a8a8a'); grd.addColorStop(0.25, '#f2f2f2'); grd.addColorStop(0.6, '#d8d8d8'); grd.addColorStop(1, '#6b6b6b');
    g.fillStyle = grd; g.fillRect(0, i * h, s, h);
    g.strokeStyle = 'rgba(70,50,30,0.15)';
    for (let k = 0; k < 6; k++) { g.beginPath(); const y = i * h + 6 + R() * (h - 12); g.moveTo(0, y); g.lineTo(s, y + R() * 4 - 2); g.stroke(); }
  }
  noiseFill(g, s, 0, 14, R);
});
TEX.stone = canvasTex(256, (g, s) => {
  g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 60; i++) {
    const x = R() * s, y = R() * s, r = 14 + R() * 22, v = 170 + R() * 70;
    for (const [ox, oy] of [[0, 0], [s, 0], [-s, 0], [0, s], [0, -s]]) {
      g.fillStyle = `rgb(${v},${v},${v * 0.98})`; g.beginPath(); g.ellipse(x + ox, y + oy, r, r * (0.6 + R() * 0.3), R() * 3, 0, 7); g.fill();
      g.strokeStyle = 'rgba(40,40,40,0.35)'; g.lineWidth = 2; g.stroke();
    }
  }
  noiseFill(g, s, 0, 20, R);
});
TEX.bricks = canvasTex(256, (g, s) => {
  g.fillStyle = '#777'; g.fillRect(0, 0, s, s); const rows = 8, h = s / rows;
  for (let i = 0; i < rows; i++) for (let j = -1; j < 5; j++) {
    const v = 175 + R() * 60, w = s / 4, x = j * w + (i % 2) * w / 2;
    g.fillStyle = `rgb(${v},${v * 0.98},${v * 0.95})`; g.fillRect(x + 2, i * h + 2, w - 4, h - 4);
  }
  noiseFill(g, s, 0, 16, R);
});
TEX.shingles = canvasTex(256, (g, s) => {
  g.fillStyle = '#555'; g.fillRect(0, 0, s, s); const rows = 10, h = s / rows, w = s / 8;
  for (let i = 0; i < rows; i++) for (let j = -1; j < 9; j++) {
    const v = 185 + R() * 60, x = j * w + (i % 2) * w / 2;
    g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath();
    g.moveTo(x + 1, i * h); g.lineTo(x + w - 1, i * h); g.lineTo(x + w - 1, i * h + h * 0.7);
    g.quadraticCurveTo(x + w / 2, i * h + h * 1.15, x + 1, i * h + h * 0.7); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, i * h + h * 0.82, w, 3);
  }
  noiseFill(g, s, 0, 12, R);
});
TEX.bark = canvasTex(128, (g, s) => {
  g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(60,45,30,${0.15 + R() * 0.25})`; g.fillRect(R() * s, 0, 2 + R() * 4, s); }
  noiseFill(g, s, 0, 26, R);
});
TEX.birch = canvasTex(128, (g, s) => {
  g.fillStyle = '#f1eee6'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(30,30,30,0.8)'; g.fillRect(R() * s, R() * s, 6 + R() * 16, 2 + R() * 3); }
  noiseFill(g, s, 0, 14, R);
});
TEX.fabric = canvasTex(128, (g, s) => {
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f6efe0' : '#c9443a'; g.fillRect(i * s / 8, 0, s / 8, s); }
  g.fillStyle = 'rgba(0,0,0,0.06)'; for (let y = 0; y < s; y += 2) g.fillRect(0, y, s, 1);
});
TEX.fabricGreen = canvasTex(128, (g, s) => {
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f3ecd8' : '#3f7d58'; g.fillRect(i * s / 8, 0, s / 8, s); }
  g.fillStyle = 'rgba(0,0,0,0.06)'; for (let y = 0; y < s; y += 2) g.fillRect(0, y, s, 1);
});
TEX.fabricBlue = canvasTex(128, (g, s) => {
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f3ecd8' : '#3d6ea8'; g.fillRect(i * s / 8, 0, s / 8, s); }
});
TEX.plaster = canvasTex(128, (g, s) => { g.fillStyle = '#e8e2d6'; g.fillRect(0, 0, s, s); noiseFill(g, s, 0, 12, R); });
TEX.contact = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 8, 64, 64, 64); grd.addColorStop(0, 'rgba(0,0,0,0.55)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
})();
TEX.glow = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32); grd.addColorStop(0, 'rgba(255,240,200,1)'); grd.addColorStop(0.3, 'rgba(255,200,120,0.45)'); grd.addColorStop(1, 'rgba(255,180,90,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
})();

// ---------- material library ----------
const std = (o, p) => patch(new THREE.MeshStandardMaterial(o), p);
export const M = {
  wood: std({ map: TEX.planks, color: 0xb27a4a, roughness: 0.85, bumpMap: TEX.planks, bumpScale: 0.6 }),
  woodDark: std({ map: TEX.planks, color: 0x7a4f30, roughness: 0.88, bumpMap: TEX.planks, bumpScale: 0.6 }),
  woodLight: std({ map: TEX.planks, color: 0xd9b07a, roughness: 0.8, bumpMap: TEX.planks, bumpScale: 0.5 }),
  woodPaintBlue: std({ map: TEX.planks, color: 0x6f9cc0, roughness: 0.75 }),
  woodPaintGreen: std({ map: TEX.planks, color: 0x6fa077, roughness: 0.75 }),
  woodPaintCream: std({ map: TEX.planks, color: 0xf1e3c4, roughness: 0.75 }),
  woodPaintRed: std({ map: TEX.planks, color: 0xc0574a, roughness: 0.75 }),
  log: std({ map: TEX.logs, color: 0xa66c3e, roughness: 0.9, bumpMap: TEX.logs, bumpScale: 1.2 }),
  logDark: std({ map: TEX.logs, color: 0x7b4c2b, roughness: 0.9, bumpMap: TEX.logs, bumpScale: 1.2 }),
  stone: std({ map: TEX.stone, color: 0xb9b4aa, roughness: 0.95, bumpMap: TEX.stone, bumpScale: 1.5 }),
  stoneDark: std({ map: TEX.stone, color: 0x8a8780, roughness: 0.95, bumpMap: TEX.stone, bumpScale: 1.5 }),
  mossStone: std({ map: TEX.stone, color: 0x9aa58a, roughness: 0.95, bumpMap: TEX.stone, bumpScale: 1.5 }),
  brick: std({ map: TEX.bricks, color: 0xd8c4a8, roughness: 0.9, bumpMap: TEX.bricks, bumpScale: 1 }),
  plaster: std({ map: TEX.plaster, color: 0xf4ecdc, roughness: 0.92 }),
  roofRed: std({ map: TEX.shingles, color: 0xc4573f, roughness: 0.8, bumpMap: TEX.shingles, bumpScale: 1 }),
  roofBlue: std({ map: TEX.shingles, color: 0x4f7aa3, roughness: 0.8, bumpMap: TEX.shingles, bumpScale: 1 }),
  roofGreen: std({ map: TEX.shingles, color: 0x5b8a5e, roughness: 0.8, bumpMap: TEX.shingles, bumpScale: 1 }),
  roofBrown: std({ map: TEX.shingles, color: 0x8a5a3c, roughness: 0.82, bumpMap: TEX.shingles, bumpScale: 1 }),
  roofSlate: std({ map: TEX.shingles, color: 0x5d6470, roughness: 0.7, bumpMap: TEX.shingles, bumpScale: 1 }),
  roofTeal: std({ map: TEX.shingles, color: 0x3f8f8a, roughness: 0.8, bumpMap: TEX.shingles, bumpScale: 1 }),
  roofGold: std({ map: TEX.shingles, color: 0xd3a24a, roughness: 0.6, bumpMap: TEX.shingles, bumpScale: 1 }),
  thatch: std({ map: TEX.bark, color: 0xc9a25e, roughness: 1 }),
  glass: patch(new THREE.MeshStandardMaterial({ color: 0xbfe6f0, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.38, envMapIntensity: 1.6 }), { snow: 0 }),
  metal: std({ color: 0x3b3f45, roughness: 0.35, metalness: 0.85 }),
  brass: std({ color: 0xc9a14a, roughness: 0.3, metalness: 0.9 }),
  copper: std({ color: 0x5fa28d, roughness: 0.5, metalness: 0.6 }),
  fabric: std({ map: TEX.fabric, roughness: 1, side: THREE.DoubleSide }),
  fabricGreen: std({ map: TEX.fabricGreen, roughness: 1, side: THREE.DoubleSide }),
  fabricBlue: std({ map: TEX.fabricBlue, roughness: 1, side: THREE.DoubleSide }),
  canvasTent: std({ color: 0xe8d7b0, roughness: 1, side: THREE.DoubleSide }),
  canvasOrange: std({ color: 0xe08a3c, roughness: 1, side: THREE.DoubleSide }),
  soil: std({ map: TEX.stone, color: 0x6b4a2f, roughness: 1 }),
  hedge: std({ color: 0x4f8a3e, roughness: 0.95 }, { wind: 0.01 }),
  leaf: std({ color: 0x5fa04a, roughness: 0.9 }, { wind: 0.02 }),
  white: std({ color: 0xf5f1e8, roughness: 0.7 }),
  dark: std({ color: 0x2b2622, roughness: 0.8 }),
  red: std({ color: 0xd2483c, roughness: 0.6 }),
  yellow: std({ color: 0xf2c14e, roughness: 0.6 }),
  pink: std({ color: 0xf29bb5, roughness: 0.6 }),
  purple: std({ color: 0x9a7bd1, roughness: 0.6 }),
  blue: std({ color: 0x5b8fd6, roughness: 0.6 }),
  orange: std({ color: 0xf08f3a, roughness: 0.6 }),
  mint: std({ color: 0x9fe0c8, roughness: 0.6 }),
  crystal: new THREE.MeshStandardMaterial({ color: 0x8ff0e0, emissive: 0x3fd6c0, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1 }),
  hotwater: new THREE.MeshStandardMaterial({ color: 0x7fd3d8, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85, envMapIntensity: 1.5 }),
  poolwater: new THREE.MeshStandardMaterial({ color: 0x4fa6c8, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.85, envMapIntensity: 1.5 }),
  // night-reactive emissives (intensity driven by main loop)
  window: new THREE.MeshStandardMaterial({ color: 0x5a6b78, emissive: 0xffb45e, emissiveIntensity: 0, roughness: 0.15, metalness: 0.3 }),
  lamp: new THREE.MeshStandardMaterial({ color: 0xfff1cc, emissive: 0xffc070, emissiveIntensity: 0.2, roughness: 0.4 }),
  bulbs: new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffd27a, emissiveIntensity: 0.2 }),
};
M.nightMats = [M.window, M.lamp, M.bulbs];

export const ghostOK = new THREE.MeshBasicMaterial({ color: 0x6fe39a, transparent: true, opacity: 0.45, depthWrite: false });
export const ghostBad = new THREE.MeshBasicMaterial({ color: 0xff5a4e, transparent: true, opacity: 0.45, depthWrite: false });
