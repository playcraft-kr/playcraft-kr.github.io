// EVERGREEN — boot, render loop, input, time of day, weather, seasons, interaction
import * as THREE from 'three';
import { E, SEASONS, LEVELS } from './ctx.js';
import { M, U, TEX } from './materials.js';
import { buildWorld, world, things, colliders, setTreeVisible, openGate, REGION_NAMES } from './world.js';
import { height, ground, regionAt, REGIONS, WL, riverX, RIVER_Z0, LAKE, nearLake, isRiverZone } from './terrain.js';
import { Player, CameraRig } from './player.js';
import { Effects } from './effects.js';
import { Audio } from './audio.js';
import { Nav } from './visitors.js';
import { CATALOG, CAT_BY_ID, buildModel, setSharedTreeMats } from './buildings.js';
import { ui } from './ui.js';
import * as GM from './game.js';
import { clamp, lerp, smooth, damp, pick } from './util.js';

const $ = id => document.getElementById(id);
const E_dpr = { cap: 1, v: 1, t: 0, f: 0, slow: 0 };
function adaptRes(dt) {
  E_dpr.f++; E_dpr.t += dt; if (E_dpr.t < 1.5) return; const fps = E_dpr.f / E_dpr.t; E_dpr.f = 0; E_dpr.t = 0; if (E.mode === 'title') return;
  let d = E_dpr.v; if (fps < 48) d = Math.max(0.7, d - (fps < 30 ? 0.2 : 0.1)); else if (fps > 58) d = Math.min(E_dpr.cap, d + 0.05);
  if (Math.abs(d - E_dpr.v) > 0.01) { E_dpr.v = d; E.renderer.setPixelRatio(d); E.renderer.setSize(innerWidth, innerHeight); }
  if (fps < 30 && d <= 0.75) E_dpr.slow++; else E_dpr.slow = 0;
  if (E_dpr.slow >= 3 && E.S && (E.S.settings.grass !== 'low' || E.S.settings.shadows === 'high')) { E.S.settings.grass = 'low'; E.S.settings.shadows = 'low'; E.applySettings(); E.ui.toast('Lowered grass and shadow detail for smoother play (change in Menu)'); E_dpr.slow = 0; }
}
const setLoad = p => { $('loadbar').style.width = p + '%'; return new Promise(r => setTimeout(r, 16)); };

async function boot() {
  await setLoad(10);
  const canvas = $('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  E_dpr.cap = Math.min(devicePixelRatio, 1.5); E_dpr.v = E_dpr.cap; renderer.setPixelRatio(E_dpr.v); renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0xc4dcea, 0.0045);
  const cam = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1400);
  Object.assign(E, { renderer, scene, cam, ui, game: GM, audio: new Audio(), thumbs: {}, fallingTrees: [], growingTrees: [], fireworks: [], arrAcc: 0 });

  // lights
  const sun = new THREE.DirectionalLight(0xffffff, 2.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -62; sc.right = 62; sc.top = 62; sc.bottom = -62; sc.near = 1; sc.far = 260; sun.shadow.bias = -0.0012; sun.shadow.normalBias = 0.09;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xbcd4f0, 0x5a5034, 0.9); scene.add(hemi);
  const fill = new THREE.AmbientLight(0xffffff, 0.12); scene.add(fill);
  const plights = []; for (let i = 0; i < 6; i++) { const l = new THREE.PointLight(0xffb060, 0, 16, 1.6); scene.add(l); plights.push(l); }
  E.lights = { sun, hemi, fill, plights };
  await setLoad(20);

  buildWorld(scene, 'med');
  setSharedTreeMats(world.mats);
  await setLoad(70);

  // environment reflections for glass, metal and pools
  const pm = new THREE.PMREMGenerator(renderer); const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.ShaderMaterial({ side: THREE.BackSide, vertexShader: 'varying vec3 v; void main(){ v = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }', fragmentShader: 'varying vec3 v; void main(){ float y = normalize(v).y; gl_FragColor = vec4(mix(vec3(0.35,0.42,0.3), mix(vec3(0.85,0.92,0.98), vec3(0.35,0.6,0.95), max(y,0.)), step(0.,y)), 1.); }' }));
  envScene.add(envSky); const env = pm.fromScene(envScene).texture;
  for (const m of [M.glass, M.metal, M.brass, M.copper, M.hotwater, M.poolwater, M.window]) { m.envMap = env; m.needsUpdate = true; }
  E.envMats = [M.glass, M.metal, M.brass, M.copper, M.hotwater, M.poolwater, M.window];

  E.player = new Player(scene); E.camRig = new CameraRig(cam);
  E.player.canEnter = (x, z) => !E.S || E.S.unlocked[regionAt(x, z)] || blockedToast(x, z);
  E.camRig.blockers = (p) => { const out = []; for (const b of E.buildings) if (b.box && Math.abs(b.rec.x - p.x) < 30 && Math.abs(b.rec.z - p.z) < 30) out.push(b.box); return out; };
  E.fx = new Effects(scene); E.nav = new Nav();
  E.litterGeo = new THREE.IcosahedronGeometry(0.13, 0); E.litterMat = [new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0xd2483c, roughness: 0.5 }), new THREE.MeshStandardMaterial({ color: 0x5b8fd6, roughness: 0.5 })];
  // night halos for lamps
  E.halos = []; for (let i = 0; i < 40; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xffc070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); s.scale.set(2.2, 2.2, 1); scene.add(s); E.halos.push(s); }
  // fishing bobber
  E.bobber = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd2483c })); E.bobber.visible = false; scene.add(E.bobber);
  E.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.7 })); E.line.visible = false; E.line.frustumCulled = false; scene.add(E.line);

  E.player.onStep = (surf, sp) => { const snow = U.uSnow.value > 0.5 && surf === 'grass'; E.audio.step(snow ? 'snow' : surf); };
  E.player.onLand = g => E.audio.step(g.kind || 'grass');

  GM.newGame(); // initial world state behind the title screen
  ui.keys();
  await setLoad(90);
  await GM.initCloud();
  setupInput();
  $('loading').classList.add('hidden');
  E.mode = 'title'; $('title').classList.remove('hidden'); $('bcont').disabled = !GM.hasSave();
  $('bnew').onclick = () => startGame(false); $('bcont').onclick = () => startGame(true);
  window.addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); });
  // keep the village safe: a quiet save every 30 s while playing, and right away when the page is hidden or closed
  const playing = () => (E.mode === 'play' || E.mode === 'build') && E.S;
  setInterval(() => { if (playing() && !document.hidden) GM.saveGame(true); }, 30000);
  let savedNowAt = 0;
  const saveNow = () => { if (playing() && Date.now() - savedNowAt > 1500) { savedNowAt = Date.now(); GM.saveGame(true); GM.flushCloud(); } };
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
  window.addEventListener('pagehide', saveNow);
  E.applySettings();
  loop();
  setTimeout(makeThumbs, 400);
}

