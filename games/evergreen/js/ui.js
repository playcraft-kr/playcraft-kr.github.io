// EVERGREEN — HUD, construction bar, panels, map, journal, management
import * as THREE from 'three';
import { E, ICON, costHTML, esc, SEASONS, WEATHERS, LEVELS, levelOf } from './ctx.js';
import { CATALOG, CATEGORIES, CAT_BY_ID, upgradeCost, levelMul } from './buildings.js';
import { REGIONS, HALF, regionAt } from './terrain.js';
import { world, DISCOVERY_DEFS } from './world.js';
import * as GM from './game.js';
import { fmt } from './util.js';

const $ = id => document.getElementById(id);
const floats = [];
export const ui = {
  res(kind) {
    const S = E.S; if (!S) return;
    const cap = GM.cap(), lvl = S.level, L = LEVELS[lvl - 1], N = LEVELS[lvl];
    const pct = N ? (S.rep - L.rep) / (N.rep - L.rep) * 100 : 100;
    $('res').innerHTML = `
      <div class="pill" id="p-coins">${ICON.c}${fmt(S.coins)}</div>
      <div class="pill" id="p-wood">${ICON.w}${fmt(S.wood)}<small>/${cap}</small></div>
      <div class="pill" id="p-stone">${ICON.s}${fmt(S.stone)}<small>/${cap}</small></div>
      <div class="pill" id="p-flowers">${ICON.f}${fmt(S.flowers)}<small>/${cap}</small></div>
      <div class="pill" id="rep"><div class="row">${ICON.r}<span>${esc(L.name)}</span><small style="margin-left:auto">${fmt(S.rep)}${N ? ' / ' + fmt(N.rep) : ''}</small></div><div class="bar"><i style="width:${pct.toFixed(1)}%"></i></div></div>`;
    if (kind) { const el = $('p-' + kind); if (el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } }
  },
  toast(msg, cls = '') { const t = document.createElement('div'); t.className = 'toast ' + cls; t.textContent = msg; $('toasts').appendChild(t); while ($('toasts').children.length > 4) $('toasts').firstChild.remove(); setTimeout(() => t.remove(), 3800); },
  float(text, x, y, z, kind) { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;top:0;font:800 16px Nunito,sans-serif;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.55);pointer-events:none;white-space:nowrap;display:flex;gap:4px;align-items:center'; d.innerHTML = (ICON[{ coins: 'c', wood: 'w', stone: 's', flowers: 'f', rep: 'r' }[kind]] || '').replace('<svg', '<svg width="18" height="18"') + esc(text); document.body.appendChild(d); floats.push({ d, p: new THREE.Vector3(x, y, z), t: 0 }); },
  updateFloats(dt, cam) { const v = new THREE.Vector3(); for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.t += dt; f.p.y += dt * 0.9; v.copy(f.p).project(cam); if (f.t > 1.6 || v.z > 1) { f.d.remove(); floats.splice(i, 1); continue; } f.d.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth - 20}px,${(-v.y * 0.5 + 0.5) * innerHeight}px)`; f.d.style.opacity = Math.min(1, (1.6 - f.t) * 2); } },
  objective() {
    const S = E.S, q = GM.QUESTS[S.quest];
    const d = GM.dailyDef();
    $('obj').innerHTML = q ? `<b>${esc(q.t)}</b><span>${esc(q.d)}</span><div class="bar"><i style="width:${(q.p(S) * 100).toFixed(0)}%"></i></div>` + (d && !S.daily.done ? `<span style="display:block;margin-top:7px;font-weight:800">Today: ${esc(d.d)} · ${Math.min(100, d.p(S.today) * 100).toFixed(0)}%</span>` : '')
      : `<b>Your village, your way</b><span>Every objective done. Keep decorating, exploring and hosting — Evergreen is yours.</span>`;
  },
  clock() {
    const S = E.S, h = Math.floor(S.hour), m = Math.floor((S.hour % 1) * 60 / 10) * 10;
    const ampm = h < 12 ? 'am' : 'pm', h12 = ((h + 11) % 12) + 1;
    const part = S.hour < 5 ? 'Night' : S.hour < 11 ? 'Morning' : S.hour < 17 ? 'Afternoon' : S.hour < 21 ? 'Evening' : 'Night';
    $('ctime').textContent = `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
    $('cday').textContent = `Day ${S.day} · ${SEASONS[S.season]} · ${part}`;
    $('cweather').textContent = WEATHERS[S.weather] + (S.festival ? ' · Festival tonight!' : '') + ` · ${E.visitors.length} visitors`;
  },
  regionBanner(r) { $('regname').textContent = REGIONS[r].name; $('regsub').textContent = REGIONS[r].blurb; $('region').style.opacity = 1; clearTimeout(this._rb); this._rb = setTimeout(() => $('region').style.opacity = 0, 3200); },
  prompt(text) { if (text) { $('ptext').textContent = text; $('prompt').classList.remove('hidden'); } else $('prompt').classList.add('hidden'); },
  keys() { $('keys').innerHTML = [['WASD', 'Move'], ['Shift', 'Run'], ['B', 'Build'], ['V', 'Village'], ['J', 'Journal'], ['I', 'Bag'], ['M', 'Map'], ['Esc', 'Menu']].map(([k, n]) => `<div><kbd>${k}</kbd>${n}</div>`).join(''); },

  // ---------- construction bar ----------
  buildCat: 'starter',
  buildBar() {
    const S = E.S, B = GM.build;
    $('btabs').innerHTML = CATEGORIES.map(([k, n]) => `<button class="tab ${this.buildCat === k ? 'on' : ''}" data-cat="${k}">${n}</button>`).join('');
    $('btools').innerHTML = [['build', 'Build'], ['move', 'Move'], ['upgrade', 'Upgrade'], ['demolish', 'Demolish']].map(([k, n]) => `<button class="tab ${B.tool === k ? 'on' : ''}" data-tool="${k}">${n}</button>`).join('');
    const items = CATALOG.filter(c => c.cat === this.buildCat && !c.hidden && (!c.locked || S.unlocks.includes(c.locked)) && (c.season === undefined || c.season === S.season));
    const lockedRare = CATALOG.filter(c => c.cat === this.buildCat && c.locked && !S.unlocks.includes(c.locked)).length;
    $('cards').innerHTML = items.map(c => {
      const lock = (c.lvl || 1) > S.level ? `Needs ${LEVELS[c.lvl - 1].name}` : '';
      return `<div class="card ${B.def === c ? 'on' : ''} ${lock ? 'lock' : ''}" data-id="${c.id}" title="${esc(c.desc)}"><img alt="" src="${E.thumbs[c.id] || ''}">${lock ? `<div class="lockt">${lock}</div>` : ''}<b>${esc(c.name)}</b>${costHTML(c.cost, S)}</div>`;
    }).join('') + (lockedRare ? `<div class="card lock" style="display:grid;place-items:center;text-align:center;font-weight:800;color:var(--soft);font-size:12.5px">${lockedRare} rare designs still hidden in the wild</div>` : '');
    this.buildInfo();
  },
  buildInfo() {
    const B = GM.build, el = $('binfo');
    if (B.moving) { const v = B.valid; el.className = v && !v.ok ? 'bad' : ''; el.textContent = v && !v.ok ? v.why : `Moving ${B.moving.def.name} — click to set it down · R to rotate · Esc to cancel`; return; }
    if (B.tool !== 'build') { el.className = ''; el.textContent = { move: 'Click a building to pick it up', upgrade: 'Click a building to upgrade it', demolish: 'Click a building to remove it (half refund)' }[B.tool]; return; }
    if (!B.def) { el.className = ''; el.textContent = 'Choose something to build'; return; }
    const v = B.valid; const d = B.def;
    const stats = d.type === 'lodging' ? `${d.cap} guests · ${d.price}/night` : d.price ? `${d.price} per visit` : d.storage ? `+${d.storage} storage` : d.appeal ? `Appeal +${d.appeal}` : '';
    el.className = v && !v.ok ? 'bad' : '';
    el.textContent = v && !v.ok ? v.why : `${d.name}${stats ? ' · ' + stats : ''}${d.upkeep ? ` · upkeep ${d.upkeep}/day` : ''} — ${d.desc}`;
  },

  // ---------- panels ----------
  open(name, arg) { let html; try { html = this['P_' + name](arg); } catch (err) { console.error(err); this.toast('Something went wrong opening that panel', 'warn'); return; } E.panel = name; const p = $('panel'); p.classList.remove('hidden'); p.innerHTML = html; p.onclick = e => this.onPanelClick(e, name, arg); p.oninput = e => this.onPanelInput(e); document.exitPointerLock?.(); E.audio.click(); this.afterOpen && this.afterOpen(name, arg); },
  close() { E.panel = null; $('panel').classList.add('hidden'); $('panel').innerHTML = ''; },
  refresh(arg) { if (E.panel) { const s = $('panel').querySelector('.body')?.scrollTop; $('panel').innerHTML = this['P_' + E.panel](arg ?? this._arg); const b = $('panel').querySelector('.body'); if (b && s) b.scrollTop = s; this.afterOpen && this.afterOpen(E.panel, arg ?? this._arg); } },
  head(t, sub) { return `<header><div><h2>${t}</h2>${sub ? `<p>${sub}</p>` : ''}</div><button class="x" data-act="close" aria-label="Close">✕</button></header>`; },
  tab: { village: 'overview', journal: 'quests' },
  tabs(group, list) { return `<div class="tabs">${list.map(([k, n]) => `<button class="tab ${this.tab[group] === k ? 'on' : ''}" data-tab="${group}:${k}">${n}</button>`).join('')}</div>`; },

  P_pause() {
    const s = E.S.settings;
    return `<div class="panel" style="width:min(560px,100%)">${this.head('Paused', `Day ${E.S.day} · ${SEASONS[E.S.season]} · ${LEVELS[E.S.level - 1].name}`)}<div class="body">
      <div class="row"><button data-act="resume" class="ember">Resume</button><button data-act="save">Save game</button><button data-act="load" class="ghost">Load last save</button><button data-act="newgame" class="ghost">New village</button></div>
      <div id="evlb" class="evlb"></div>
      <h3 class="f" style="margin:18px 0 4px;color:var(--green)">Settings</h3>
      <label class="set">Shadows<select data-set="shadows"><option value="off">Off</option><option value="low">Low</option><option value="high">High</option></select></label>
      <label class="set">Grass density<select data-set="grass"><option value="low">Low</option><option value="med">Medium</option><option value="high">High</option></select></label>
      <label class="set">Day length<select data-set="dayLen"><option value="4">4 minutes</option><option value="6">6 minutes</option><option value="10">10 minutes</option></select></label>
      <label class="set">Season length<select data-set="seasonLen"><option value="2">2 days</option><option value="3">3 days</option><option value="5">5 days</option></select></label>
      <label class="set">Mouse sensitivity<input type="range" min="0.3" max="2.5" step="0.1" value="${s.sens}" data-set="sens"></label>
      <label class="set">Invert look<select data-set="invert"><option value="false">No</option><option value="true">Yes</option></select></label>
      <label class="set">Music<input type="range" min="0" max="1" step="0.05" value="${s.music}" data-set="music"></label>
      <label class="set">Effects<input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-set="sfx"></label>
      <label class="set">Ambience<input type="range" min="0" max="1" step="0.05" value="${s.amb}" data-set="amb"></label>
      <h3 class="f" style="margin:18px 0 4px;color:var(--green)">Save code</h3>
      <p style="margin:0 0 8px;color:var(--soft);font-size:13.5px">Your village saves by itself to your Zanycade account. You can also copy a code to keep a spare copy, or paste one to load it.</p>
      <textarea id="savecode" spellcheck="false" placeholder="Paste a save code here"></textarea>
      <div class="row" style="margin-top:8px"><button data-act="copycode" class="ghost">Copy my save code</button><button data-act="loadcode" class="ghost">Load pasted code</button></div>
      <h3 class="f" style="margin:18px 0 4px;color:var(--green)">Controls</h3>
      <p style="margin:0;color:var(--soft);font-size:14px">WASD move · Mouse look (click the world to capture) · Scroll zoom · Space jump · Shift run · E interact · B build (R rotate, right-drag to look) · V village · J journal · I bag · M map · Esc menu</p>
    </div></div>`;
  },
  afterOpen(name) {
    if (name === 'pause') { const s = E.S.settings; for (const el of $('panel').querySelectorAll('select[data-set]')) el.value = String(s[el.dataset.set]); }
    if (name === 'map') this.drawMap();
  },
  onPanelInput(e) {
    const k = e.target.dataset.set; if (k) { let v = e.target.value; if (['sens', 'music', 'sfx', 'amb', 'dayLen', 'seasonLen'].includes(k)) v = +v; if (k === 'invert') v = v === 'true'; E.S.settings[k] = v; E.applySettings(); }
    if (e.target.dataset.price) { E.S.priceMul = +e.target.value; $('pricev').textContent = Math.round(E.S.priceMul * 100) + '%'; }
  },
  onPanelClick(e, name, arg) {
    const t = e.target.closest('[data-act],[data-tab],[data-buy],[data-sleep]');
    if (e.target.id === 'panel') { if (name !== 'levelup' && name !== 'discovery') this.close(); return; }
    if (!t) return; E.audio.click();
    if (t.dataset.tab) { const [g, k] = t.dataset.tab.split(':'); this.tab[g] = k; this.refresh(arg); return; }
    const a = t.dataset.act;
    if (a === 'close' || a === 'resume') { this.close(); E.resume(); }
    else if (a === 'save') { GM.saveGame(); }
    else if (a === 'load') { const s = GM.readSave(); if (s && GM.loadGame(s)) { this.close(); this.toast('Village loaded'); E.resume(); } else this.toast('No save found', 'warn'); }
    else if (a === 'newgame') { if (t.dataset.sure) { GM.newGame(); this.close(); this.toast('A new village begins'); E.resume(); } else { t.dataset.sure = 1; t.textContent = 'Click again to start over'; t.className = 'warn'; } }
    else if (a === 'copycode') { const code = btoa(unescape(encodeURIComponent(GM.serialize()))); $('savecode').value = code; navigator.clipboard?.writeText(code).then(() => this.toast('Save code copied'), () => this.toast('Code shown below — select and copy it')); }
    else if (a === 'loadcode') { try { const s = decodeURIComponent(escape(atob($('savecode').value.trim()))); if (GM.loadGame(s)) { this.close(); this.toast('Village loaded from code'); E.resume(); } } catch (err) { this.toast('That code is not valid', 'warn'); } }
    else if (a === 'upgrade') { const nb = GM.upgrade(arg); if (nb) this.open('building', nb); }
    else if (a === 'move') { this.close(); E.enterBuild(); GM.build.tool = 'move'; GM.build.moving = arg; GM.build.rot = arg.rec.rot; GM.selectDef(arg.def); this.buildBar(); }
    else if (a === 'demolish') { if (t.dataset.sure) { GM.demolish(arg); this.close(); E.resume(); } else { t.dataset.sure = 1; t.textContent = 'Click again to confirm'; } }
    else if (a === 'sleep') { this.close(); E.sleep(); }
    else if (a === 'unlock') { E.unlockRegion(arg); }
    else if (a === 'ok') { this.close(); E.resume(); }
  },
  P_building(b) {
    this._arg = b; const d = b.def, lvl = b.rec.lvl || 1, S = E.S, mul = levelMul(lvl);
    const up = lvl < 3 && !['decor', 'path', 'home'].includes(d.type) ? upgradeCost(d, lvl) : null;
    const rows = [];
    if (d.type === 'lodging') rows.push(['Guests tonight', `${b.guests.length} / ${Math.round(d.cap * mul)}`], ['Nightly rate', fmt(d.price * mul * S.priceMul)]);
    if (d.slots) rows.push(['In use', `${b.occupants} / ${Math.round(d.slots * mul)}`]);
    if (d.price && d.type !== 'lodging') rows.push(['Price per visit', fmt(d.price * mul * S.priceMul)]);
    if (d.upkeep) rows.push(['Upkeep', `${d.upkeep}/day`]);
    rows.push(['Income today', fmt(b.incomeToday)], ['Income all-time', fmt(b.incomeTotal || 0)]);
    if (d.produce) rows.push(['Grows', `${d.produce.f * mul} flowers every 3 hours`]);
    if (d.storage) rows.push(['Storage', `+${d.storage} each`]);
    const home = d.type === 'home';
    return `<div class="panel" style="width:min(520px,100%)">${this.head(esc(d.name) + (home ? '' : ` <span style="font-size:18px;color:var(--soft)">Lv ${lvl}</span>`), esc(d.desc))}<div class="body">
      ${home ? '' : `<table>${rows.map(([k, v]) => `<tr><td>${k}</td><td class="n">${v}</td></tr>`).join('')}</table>`}
      <div class="row" style="margin-top:14px">
      ${home ? `<button data-act="sleep" class="ember">${S.hour >= 18 || S.hour < 6 ? 'Sleep until morning' : 'Rest until evening'}</button>` : ''}
      ${up ? `<button data-act="upgrade" class="ember" ${GM.canAfford(up) ? '' : 'disabled'}>Upgrade to Lv ${lvl + 1}</button>${costHTML(up, S)}` : (!home && lvl >= 3 ? '<b style="color:var(--green)">Fully upgraded</b>' : '')}
      <span class="spacer"></span>${home ? '' : '<button data-act="move" class="ghost">Move</button><button data-act="demolish" class="ghost">Demolish</button>'}</div>
      ${up ? `<p style="color:var(--soft);font-size:13.5px;margin:10px 0 0">Upgrading raises capacity and prices by ${lvl === 1 ? '35' : '30'}%, adds satisfaction and decorates the building.</p>` : ''}
    </div></div>`;
  },
  P_gate(gate) {
    this._arg = gate; const R = REGIONS[gate.region], q = R.req, S = E.S;
    const ok = S.level >= q.level, cost = { c: q.coins, w: q.wood, s: q.stone, f: q.flowers }; Object.keys(cost).forEach(k => cost[k] === undefined && delete cost[k]);
    return `<div class="panel" style="width:min(500px,100%)">${this.head(esc(R.name), esc(R.blurb))}<div class="body">
      <p style="margin-top:0;font-weight:700">To clear the old logs and open the trail you need:</p>
      <div class="row" style="margin-bottom:12px"><span class="pill" style="box-shadow:inset 0 0 0 1px var(--line)">${ICON.r}${LEVELS[q.level - 1].name}${ok ? ' ✓' : ''}</span>${costHTML(cost, S)}</div>
      <button data-act="unlock" class="ember" ${ok && GM.canAfford(cost) ? '' : 'disabled'}>Open the trail</button>
      ${!ok ? `<p style="color:var(--soft);font-size:13.5px">Grow your reputation with happy visitors to reach ${LEVELS[q.level - 1].name}.</p>` : ''}
    </div></div>`;
  },
  P_discovery(d) {
    const rw = d.reward; const parts = [];
    if (rw.coins) parts.push(`${ICON.c}${rw.coins}`); if (rw.wood) parts.push(`${ICON.w}${rw.wood}`); if (rw.stone) parts.push(`${ICON.s}${rw.stone}`); if (rw.flowers) parts.push(`${ICON.f}${rw.flowers}`); if (rw.rep) parts.push(`${ICON.r}${rw.rep} reputation`); if (rw.unlock) parts.push('New design unlocked');
    const kind = { journal: 'A page from the past', chest: 'Treasure', lost: 'Lost & found', rare: 'Rare plant', view: 'Secret viewpoint', relic: 'Ancient relic' }[d.kind];
    return `<div class="panel" style="width:min(560px,100%)">${this.head(esc(d.title), kind + ` · discovery ${E.S.found.length} of ${DISCOVERY_DEFS.length}`)}<div class="body"><div class="story">${esc(d.text)}</div><div class="reward">${parts.map(p => `<span>${p}</span>`).join('')}</div><div class="row" style="margin-top:16px"><button data-act="ok" class="ember">Lovely</button></div></div></div>`;
  },
  levelUp(lvl) { this._lvl = lvl; this.open('levelup', lvl); },
  P_levelup(l) { const L = LEVELS[l - 1]; return `<div class="panel" style="width:min(520px,100%);text-align:center">${this.head('Your village grew!', '')}<div class="body"><div style="font:800 40px Fraunces,serif;color:var(--green);margin:6px 0">${esc(L.name)}</div><p style="font-weight:700">${esc(L.unlock)}</p><button data-act="ok" class="ember">Wonderful</button></div></div>`; },

  P_village() {
    const S = E.S, T = S.today, f = GM.factors(), sat = GM.satisfaction(), tab = this.tab.village;
    const lodging = E.buildings.filter(b => b.def.type === 'lodging'), guests = lodging.reduce((a, b) => a + b.guests.length, 0), capacity = lodging.reduce((a, b) => a + Math.round(b.def.cap * levelMul(b.rec.lvl || 1)), 0);
    const upkeep = E.buildings.reduce((a, b) => a + (b.def.upkeep || 0), 0);
    let body = '';
    if (tab === 'overview') body = `<div class="grid2">
      <div class="stat"><small>Visitors in the village</small><b>${E.visitors.length}</b> <small style="display:inline">/ ${GM.maxVisitors()} max</small></div>
      <div class="stat"><small>Overnight guests</small><b>${guests}</b> <small style="display:inline">/ ${capacity} beds</small></div>
      <div class="stat"><small>Income today</small><b>${fmt(T.income)}</b></div>
      <div class="stat"><small>Expenses today</small><b class="neg">${fmt(T.expenses)}</b> <small style="display:inline">· ${upkeep}/day upkeep</small></div>
      <div class="stat"><small>Satisfaction (recent guests)</small><b>${sat.toFixed(0)}%</b></div>
      <div class="stat"><small>Reputation</small><b>${fmt(S.rep)}</b> <small style="display:inline">${esc(LEVELS[S.level - 1].name)}</small></div></div>
      <h3 class="f" style="color:var(--green);margin:18px 0 6px">Prices</h3>
      <div class="row"><input type="range" min="0.7" max="1.5" step="0.05" value="${S.priceMul}" data-price="1" style="flex:1"><b id="pricev" style="width:54px;text-align:right">${Math.round(S.priceMul * 100)}%</b></div>
      <p style="color:var(--soft);font-size:13.5px;margin:4px 0 0">Higher prices earn more per visit but guests notice. Below 100% builds goodwill.</p>
      <h3 class="f" style="color:var(--green);margin:18px 0 6px">Last 7 days</h3>${this.chart()}`;
    if (tab === 'business') { const biz = E.buildings.filter(b => !['decor', 'path', 'home'].includes(b.def.type)); body = biz.length ? `<table><tr><th>Building</th><th class="n">Lv</th><th class="n">Visits today</th><th class="n">Income today</th><th class="n">Upkeep/day</th></tr>${biz.map(b => `<tr><td>${esc(b.def.name)}</td><td class="n">${b.rec.lvl || 1}</td><td class="n">${b.usesToday}${b.def.type === 'lodging' ? ` · ${b.guests.length} guests` : ''}</td><td class="n">${fmt(b.incomeToday)}</td><td class="n">${b.def.upkeep || 0}</td></tr>`).join('')}</table>` : '<p>No businesses yet — press B to build your first café.</p>'; }
    if (tab === 'satisfaction') body = Object.entries(f).map(([k, v]) => `<div class="fac"><span>${k}</span><div class="bar ${v < 45 ? 'lo' : ''}"><i style="width:${v.toFixed(0)}%"></i></div><b style="text-align:right">${v.toFixed(0)}</b></div>`).join('') + `<p style="color:var(--soft);font-size:13.5px">Facilities: variety of food, lodging, fun, nature, shops and relaxation. Cleanliness: litter on the ground (bins and the Community Hall help). Decoration and Nature: what guests see around them. Accessibility: buildings near paths. Quality: building levels.</p>`;
    if (tab === 'reviews') body = S.reviews.length ? S.reviews.map(r => `<div class="review"><span class="stars">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</span> <b>${esc(r.name)}</b> <small style="color:var(--soft)">Day ${r.day} · spent ${r.spent}</small><div>${esc(r.text)}</div></div>`).join('') : '<p>No reviews yet. Guests leave one when they head home.</p>';
    return `<div class="panel">${this.head('Village', `${esc(LEVELS[S.level - 1].name)} · Day ${S.day}`)}${this.tabs('village', [['overview', 'Overview'], ['business', 'Businesses'], ['satisfaction', 'Satisfaction'], ['reviews', 'Reviews']])}<div class="body">${body}</div></div>`;
  },
  chart() { const L = E.S.ledger.slice(-7); if (!L.length) return '<p style="color:var(--soft)">The ledger fills in at the end of each day.</p>'; const m = Math.max(10, ...L.map(d => Math.abs(d.income - d.expenses))); return `<div class="chartb">${L.map(d => { const n = d.income - d.expenses; return `<div><span>${n >= 0 ? '+' : ''}${fmt(n)}</span><i class="${n < 0 ? 'neg' : ''}" style="height:${Math.abs(n) / m * 80}%"></i><span>D${d.day}</span></div>`; }).join('')}</div>`; },
  P_journal() {
    const S = E.S, tab = this.tab.journal; let body = '';
    if (tab === 'quests') { body = GM.QUESTS.map((q, i) => `<div class="q ${i < S.quest ? 'done' : i === S.quest ? 'cur' : ''}"><div class="dot">${i < S.quest ? '✓' : i + 1}</div><div><b>${esc(q.t)}</b><span>${esc(q.d)}</span></div><div class="rw">${Object.entries(q.r).map(([k, v]) => `${v} ${k}`).join(' · ')}</div></div>`).join('');
      const d = GM.dailyDef(), s = GM.seasonalDef();
      body = `<h3 class="f" style="color:var(--green);margin:0 0 4px">Optional</h3>` + (d ? `<div class="q ${S.daily.done ? 'done' : 'cur'}"><div class="dot">${S.daily.done ? '✓' : 'D'}</div><div><b>Today: ${esc(d.t)}</b><span>${esc(d.d)} · ${Math.min(100, d.p(S.today) * 100).toFixed(0)}%</span></div><div class="rw">${Object.entries(d.r).map(([k, v]) => `${v} ${k}`).join(' · ')}</div></div>` : '') + (s ? `<div class="q ${S.seasonal.done ? 'done' : 'cur'}"><div class="dot">${S.seasonal.done ? '✓' : 'S'}</div><div><b>${esc(s.t)}</b><span>${esc(s.d)}</span></div><div class="rw">${Object.entries(s.r).map(([k, v]) => `${v} ${k}`).join(' · ')}</div></div>` : '') + `<h3 class="f" style="color:var(--green);margin:16px 0 4px">Story</h3>` + body; }
    if (tab === 'discover') body = `<p style="margin-top:0;color:var(--soft)">${S.found.length} of ${DISCOVERY_DEFS.length} found. Look for faint sparkles off the beaten path.</p><div class="discov">${DISCOVERY_DEFS.map(d => S.found.includes(d.id) ? `<div><b>${esc(d.title)}</b><br>${esc(d.text)}</div>` : `<div class="no"><b>Undiscovered</b><br>Somewhere in ${esc(REGIONS[regionAt(d.x, d.z)].name)}</div>`).join('')}</div>`;
    if (tab === 'ach') body = `<div class="ach">${GM.ACH.map(([id, n, d]) => `<div class="${S.ach.includes(id) ? 'got' : ''}"><b>${esc(n)}</b>${esc(d)}</div>`).join('')}</div>`;
    return `<div class="panel">${this.head('Journal', `${S.ach.length} of ${GM.ACH.length} achievements`)}${this.tabs('journal', [['quests', 'Objectives'], ['discover', 'Discoveries'], ['ach', 'Achievements']])}<div class="body">${body}</div></div>`;
  },
  P_bag() {
    const S = E.S, cap = GM.cap(); const fish = Object.entries(S.fish);
    return `<div class="panel" style="width:min(640px,100%)">${this.head('Bag', 'Materials, catches and finds')}<div class="body"><div class="inv">
      <div>${ICON.c}<span><b>${fmt(S.coins)}</b>Coins</span></div><div>${ICON.w}<span><b>${S.wood}/${cap}</b>Wood</span></div><div>${ICON.s}<span><b>${S.stone}/${cap}</b>Stone</span></div><div>${ICON.f}<span><b>${S.flowers}/${cap}</b>Flowers</span></div><div>${ICON.r}<span><b>${fmt(S.rep)}</b>Reputation</span></div><div>${ICON.fish}<span><b>${S.stats.fish}</b>Fish caught</span></div></div>
      <p style="color:var(--soft);font-size:13.5px">Wood from trees, stone from rocks, flowers from wildflower clumps, gardens and greenhouses. Storage Sheds raise the limit.</p>
      <h3 class="f" style="color:var(--green);margin:14px 0 6px">Fish journal</h3>${fish.length ? `<table><tr><th>Species</th><th class="n">Caught</th></tr>${fish.map(([n, c]) => `<tr><td>${esc(n)}</td><td class="n">${c}</td></tr>`).join('')}</table>` : '<p style="color:var(--soft)">No fish yet — face any water and press E.</p>'}
      <h3 class="f" style="color:var(--green);margin:14px 0 6px">Special items</h3><p>${S.unlocks.length ? S.unlocks.map(u => ({ goldrod: 'Golden Fishing Rod', moonbed: 'Moonbell seeds', alpine: 'Edelweiss seeds', rarebed: 'Sunstar orchid bulbs', statue: 'Relic of Roots', stonecircle: 'Relic of Rings', lanternarch: 'Relic of Light' }[u])).map(esc).join(' · ') : '<span style="color:var(--soft)">Nothing yet. Explore!</span>'}</p>
    </div></div>`;
  },
  P_map() { return `<div class="panel" style="width:min(680px,100%)">${this.head('Map of Evergreen', 'Your village and the valley around it')}<div class="body"><canvas id="mapc" width="640" height="640"></canvas><div class="legend"><span><i style="background:#fff"></i>You</span><span><i style="background:#e08a3c"></i>Buildings</span><span><i style="background:#f6cf62"></i>Discoveries found</span><span><i style="background:#c9443a"></i>Locked trail</span><span><i style="background:rgba(20,20,20,.55)"></i>Locked land</span></div></div></div>`; },
  drawMap() {
    const c = $('mapc'); if (!c) return; const g = c.getContext('2d'), W = c.width, s = W / (HALF * 2), P = (x, z) => [(x + HALF) * s, (z + HALF) * s];
    g.imageSmoothingEnabled = true; g.drawImage(world.mapImage, 0, 0, W, W);
    // locked regions shade
    const img = g.getImageData(0, 0, W, W), d = img.data;
    for (let j = 0; j < W; j += 2) for (let i = 0; i < W; i += 2) { const x = i / s - HALF, z = j / s - HALF; if (!E.S.unlocked[regionAt(x, z)]) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) { const k = ((j + b) * W + i + a) * 4; d[k] *= 0.45; d[k + 1] *= 0.45; d[k + 2] *= 0.5; } }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(169,130,90,.9)'; g.lineWidth = 3; g.lineCap = 'round';
    g.font = '700 15px Fraunces, serif'; g.textAlign = 'center';
    for (const [i, x, z] of [[0, 0, -16], [1, 10, 112], [2, -4, -118], [3, 112, -10], [4, -112, -8]]) { const [px, pz] = P(x, z); g.fillStyle = 'rgba(255,255,255,.92)'; g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 4; g.strokeText(REGIONS[i].name, px, pz); g.fillText(REGIONS[i].name, px, pz); }
    for (const b of E.buildings) { if (b.def.type === 'path') continue; const [px, pz] = P(b.rec.x, b.rec.z); g.fillStyle = b.def.type === 'decor' ? 'rgba(224,138,60,.6)' : '#e08a3c'; g.beginPath(); g.arc(px, pz, b.def.type === 'decor' ? 1.6 : 3.8, 0, 7); g.fill(); }
    for (const dd of world.discoveries) if (dd.found) { const [px, pz] = P(dd.x, dd.z); g.fillStyle = '#f6cf62'; g.beginPath(); g.arc(px, pz, 4, 0, 7); g.fill(); g.strokeStyle = '#7a5a10'; g.lineWidth = 1.5; g.stroke(); }
    for (const gt of world.gates) if (!gt.open) { const [px, pz] = P(gt.x, gt.z); g.fillStyle = '#c9443a'; g.fillRect(px - 5, pz - 5, 10, 10); }
    const p = E.player.pos, [px, pz] = P(p.x, p.z); g.save(); g.translate(px, pz); g.rotate(-E.player.yaw + Math.PI); g.fillStyle = '#fff'; g.strokeStyle = '#2f4a35'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath(); g.fill(); g.stroke(); g.restore();
  },
  mini() {
    const c = $('mini'), g = c.getContext('2d'), W = c.width, R = 60, p = E.player.pos, s = W / (R * 2), N = world.mapImage.width, ws = N / (HALF * 2);
    g.save(); g.clearRect(0, 0, W, W); g.beginPath(); g.arc(W / 2, W / 2, W / 2, 0, 7); g.clip();
    g.translate(W / 2, W / 2); g.rotate(E.camRig.yaw); g.translate(-W / 2, -W / 2);
    g.drawImage(world.mapImage, (p.x - R + HALF) * ws, (p.z - R + HALF) * ws, R * 2 * ws, R * 2 * ws, 0, 0, W, W);
    for (const b of E.buildings) { if (b.def.type === 'path' || b.def.type === 'decor') continue; const x = (b.rec.x - p.x + R) * s, z = (b.rec.z - p.z + R) * s; g.fillStyle = '#e08a3c'; g.beginPath(); g.arc(x, z, 7, 0, 7); g.fill(); }
    for (const v of E.visitors) { const x = (v.pos.x - p.x + R) * s, z = (v.pos.z - p.z + R) * s; g.fillStyle = '#fbf5e9'; g.beginPath(); g.arc(x, z, 3, 0, 7); g.fill(); }
    for (const gt of world.gates) if (!gt.open) { const x = (gt.x - p.x + R) * s, z = (gt.z - p.z + R) * s; g.fillStyle = '#c9443a'; g.fillRect(x - 6, z - 6, 12, 12); }
    g.restore();
    g.save(); g.translate(W / 2, W / 2); g.rotate(Math.PI - (E.player.yaw - E.camRig.yaw)); g.fillStyle = '#fff'; g.strokeStyle = '#2f4a35'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -14); g.lineTo(10, 11); g.lineTo(0, 5); g.lineTo(-10, 11); g.closePath(); g.fill(); g.stroke(); g.restore();
    // north marker
    const a = E.camRig.yaw, NR = W / 2 - 20; g.fillStyle = 'rgba(47,74,53,.85)'; g.beginPath(); g.arc(W / 2 + Math.sin(a) * NR, W / 2 - Math.cos(a) * NR, 15, 0, 7); g.fill(); g.fillStyle = '#fbf5e9'; g.font = '900 20px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', W / 2 + Math.sin(a) * NR, W / 2 - Math.cos(a) * NR + 1);
  },
};