let lastBlock = 0;
function blockedToast(x, z) {
  const t = performance.now(); if (t - lastBlock > 3500) { lastBlock = t; const r = regionAt(x, z); ui.toast(`The way into ${REGIONS[r].name} is overgrown — open its trail at the gate`, 'warn'); }
  return false;
}
function startGame(cont) {
  E.audio.start();
  if (cont) { const s = GM.readSave(); if (!s || !GM.loadGame(s)) GM.newGame(); } else GM.newGame();
  $('title').classList.add('hidden'); $('hud').classList.remove('hidden');
  E.mode = 'play'; E.applySettings(); E.lastRegion = regionAt(E.player.pos.x, E.player.pos.z);
  ui.res(); ui.objective(); ui.regionBanner(E.lastRegion);
  if (!cont) { setTimeout(() => ui.toast('Welcome to Evergreen. This little cabin is yours.'), 600); setTimeout(() => ui.toast('Chop trees and break rocks with E — then press B to build.'), 4200); }
  lockPointer();
}
function lockPointer() { const c = $('gl'); try { const p = c.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { } }
E.resume = () => { if (E.mode === 'play') lockPointer(); };
E.applySettings = () => {
  const s = E.S.settings, L = E.lights;
  L.sun.castShadow = s.shadows !== 'off';
  const ms = s.shadows === 'high' ? 2048 : 1024; if (L.sun.shadow.mapSize.x !== ms) { L.sun.shadow.mapSize.set(ms, ms); L.sun.shadow.map?.dispose(); L.sun.shadow.map = null; }
  world.grass.geometry.instanceCount = { low: 14000, med: 32000, high: 52000 }[s.grass] || 32000;
  E.audio.vol = { music: s.music, sfx: s.sfx, amb: s.amb }; E.audio.applyVol();
};

// ---------- thumbnails for the build menu ----------
function makeThumbs() {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setSize(192, 144); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15;
  const s = new THREE.Scene(); s.add(new THREE.HemisphereLight(0xdbe8f5, 0x6a5a40, 1.3)); const d = new THREE.DirectionalLight(0xfff2dc, 2.6); d.position.set(5, 9, 7); s.add(d);
  const cam = new THREE.PerspectiveCamera(30, 4 / 3, 0.1, 300);
  const list = CATALOG.filter(c => !c.hidden); let i = 0;
  const step = () => {
    for (let k = 0; k < 3 && i < list.length; k++, i++) {
      const def = list[i]; const m = buildModel(def, 1); s.add(m);
      const bb = new THREE.Box3().setFromObject(m), c = bb.getCenter(new THREE.Vector3()), size = bb.getSize(new THREE.Vector3()).length();
      cam.position.copy(c).add(new THREE.Vector3(0.9, 0.65, 1.25).normalize().multiplyScalar(size * 1.55)); cam.lookAt(c);
      r.render(s, cam); E.thumbs[def.id] = r.domElement.toDataURL('image/png'); s.remove(m);
    }
    if (i < list.length) setTimeout(step, 30); else { r.dispose(); r.forceContextLoss(); if (E.mode === 'build') ui.buildBar(); }
  };
  step();
}

// ---------- input ----------
const input = { f: 0, b: 0, l: 0, r: 0, sprint: 0, jump: false };
const mouse = new THREE.Vector2(); let rmb = false, lmbDrag = false;
function setupInput() {
  const c = $('gl');
  addEventListener('keydown', e => {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
    const k = e.code;
    if (E.mode === 'title') return;
    if (k === 'Escape') { e.preventDefault(); if (E.panel) { if (E.panel !== 'levelup') { ui.close(); E.resume(); } return; } if (E.mode === 'build') { if (GM.build.def) { GM.build.moving = null; GM.selectDef(null); ui.buildBar(); } else exitBuild(); return; } openPause(); return; }
    if (E.panel) { const map = { KeyM: 'map', KeyJ: 'journal', KeyI: 'bag', KeyV: 'village' }; if (map[k] === E.panel) { ui.close(); E.resume(); } return; }
    if (k === 'KeyW' || k === 'ArrowUp') input.f = 1; if (k === 'KeyS' || k === 'ArrowDown') input.b = 1; if (k === 'KeyA' || k === 'ArrowLeft') input.l = 1; if (k === 'KeyD' || k === 'ArrowRight') input.r = 1;
    if (k === 'ShiftLeft' || k === 'ShiftRight') input.sprint = 1;
    if (k === 'Space') { e.preventDefault(); if (!e.repeat) input.jump = true; }
    if (k === 'KeyE' && !e.repeat) interact();
    if (k === 'KeyB' && !e.repeat) { E.mode === 'build' ? exitBuild() : enterBuild(); }
    if ((k === 'KeyR' || k === 'KeyQ') && E.mode === 'build' && GM.build.def) { const d = GM.build.def, st = (d.rot || 45) * Math.PI / 180; GM.build.rot += k === 'KeyR' ? -st : st; E.audio.click(); }
    if (k === 'KeyM') ui.open('map'); if (k === 'KeyJ') ui.open('journal'); if (k === 'KeyI') ui.open('bag'); if (k === 'KeyV') ui.open('village');
  });
  addEventListener('keyup', e => { const k = e.code; if (k === 'KeyW' || k === 'ArrowUp') input.f = 0; if (k === 'KeyS' || k === 'ArrowDown') input.b = 0; if (k === 'KeyA' || k === 'ArrowLeft') input.l = 0; if (k === 'KeyD' || k === 'ArrowRight') input.r = 0; if (k === 'ShiftLeft' || k === 'ShiftRight') input.sprint = 0; });
  addEventListener('blur', () => { input.f = input.b = input.l = input.r = input.sprint = 0; });
  const look = (dx, dy) => { const s = E.S.settings.sens; E.camRig.yaw -= dx * 0.0026 * s; E.camRig.pitch = clamp(E.camRig.pitch + dy * 0.0022 * s * (E.S.settings.invert ? -1 : 1), -0.3, E.mode === 'build' ? 1.42 : 1.25); };
  addEventListener('mousemove', e => {
    mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    if (document.pointerLockElement === c) look(e.movementX, e.movementY);
    else if (rmb || lmbDrag) look(e.movementX, e.movementY);
  });
  c.addEventListener('mousedown', e => {
    if (E.mode === 'title' || E.panel) return;
    if (e.button === 2) { rmb = true; return; }
    if (e.button !== 0) return;
    if (E.mode === 'build') { buildClick(); return; }
    if (document.pointerLockElement !== c) { lockPointer(); lmbDrag = true; }
  });
  addEventListener('mouseup', e => { if (e.button === 2) rmb = false; if (e.button === 0) lmbDrag = false; });
  c.addEventListener('contextmenu', e => e.preventDefault());
  c.addEventListener('wheel', e => { e.preventDefault(); E.camRig.dist = clamp(E.camRig.dist * (1 + Math.sign(e.deltaY) * 0.1), 2.6, E.mode === 'build' ? 42 : 16); }, { passive: false });
  document.addEventListener('pointerlockchange', () => { const locked = document.pointerLockElement === c; $('cross').classList.toggle('hidden', !locked); if (!locked && E.mode === 'play' && !E.panel) openPause(); });
  // build bar
  $('build').addEventListener('click', e => {
    const tab = e.target.closest('[data-cat]'), tool = e.target.closest('[data-tool]'), card = e.target.closest('.card[data-id]');
    if (tab) { ui.buildCat = tab.dataset.cat; ui.buildBar(); E.audio.click(); }
    if (tool) { GM.build.tool = tool.dataset.tool; GM.build.moving = null; GM.selectDef(null); ui.buildBar(); E.audio.click(); }
    if (card) { const def = CAT_BY_ID[card.dataset.id]; if ((def.lvl || 1) > E.S.level) { E.audio.error(); ui.toast(`Reach ${LEVELS[def.lvl - 1].name} to build the ${def.name}`, 'warn'); return; } GM.build.tool = 'build'; GM.build.moving = null; GM.build.rot = GM.build.def === def ? GM.build.rot : (E.camRig.yaw); GM.build.rot = Math.round(GM.build.rot / (Math.PI / 4)) * Math.PI / 4; GM.selectDef(def); ui.buildBar(); E.audio.click(); }
  });
  $('build').addEventListener('wheel', e => { const cards = $('cards'); if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { cards.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
}
function openPause() { if (E.mode === 'title') return; ui.open('pause'); }
E.enterBuild = enterBuild;
function enterBuild() {
  if (E.mode !== 'play' && E.mode !== 'build') return;
  E.mode = 'build'; document.exitPointerLock?.(); $('build').classList.remove('hidden'); $('keys').classList.add('hidden'); ui.prompt(null);
  E.camRig.dist = Math.max(E.camRig.dist, 14); E.camRig.pitch = Math.max(E.camRig.pitch, 0.6);
  GM.build.tool = 'build'; ui.buildBar();
}
function exitBuild() { GM.build.moving = null; GM.selectDef(null); E.mode = 'play'; $('build').classList.add('hidden'); $('keys').classList.remove('hidden'); E.camRig.dist = Math.min(E.camRig.dist, 9); E.camRig.pitch = Math.min(E.camRig.pitch, 0.5); lockPointer(); }
const ray = new THREE.Raycaster();
function groundHit() {
  ray.setFromCamera(mouse, E.cam); const o = ray.ray.origin, d = ray.ray.direction; let t = 0, prev = 0;
  for (let i = 0; i < 400; i++) { prev = t; t += 0.5 + t * 0.01; const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t; if (y < Math.max(height(x, z), WL)) { let a = prev, b = t; for (let k = 0; k < 8; k++) { const m = (a + b) / 2; const yy = o.y + d.y * m, xx = o.x + d.x * m, zz = o.z + d.z * m; if (yy < Math.max(height(xx, zz), WL)) b = m; else a = m; } return new THREE.Vector3(o.x + d.x * b, 0, o.z + d.z * b); } if (t > 200) break; }
  return null;
}
function pickBuilding() { ray.setFromCamera(mouse, E.cam); const hits = ray.intersectObjects(E.buildings.map(b => b.group), true); for (const h of hits) { let o = h.object; while (o && !o.userData.building) o = o.parent; if (o) return o.userData.building; } return null; }
function buildClick() {
  const B = GM.build;
  if (B.def) { GM.confirmPlace(); return; }
  const b = pickBuilding(); if (!b) return;
  if (B.tool === 'move') { if (b.def.type === 'home') { ui.toast('Your cabin stays where it is', 'warn'); return; } B.moving = b; B.rot = b.rec.rot; GM.selectDef(b.def); ui.buildBar(); }
  else if (B.tool === 'upgrade' || B.tool === 'demolish') ui.open('building', b);
  else ui.open('building', b);
}

// ---------- interaction ----------
let act = null; // {kind, t, dur, target}
let fishing = null;
function findInteract() {
  const p = E.player.pos, fx = Math.sin(E.player.yaw), fz = Math.cos(E.player.yaw), S = E.S;
  const near = things.query(p.x, p.z, 6);
  let best = null, bs = 1e9;
  const consider = (o, d, text, fn, pri) => { const dx = o.x - p.x, dz = o.z - p.z, facing = (dx * fx + dz * fz) / Math.max(0.01, Math.hypot(dx, dz)); const s = d - facing * 0.6 + pri; if (s < bs) { bs = s; best = { text, fn, o }; } };
  for (const o of near) {
    const d = Math.hypot(o.x - p.x, o.z - p.z);
    if (o.type === 'discovery' && !o.found && d < (o.kind === 'view' ? 2.2 : 2.6)) consider(o, d, o.kind === 'view' ? 'Take in the view' : o.kind === 'chest' ? 'Open the chest' : o.kind === 'journal' ? 'Read the journal' : o.kind === 'relic' ? 'Examine the relic' : o.kind === 'rare' ? 'Gather seeds' : 'Pick it up', () => collectDiscovery(o), -5);
    else if (o.type === 'gate' && !o.open && d < 5) consider(o, d, `Open the trail to ${REGION_NAMES[o.region]}`, () => ui.open('gate', o), -3);
    else if (o.type === 'tree' && o.alive && d < 1.1 + o.s * 0.9) consider(o, d, 'Chop tree', () => startAct('chop', o), 0);
    else if (o.type === 'rock' && o.alive && d < 1.0 + o.s) consider(o, d, 'Break rock', () => startAct('mine', o), 0);
    else if (o.type === 'clump' && o.alive && d < 1.8) consider(o, d, 'Pick wildflowers', () => startAct('gather', o), 0);
  }
  for (const l of E.litter) { const d = Math.hypot(l.x - p.x, l.z - p.z); if (d < 1.8) consider(l, d, 'Pick up litter', () => pickLitter(l), -2); }
  for (const b of E.buildings) {
    if (b.def.type === 'path' || b.def.type === 'decor' && !b.seat) continue;
    const [ex, ez] = b.entrance, d = Math.hypot(ex - p.x, ez - p.z);
    if (b.seat && Math.hypot(b.rec.x - p.x, b.rec.z - p.z) < 1.6) consider({ x: b.rec.x, z: b.rec.z }, 1, 'Sit on the bench', () => sit(b.seat), -1);
    else if (b.fishSpot && Math.hypot(b.fishSpot[0] - p.x, b.fishSpot[1] - p.z) < 2.4) consider({ x: b.fishSpot[0], z: b.fishSpot[1] }, 1, 'Fish from the dock', () => startFishing(true), -1.5);
    else if (d < 2.6 && b.def.type !== 'decor') consider({ x: ex, z: ez }, d, b.def.type === 'home' ? 'Enter your cabin' : `Visit ${b.def.name}`, () => ui.open('building', b), -1);
  }
  for (const s of world.benchSeats) { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < 1.4) consider(s, d, 'Sit by the campfire', () => sit(s), -0.5); }
  if (!best) { const wx = p.x + fx * 2.6, wz = p.z + fz * 2.6, g = ground(wx, wz); if (g.water && g.depth > 0.35 && S.unlocked[regionAt(wx, wz)]) best = { text: 'Cast your line', fn: () => startFishing(false) }; }
  return best;
}
function interact() {
  if (E.mode !== 'play' || E.panel) return;
  if (fishing) { if (fishing.phase === 'bite') catchFish(); else { endFishing('You reel in your line.'); } return; }
  if (E.player.st.action === 'sit') { E.player.st.action = null; return; }
  if (act) return;
  const it = findInteract(); if (it) it.fn();
}
function startAct(kind, o) { act = { kind, o, t: 0, dur: kind === 'gather' ? 1.0 : 1.35, hits: 0 }; E.player.st.action = kind; E.player.st.actionT = 0; E.player.frozen = true; E.player.yaw = Math.atan2(o.x - E.player.pos.x, o.z - E.player.pos.z); }
function updateAct(dt) {
  if (!act) return; act.t += dt;
  const swing = act.kind === 'gather' ? 99 : Math.floor(act.t * 2.4 + 0.4);
  if (swing > act.hits && act.kind !== 'gather') { act.hits = swing; act.kind === 'chop' ? E.audio.chop() : E.audio.clink(); E.fx.burst(act.o.x, (act.o.y || 0) + 1, act.o.z, 2); }
  if (act.t >= act.dur) {
    const o = act.o, S = E.S; E.player.st.action = null; E.player.frozen = false;
    if (act.kind === 'chop') { GM.chopTree(o); o.fallDir = E.player.yaw; S.stats.trees++; const n = o.kind === 'oak' ? 4 : 3; GM.give('wood', n, o.x, o.z); S.today.gathered += n; }
    if (act.kind === 'mine') { GM.hideThing(o, GM.gameHours() + 72); S.stats.rocks++; const n = 2 + (o.s > 1.2 ? 1 : 0); GM.give('stone', n, o.x, o.z); S.today.gathered += n; E.fx.burst(o.x, o.y + 0.5, o.z, 6); }
    if (act.kind === 'gather') { GM.hideThing(o, GM.gameHours() + 30); S.stats.clumps++; const n = regionAt(o.x, o.z) === 3 ? 3 : 2; GM.give('flowers', n, o.x, o.z); S.today.gathered += n; E.audio.pickup(); }
    act = null; GM.checkProgress();
  }
}
function pickLitter(l) { E.scene.remove(l.mesh); E.litter.splice(E.litter.indexOf(l), 1); E.S.stats.litter++; E.S.today.litter++; GM.give('rep', 1, l.x, l.z); E.audio.pickup(); GM.checkProgress(); }
function sit(s) { const p = E.player; p.pos.x = s.x; p.pos.z = s.z; p.yaw = s.ry; p.st.action = 'sit'; p.st.actionT = 0; }
function collectDiscovery(d) {
  const S = E.S; d.found = true; S.found.push(d.id); d.group.visible = false; E.audio.discover();
  const r = d.reward; GM.grant(r, d.x, d.z); if (r.unlock && !S.unlocks.includes(r.unlock)) S.unlocks.push(r.unlock);
  E.player.st.action = d.kind === 'view' ? 'photo' : 'gather'; E.player.st.actionT = 0; setTimeout(() => { if (E.player.st.action !== 'sit') E.player.st.action = null; }, 1200);
  ui.open('discovery', d); GM.checkProgress();
}
function startFishing(dock) {
  const p = E.player, S = E.S; const tx = p.pos.x + Math.sin(p.yaw) * (dock ? 3.5 : 3), tz = p.pos.z + Math.cos(p.yaw) * (dock ? 3.5 : 3);
  if (!ground(tx, tz).water) { ui.toast('Face the open water to cast', 'warn'); return; }
  fishing = { phase: 'wait', t: 2 + Math.random() * 4 / (dock ? 1.5 : 1), x: tx, z: tz, dock, lake: nearLake(tx, tz), river: isRiverZone(tx, tz) };
  p.st.action = 'fish'; p.st.actionT = 0; p.frozen = true; E.audio.splash(); E.bobber.visible = E.line.visible = true;
}
function catchFish() {
  const S = E.S, f = GM.rollFish(fishing.lake, fishing.river), gold = S.unlocks.includes('goldrod');
  const val = Math.round(f.v * (gold ? 2 : 1) * (fishing.dock ? 1.2 : 1));
  S.fish[f.n] = (S.fish[f.n] || 0) + 1; S.stats.fish++; GM.earn(val, null, fishing.x, fishing.z);
  E.audio.splash(); E.audio.fanfare(); ui.toast(`You caught a ${f.n}! Sold for ${val} coins`, f.v >= 40 ? 'gold' : '');
  endFishing(); GM.checkProgress();
}
function endFishing(msg) { if (msg) ui.toast(msg); fishing = null; E.player.st.action = null; E.player.frozen = false; E.bobber.visible = E.line.visible = false; $('fishbar').classList.add('hidden'); }
function updateFishing(dt) {
  if (!fishing) return; const p = E.player;
  if (input.f || input.b || input.l || input.r) { endFishing(); return; }
  fishing.t -= dt; const t = performance.now() / 1000;
  const by = WL + (fishing.phase === 'bite' ? -0.06 + Math.sin(t * 30) * 0.05 : Math.sin(t * 2) * 0.03);
  E.bobber.position.set(fishing.x, by, fishing.z);
  const tip = new THREE.Vector3(); E.player.rig.rod.getWorldPosition(tip); tip.addScaledVector(new THREE.Vector3(Math.sin(p.yaw), 0.8, Math.cos(p.yaw)).normalize(), 1.05);
  const pos = E.line.geometry.attributes.position; pos.setXYZ(0, tip.x, tip.y, tip.z); pos.setXYZ(1, fishing.x, by, fishing.z); pos.needsUpdate = true;
  if (fishing.phase === 'wait' && fishing.t <= 0) { fishing.phase = 'bite'; fishing.t = 1.1; $('fishbar').classList.remove('hidden'); $('fishbar').textContent = 'E — now!'; E.audio.bite(); }
  else if (fishing.phase === 'bite' && fishing.t <= 0) { $('fishbar').classList.add('hidden'); fishing.phase = 'wait'; fishing.t = 2 + Math.random() * 4; ui.toast('It got away… keep waiting'); }
}
E.unlockRegion = gate => {
  const R = REGIONS[gate.region], q = R.req, S = E.S; const cost = {}; if (q.coins) cost.c = q.coins; if (q.wood) cost.w = q.wood; if (q.stone) cost.s = q.stone; if (q.flowers) cost.f = q.flowers;
  if (S.level < q.level || !GM.canAfford(cost)) { E.audio.error(); return; }
  GM.pay(cost); S.unlocked[gate.region] = true; openGate(gate); E.audio.fanfare(); E.audio.demolish();
  ui.close(); ui.toast(`${R.name} is open! Explore and build there.`, 'gold'); GM.checkProgress(); E.resume();
};
E.sleep = () => {
  const f = $('fade'); f.style.opacity = 1; E.sleeping = true;
  setTimeout(() => {
    const S = E.S, target = S.hour >= 18 || S.hour < 6 ? (S.hour >= 18 ? 24 - S.hour + 7 : 7 - S.hour) : 18 - S.hour;
    advanceHours(target);
    for (const v of E.visitors) if (v.state === 'inside' && v.lodging) v.timer = Math.min(v.timer, 0.5 + Math.random() * 3); else if (v.state !== 'inside') v.alive = false;
    f.style.opacity = 0; E.sleeping = false; ui.toast(S.hour < 12 ? `Good morning! Day ${S.day} · ${SEASONS[S.season]}` : 'You feel rested.'); E.resume();
  }, 900);
};

// ---------- time, economy ticks ----------
let lastHour = -1;
function hourly() {
  const S = E.S, h = Math.floor(S.hour);
  const upkeep = E.buildings.reduce((a, b) => a + (b.def.upkeep || 0), 0) / 24; S.coins -= upkeep; S.today.expenses += upkeep;
  for (const b of E.buildings) if (b.def.produce) { b.prod = (b.prod || 0) + b.def.produce.f * (b.rec.lvl > 1 ? 1.5 : 1) / 3; if (b.prod >= 1) { const n = Math.floor(b.prod); b.prod -= n; GM.give('flowers', n, b.rec.x, b.rec.z, E.player.pos.distanceTo(new THREE.Vector3(b.rec.x, E.player.pos.y, b.rec.z)) > 20); } }
  GM.tickRegrowth();
  S.weatherT--; if (S.weatherT <= 0) rollWeather();
  // seasonal festival on the second day of each season, evening
  const sd = (S.day - 1) % S.settings.seasonLen, key = `${S.day}`;
  const stage = E.buildings.some(b => b.def.id === 'stage');
  const fname = ['Blossom Festival', 'Lake Lantern Night', 'Harvest Fair', 'Winter Lights'][S.season];
  if (sd === 1 && h === 15) ui.toast(stage ? `Tonight: the ${fname}! Expect crowds after 5 pm.` : `The ${fname} is tonight — build a Festival Stage to host it.`, 'gold');
  const fest = stage && sd === 1 && h >= 17 && h <= 23;
  if (fest && !S.festival) { S.festival = true; S.stats.festivals++; if (!S.festivalDone[key]) { S.festivalDone[key] = 1; GM.give('rep', E.buildings.some(b => b.def.id === 'hall') ? 40 : 20, undefined, undefined, true); } ui.toast(`The ${fname} has begun!`, 'gold'); }
  if (!fest) S.festival = false;
  if (h === 2 && E.mode === 'play' && !E.sleeping) S.stats.owl = true;
  if (h === 6) GM.saveGame(true);
  GM.checkProgress(); ui.res();
}
function rollWeather() {
  const S = E.S;
  const T = [[['sunny', 45], ['cloudy', 25], ['rainy', 20], ['foggy', 10]], [['sunny', 65], ['cloudy', 18], ['rainy', 14], ['foggy', 3]], [['sunny', 30], ['cloudy', 30], ['rainy', 25], ['foggy', 15]], [['sunny', 25], ['cloudy', 28], ['snowy', 37], ['foggy', 10]]][S.season];
  let r = Math.random() * 100; for (const [w, p] of T) { r -= p; if (r <= 0) { S.weather = w; break; } }
  S.weatherT = 5 + Math.floor(Math.random() * 7);
}
function newDayRollover() {
  const S = E.S, T = S.today;
  const avg = T.sat.length ? T.sat.reduce((a, b) => a + b, 0) / T.sat.length : null;
  S.ledger.push({ day: S.day, income: Math.round(T.income), expenses: Math.round(T.expenses), visitors: T.arrivals, sat: avg }); if (S.ledger.length > 30) S.ledger.shift();
  ui.toast(`Day ${S.day} done · earned ${Math.round(T.income)}, upkeep ${Math.round(T.expenses)}, ${T.arrivals} visitors`);
  S.day++; S.today = GM.newDay(); for (const b of E.buildings) { b.incomeToday = 0; b.usesToday = 0; }
  if ((S.day - 1) % S.settings.seasonLen === 0) { S.season = (S.season + 1) % 4; if (!S.seasonsSeen.includes(S.season)) S.seasonsSeen.push(S.season); GM.newSeasonal(); rollWeather(); ui.toast(`${SEASONS[S.season]} has arrived in Evergreen`, 'gold'); if (E.mode === 'build') ui.buildBar(); }
  GM.newDaily(); GM.saveGame(true); ui.objective();
}
function advanceHours(n) { const S = E.S; for (let i = 0; i < n; i++) { S.hour += 1; if (S.hour >= 24) { S.hour -= 24; newDayRollover(); } hourly(); } lastHour = Math.floor(GM.gameHours()); }

// ---------- sky & lighting keyframes ----------
const K = [
  { h: 0, sun: 0x8fa4d8, si: 0.35, sky: 0x0a1430, hor: 0x1b2a4a, fog: 0x18243a, hs: 0x4a5a88, hg: 0x1a1f1a, hi: 0.35 },
  { h: 5, sun: 0x8fa4d8, si: 0.3, sky: 0x101c3e, hor: 0x2a3456, fog: 0x232c46, hs: 0x4a5a88, hg: 0x1a1f1a, hi: 0.35 },
  { h: 6.2, sun: 0xff9a5a, si: 0.9, sky: 0x4f6fae, hor: 0xf2a77a, fog: 0xd6a68a, hs: 0x9aa8d0, hg: 0x5a4a38, hi: 0.6 },
  { h: 7.6, sun: 0xffd9a8, si: 2.3, sky: 0x5c9ce0, hor: 0xd8e6ee, fog: 0xc8dae2, hs: 0xbfd2ec, hg: 0x6a5a40, hi: 0.85 },
  { h: 12, sun: 0xfff4e4, si: 2.9, sky: 0x4a90e2, hor: 0xd2e6f4, fog: 0xc6dcea, hs: 0xc4d8f0, hg: 0x6a5c40, hi: 0.95 },
  { h: 16.4, sun: 0xffe2b8, si: 2.6, sky: 0x5592da, hor: 0xe6e2d8, fog: 0xd6d8d6, hs: 0xc4d0e4, hg: 0x6a5a3c, hi: 0.9 },
  { h: 18.2, sun: 0xffa055, si: 1.8, sky: 0x4f6ab4, hor: 0xf2ab7c, fog: 0xd2aa94, hs: 0xb09ab8, hg: 0x5a4434, hi: 0.7 },
  { h: 19.5, sun: 0xd0607a, si: 0.45, sky: 0x26326a, hor: 0x8a5a7a, fog: 0x564a6a, hs: 0x6a6a98, hg: 0x2a2424, hi: 0.45 },
  { h: 21, sun: 0x8fa4d8, si: 0.35, sky: 0x0a1430, hor: 0x1b2a4a, fog: 0x18243a, hs: 0x4a5a88, hg: 0x1a1f1a, hi: 0.35 },
  { h: 24, sun: 0x8fa4d8, si: 0.35, sky: 0x0a1430, hor: 0x1b2a4a, fog: 0x18243a, hs: 0x4a5a88, hg: 0x1a1f1a, hi: 0.35 },
];
const c1 = new THREE.Color(), c2 = new THREE.Color(), tmp = {};
function keyAt(h) {
  let i = 0; while (i < K.length - 2 && K[i + 1].h <= h) i++; const a = K[i], b = K[i + 1], t = smooth(0, 1, (h - a.h) / (b.h - a.h));
  for (const k of ['sun', 'sky', 'hor', 'fog', 'hs', 'hg']) { tmp[k] = (tmp[k] || new THREE.Color()).set(a[k]).lerp(c2.set(b[k]), t); }
  tmp.si = lerp(a.si, b.si, t); tmp.hi = lerp(a.hi, b.hi, t); return tmp;
}
const W = { rain: 0, snow: 0, cloud: 0, fog: 0 };
const grey = new THREE.Color(0x9aa3ab), sunDir = new THREE.Vector3();
function updateEnvironment(dt) {
  const S = E.S, h = S.hour;
  const want = { rain: S.weather === 'rainy' ? 1 : 0, snow: S.weather === 'snowy' ? 1 : 0, cloud: { cloudy: 0.75, rainy: 1, snowy: 0.85, foggy: 0.6, sunny: 0 }[S.weather], fog: S.weather === 'foggy' ? 1 : 0 };
  for (const k in W) W[k] = damp(W[k], want[k], 0.35, dt);
  const k = keyAt(h);
  const night = Math.max(1 - smooth(5.6, 7.2, h), smooth(18.6, 20.6, h)), day = 1 - night;
  E.night = night; E.day = day;
  // sun / moon direction
  const isDay = h >= 6 && h < 18.8, ang = isDay ? (h - 6) / 12.8 * Math.PI : (((h + 24 - 18.8) % 24) / 11.2) * Math.PI;
  sunDir.set(Math.cos(ang) * 0.75, Math.max(0.12, Math.sin(ang)), 0.5).normalize();
  const L = E.lights, p = E.player.pos;
  L.sun.color.copy(k.sun); L.sun.intensity = k.si * (1 - W.cloud * 0.6) * (1 - W.fog * 0.3);
  const snap = 1; L.sun.target.position.set(Math.round(p.x / snap) * snap, p.y, Math.round(p.z / snap) * snap); L.sun.position.copy(L.sun.target.position).addScaledVector(sunDir, 110);
  L.hemi.color.copy(k.hs).lerp(grey, W.cloud * 0.4); L.hemi.groundColor.copy(k.hg); L.hemi.intensity = k.hi * (1 + W.cloud * 0.15);
  // fog
  const fogC = c1.copy(k.fog).lerp(grey.clone().multiplyScalar(0.4 + day * 0.6), W.cloud * 0.45 + W.fog * 0.3);
  if (W.snow > 0.1) fogC.lerp(new THREE.Color(0xdde4ec).multiplyScalar(0.3 + day * 0.7), W.snow * 0.4);
  E.scene.fog.color.copy(fogC); E.scene.fog.density = 0.0042 + W.fog * 0.02 + W.rain * 0.006 + W.snow * 0.008;
  // sky
  const su = world.sky.material.uniforms; su.uTop.value.copy(k.sky).lerp(grey.clone().multiplyScalar(0.3 + day * 0.7), W.cloud * 0.55); su.uHorizon.value.copy(k.hor).lerp(fogC, W.cloud * 0.6 + W.fog * 0.6); su.uBottom.value.copy(fogC); su.uSunDir.value.copy(isDay ? sunDir : sunDir.clone().negate()); su.uSunCol.value.copy(k.sun); su.uNight.value = night; su.uCloud.value = Math.max(W.cloud, W.fog);
  world.sky.position.copy(E.cam.position);
  world.cloudMat.color.copy(c2.set(0xffffff).lerp(new THREE.Color(0x8a929c), W.cloud * 0.6)).multiplyScalar(0.35 + day * 0.65 + (h > 17 && h < 20 ? 0.1 : 0)); world.cloudMat.emissive.copy(k.hor).multiplyScalar(0.25);
  world.cloudMat.opacity = 0.7 + W.cloud * 0.3;
  for (const c of world.clouds.children) { c.position.x += c.userData.v * dt * (1.5 + W.rain * 3); if (c.position.x > 450) c.position.x = -450; c.visible = c.id % 3 !== 0 || W.cloud > 0.3; }
  // grass & water
  const gu = world.grass.material.uniforms; gu.uCenter.value.set(p.x, p.z); gu.uPlayer.value.copy(p); gu.uSunDir.value.copy(sunDir); gu.uSunCol.value.copy(L.sun.color).multiplyScalar(L.sun.intensity * 0.42); gu.uAmb.value.copy(L.hemi.color).multiplyScalar(L.hemi.intensity * 0.85); gu.uFogCol.value.copy(fogC); gu.uFogDen.value = E.scene.fog.density;
  const wu = world.water.material.uniforms; wu.uSunDir.value.copy(sunDir); wu.uSunCol.value.copy(L.sun.color).multiplyScalar(L.sun.intensity * 0.5); wu.uSky.value.copy(su.uTop.value); wu.uHorizon.value.copy(su.uHorizon.value); wu.uFogCol.value.copy(fogC); wu.uFogDen.value = E.scene.fog.density; wu.uRain.value = W.rain; wu.uNight.value = night;
  world.waterfall.material.uniforms.uNight.value = night;
  // seasons
  const sea = S.season;
  U.uAutumn.value = damp(U.uAutumn.value, sea === 2 ? 1 : 0, 0.4, dt);
  U.uSpring.value = damp(U.uSpring.value, sea === 0 ? 1 : 0, 0.4, dt);
  U.uBloom.value = damp(U.uBloom.value, [1.15, 1, 0.55, 0.001][sea], 0.4, dt);
  U.uSnow.value = damp(U.uSnow.value, sea === 3 ? 0.55 + W.snow * 0.45 : W.snow * 0.3, W.snow > 0.5 ? 0.15 : 0.3, dt);
  U.uWind.value = 0.8 + W.rain * 0.8 + W.cloud * 0.4 + (regionAt(p.x, p.z) === 2 ? 0.4 : 0);
  U.uWet.value = damp(U.uWet.value, W.rain, 0.3, dt);
  // night lights
  M.window.emissiveIntensity = night * 1.6 + (h > 17 ? 0.15 : 0); M.lamp.emissiveIntensity = 0.15 + night * 3.0; M.bulbs.emissiveIntensity = 0.2 + night * 3 + (S.festival ? 1.5 : 0) + (sea === 3 ? night : 0);
  for (const m of E.envMats) m.envMapIntensity = 0.25 + day * 1.1;
  L.fill.intensity = 0.1 + night * 0.12;
  // nearest light sources → real point lights + halos
  const src = [{ x: world.firePos.x, y: world.firePos.y, z: world.firePos.z, fire: true }];
  for (const b of E.buildings) for (const l of b.lights) src.push(l);
  src.sort((a, b) => ((a.x - p.x) ** 2 + (a.z - p.z) ** 2) - ((b.x - p.x) ** 2 + (b.z - p.z) ** 2));
  const flick = 0.85 + Math.sin(U.uTime.value * 13) * 0.08 + Math.sin(U.uTime.value * 7.3) * 0.07;
  L.plights.forEach((l, i) => { const s = src[i]; if (s && night > 0.05) { l.position.set(s.x, s.y + 0.2, s.z); l.intensity = night * (s.fire ? 14 * flick : 9); l.color.set(s.fire ? 0xff8a3a : 0xffb867); } else l.intensity = s && s.fire ? 2 * flick : 0; });
  E.halos.forEach((hl, i) => { const s = src[i]; if (s && night > 0.05) { hl.visible = true; hl.position.set(s.x, s.y + (s.fire ? 0.1 : 0), s.z); hl.material.opacity = night * 0.75; } else hl.visible = false; });
  return { sunDir, W, night, day };
}

// ---------- per-frame world animation ----------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _ax = new THREE.Vector3();
function animateWorld(dt, t) {
  world.windmill.rotation.z += dt * (0.4 + U.uWind.value * 0.3);
  world.rowboat.position.y = 0.12 + Math.sin(t * 1.3) * 0.05; world.rowboat.rotation.z = Math.sin(t * 0.9) * 0.05;
  world.fire.scale.set(1 + Math.sin(t * 11) * 0.08, 1 + Math.sin(t * 13) * 0.18, 1); world.fire.material.color.setHSL(0.07 + Math.sin(t * 9) * 0.015, 1, 0.55);
  for (const d of world.discoveries) if (!d.found) { d.group.children.forEach(c => { if (c.isPoints) { c.rotation.y += dt * 0.5; c.material.opacity = 0.6 + Math.sin(t * 3) * 0.3; } }); if (d.group.userData.spin) { d.group.userData.spin.rotation.y += dt; d.group.userData.spin.position.y = 1.5 + Math.sin(t * 2) * 0.1; } }
  for (const b of E.buildings) {
    if (b.grow !== undefined && b.grow < 1) { b.grow = Math.min(1, b.grow + dt * 1.1); const k = b.grow, e = 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2; b.group.scale.set(1, Math.max(0.01, e), 1); if (k >= 1) b.group.scale.set(1, 1, 1); }
    const u = b.ud;
    if (u.swings) u.swings.forEach((s, i) => s.rotation.x = Math.sin(t * 1.8 + i * 1.5) * 0.45);
    if (u.seesaw) u.seesaw.rotation.z = Math.sin(t * 1.4) * 0.22;
    if (u.boat) { u.boat.position.y = 0.15 + Math.sin(t * 1.2) * 0.05; u.boat.rotation.z = Math.sin(t) * 0.05; }
    if (u.flag) u.flag.rotation.y = Math.sin(t * 2.3) * 0.25;
    if (u.spin) u.spin.rotation.y += dt * 0.8;
    if (u.fire) u.fire.scale.y = 1 + Math.sin(t * 12 + b.rec.uid) * 0.2;
  }
  // falling and regrowing trees
  for (let i = E.fallingTrees.length - 1; i >= 0; i--) {
    const tr = E.fallingTrees[i]; tr.fall += dt * 0.9; const k = Math.min(1, tr.fall), ang = k * k * 1.45;
    const fd = tr.fallDir || 0; _ax.set(Math.cos(fd), 0, -Math.sin(fd)); _q2.setFromAxisAngle(_ax, ang); _q.setFromEuler(new THREE.Euler(0, tr.ry, 0)); _q2.multiply(_q);
    const sink = k >= 1 ? (tr.fall - 1) * 2 : 0; _v.set(tr.x, tr.y - sink, tr.z); _s.set(tr.s, tr.s * tr.sy, tr.s);
    for (const [im, j] of tr.inst) { _m.compose(_v, _q2, _s); im.setMatrixAt(j, _m); im.instanceMatrix.needsUpdate = true; }
    if (tr.fall > 1 && !tr.thud) { tr.thud = true; E.audio.burst(200, 1, 0.4, 0.5, 'lowpass', 0.5); E.fx.burst(tr.x + Math.sin(fd) * 3, tr.y + 0.4, tr.z + Math.cos(fd) * 3, 10); }
    if (tr.fall > 1.6) { setTreeVisible(tr, 0); tr.thud = false; E.fallingTrees.splice(i, 1); }
  }
  for (let i = E.growingTrees.length - 1; i >= 0; i--) { const tr = E.growingTrees[i]; tr.regrowT += dt * 0.5; const k = Math.min(1, tr.regrowT); setTreeVisible(tr, 0.2 + 0.8 * (1 - (1 - k) ** 3)); if (k >= 1) E.growingTrees.splice(i, 1); }
  // gates
  for (const g of world.gates) if (g.anim !== undefined && g.barrier.visible) { g.anim += dt; g.barrier.position.y = -g.anim * 1.6; g.barrier.rotation.x = g.anim * 0.4; if (g.anim > 1.4) g.barrier.visible = false; }
  // festival fireworks
  const S = E.S;
  if (S.festival && S.hour > 20.5 && Math.random() < dt * 1.2) { const st = E.buildings.find(b => b.def.id === 'stage'); if (st) firework(st.rec.x + (Math.random() - 0.5) * 20, height(st.rec.x, st.rec.z) + 22 + Math.random() * 10, st.rec.z + (Math.random() - 0.5) * 20); }
  for (let i = E.fireworks.length - 1; i >= 0; i--) { const f = E.fireworks[i]; f.t += dt; const a = f.pts.geometry.attributes.position.array; for (let k = 0; k < f.v.length; k++) { a[k * 3] += f.v[k].x * dt; a[k * 3 + 1] += (f.v[k].y - f.t * 4) * dt; a[k * 3 + 2] += f.v[k].z * dt; } f.pts.geometry.attributes.position.needsUpdate = true; f.pts.material.opacity = Math.max(0, 1 - f.t / 1.8); if (f.t > 1.8) { E.scene.remove(f.pts); f.pts.geometry.dispose(); E.fireworks.splice(i, 1); } }
}
function firework(x, y, z) {
  const n = 70, g = new THREE.BufferGeometry(), a = new Float32Array(n * 3), v = [];
  for (let i = 0; i < n; i++) { a.set([x, y, z], i * 3); const d = new THREE.Vector3().randomDirection().multiplyScalar(6 + Math.random() * 3); v.push(d); }
  g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.9, 0.65), size: 0.7, map: TEX.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); pts.frustumCulled = false;
  E.scene.add(pts); E.fireworks.push({ pts, v, t: 0 }); E.audio.burst(300, 0.8, 0.5, 0.25, 'lowpass', 0.4, 0.1);
}

// ---------- main loop ----------
const clock = new THREE.Clock(); let promptT = 0, miniT = 0, uiT = 0, ghostT = 0;
const camDir = new THREE.Vector3();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
  U.uTime.value = t;
  const S = E.S;
  const paused = E.panel === 'pause' || E.sleeping;
  if (E.mode === 'title') {
    const a = t * 0.05; E.cam.position.set(Math.sin(a) * 34, 16 + Math.sin(t * 0.1) * 2, Math.cos(a) * 34 + 4); E.cam.lookAt(0, 3, 2);
    E.player.update(dt, {}, 0);
  } else if (!paused) {
    // time
    if (!E.panel) S.hour += dt / GM.SEC_PER_HOUR();
    if (S.hour >= 24) { S.hour -= 24; newDayRollover(); }
    const gh = Math.floor(GM.gameHours()); if (lastHour < 0) lastHour = gh; if (gh !== lastHour) { lastHour = gh; hourly(); }
    // player
    const moveInput = E.panel ? {} : input;
    E.player.update(dt, moveInput, E.camRig.yaw);
    updateAct(dt); updateFishing(dt);
    // region change banner
    const reg = regionAt(E.player.pos.x, E.player.pos.z); if (reg !== E.lastRegion) { E.lastRegion = reg; ui.regionBanner(reg); }
    // visitors
    if (!E.panel) {
      E.lamT = (E.lamT || 0) - dt; if (E.lamT <= 0) { E.lamT = 1; E.lam = GM.hourlyArrivals(); }
      E.arrAcc = Math.min(3, E.arrAcc + E.lam * dt / GM.SEC_PER_HOUR());
      if (E.arrAcc >= 1) { E.arrAcc -= 1; if (E.visitors.length < GM.maxVisitors()) GM.spawnVisitor(); }
      GM.updateVisitors(dt);
    }
    // construction ghost
    if (E.mode === 'build' && GM.build.def) { ghostT -= dt; if (ghostT <= 0) { ghostT = 0.05; GM.updateGhost(groundHit()); ui.buildInfo(); } }
    E.camRig.update(dt, E.player.pos, E.mode === 'build');
    // HUD
    promptT -= dt; if (promptT <= 0 && E.mode === 'play') { promptT = 0.12; const it = !act && !fishing && !E.panel ? findInteract() : null; ui.prompt(fishing ? (fishing.phase === 'bite' ? 'Reel it in!' : 'Waiting for a bite… (E to reel in)') : it ? it.text : null); }
    uiT -= dt; if (uiT <= 0) { uiT = 0.5; ui.clock(); if (!E.panel) ui.objective(); }
    miniT -= dt; if (miniT <= 0) { miniT = 0.1; ui.mini(); }
  }
  const env = updateEnvironment(paused ? 0 : dt);
  animateWorld(paused ? 0 : dt, t);
  E.fx.update(paused ? 0 : dt, { center: E.mode === 'title' ? new THREE.Vector3(0, 2, 0) : E.player.pos, time: t, rain: W.rain, snow: W.snow, day: env.day, night: env.night, autumn: U.uAutumn.value, season: S.season, windX: U.uWind.value * 0.6 });
  // audio
  if (E.audio.ctx) {
    E.cam.getWorldDirection(camDir); const p = E.player.pos;
    const rz = clamp(p.z, RIVER_Z0, 90), rp = new THREE.Vector3(riverX(rz), 0.3, rz);
    let cx = 0, cz = 0, cn = 0; for (const v of E.visitors) if (v.pos.distanceToSquared(p) < 400) { cx += v.pos.x; cz += v.pos.z; cn++; }
    E.audio.update(dt, { cam: E.cam, camDir, wind: U.uWind.value - 0.8, altitude: Math.max(0, p.y - 4), rain: W.rain, snow: W.snow, riverPt: rp, fallsPt: world.waterfallPos, crowdPt: cn ? new THREE.Vector3(cx / cn, p.y, cz / cn) : p, crowd: cn, firePt: world.firePos, night: env.night, day: env.day, region: regionAt(p.x, p.z), winterQuiet: S.season === 3 && Math.random() < 0.6, event: S.festival });
  }
  ui.updateFloats(dt, E.cam);
  adaptRes(dt);
  E.renderer.render(E.scene, E.cam);
}

window.EVERGREEN = E; E.test = { startAct: (k, o) => startAct(k, o), updateAct, collectDiscovery, startFishing, catchFish, interact, findInteract, advanceHours, hourly, newDayRollover };
boot().catch(err => { console.error(err); $('loading').innerHTML = `<div style="text-align:center;padding:20px"><b style="font:800 40px Fraunces,serif">Evergreen</b><p>Something went wrong while growing the forest.</p><pre style="white-space:pre-wrap;font-size:12px;opacity:.7">${String(err && err.stack || err).slice(0, 600)}</pre></div>`; });
