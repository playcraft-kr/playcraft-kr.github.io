(() => {
'use strict';
const ROOT = '../';
const $ = s => document.querySelector(s);
const h = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
};
const CATS = [
  ['Action', 'cat-action', '💥'], ['Fighting', 'cat-fighting', '🥊'], ['3D', 'cat-3d', '🧊'], ['Space', 'cat-space', '🪐'],
  ['Adventure', 'cat-adventure', '🗺️'], ['Sports', 'cat-sports', '⚽'], ['Puzzle', 'cat-puzzle', '🧩'], ['Racing', 'cat-racing', '🏎️'],
];
const CAT_READY = new Set(['cat-action', 'cat-fighting', 'cat-3d', 'cat-space', 'cat-adventure', 'cat-sports', 'cat-puzzle', 'cat-racing']);
const WEEK = 7 * 864e5;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
let GAMES = [];
const MAIN = () => GAMES.filter(g => !g.variantOf);
const bySlug = s => GAMES.find(g => g.slug === s);

/* ---------- small storage helpers (this device only) ---------- */
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('pc.' + k)) || []; } catch { return []; } },
  set(k, v) { try { localStorage.setItem('pc.' + k, JSON.stringify(v)); } catch {} },
};
const ACC = window.Account || null;
const signedIn = () => !!(ACC && ACC.signedIn);
let cloudSaved = [], cloudStats = null;   // filled from the account when signed in
const savedList = () => signedIn() ? cloudSaved : store.get('saved');
const playedList = () => signedIn() && cloudStats ? [...cloudStats.games].sort((a, b) => b.last.localeCompare(a.last)).map(x => x.slug) : store.get('played');
const isSaved = s => savedList().includes(s);
function toggleSave(s) {
  const list = [...savedList()]; const i = list.indexOf(s);
  if (i >= 0) list.splice(i, 1); else list.unshift(s);
  if (signedIn()) { cloudSaved = list; ACC.setSaved(s, i < 0).catch(() => toast('Couldn’t save to your account. Check your internet.')); }
  else store.set('saved', list);
  return i < 0;
}
function markPlayed(s) { const l = store.get('played').filter(x => x !== s); l.unshift(s); store.set('played', l.slice(0, 12)); }
async function refreshAccountData() {
  if (!signedIn()) { cloudSaved = []; cloudStats = null; return; }
  try { [cloudSaved, cloudStats] = await Promise.all([ACC.savedList(), ACC.stats()]); cloudSaved = cloudSaved || []; } catch {}
}
const fmtTime = sec => { sec = Math.round(sec || 0); if (sec < 60) return `${sec}s`; const m = Math.floor(sec / 60); if (m < 60) return `${m} min`; return `${Math.floor(m / 60)} h ${m % 60} min`; };

let toastT;
const toast = m => { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600); };

/* ---------- art & credit helpers ---------- */
const coverOf = g => g.community ? g.coverUrl : ROOT + g.cover;
const wideOf = g => g.community ? g.coverUrl : ROOT + g.wide;
const madeBy = g => g.author ? `Made by ${g.author}` : 'PlayCraft Original';
const EMO = { Action: '💥', Fighting: '🥊', '3D': '🧊', Space: '🪐', Adventure: '🗺️', Sports: '⚽', Puzzle: '🧩', Racing: '🏎️' };
function artNode(g, cls) {
  const u = coverOf(g);
  if (u) return h('img', { src: u, alt: '', loading: 'lazy', class: cls || null });
  return h('div', { class: 'gen-art', style: genBg(g.slug) }, h('span', { 'aria-hidden': 'true', text: EMO[g.cats[0]] || '🎮' }), g.title);
}
function genBg(s) { let n = 0; for (const c of s) n = (n * 31 + c.charCodeAt(0)) >>> 0; const hue = n % 360; return `background:linear-gradient(140deg,hsl(${hue} 70% 55%),hsl(${(hue + 50) % 360} 70% 38%))`; }

/* ---------- cards ---------- */
/* new & updated: NEW for 2 weeks after a game is added (not the launch-day games), UPDATED for 1 week after "updated" */
const dayOf = d => d ? Date.parse(d + 'T12:00') : 0;
function newness(g) {
  const launch = Math.min(...GAMES.map(x => dayOf(x.added))), now = Date.now();
  if (dayOf(g.added) > launch && now - dayOf(g.added) < 2 * WEEK) return 'new';
  if (g.updated && now - dayOf(g.updated) < WEEK) return 'upd';
  return '';
}
const freshAt = g => Math.max(dayOf(g.added), dayOf(g.updated));
const freshList = () => MAIN().filter(newness).sort((a, b) => (newness(a) === 'new' ? 0 : 1) - (newness(b) === 'new' ? 0 : 1) || freshAt(b) - freshAt(a));
function card(g, opt) {
  const nw = newness(g);
  return h('a', { class: 'card' + (nw ? ' is-' + nw : ''), href: '#/game/' + g.slug, 'aria-label': `${g.title}. ${g.desc}` },
    h('div', { class: 'art' },
      artNode(g),
      g.multiplayer ? h('span', { class: 'mp-badge' }, '👥 Online') : null,
      nw === 'new' ? h('span', { class: 'badge new' }, '🆕 NEW') : nw === 'upd' ? h('span', { class: 'badge upd' }, `✨ UPDATED · v${g.version}`) : null,
      g.lang !== 'English' ? h('span', { class: 'badge lang', title: `In-game text is in ${g.lang}` }, g.lang === 'Korean' ? 'KR' : /English/.test(g.lang) && /Korean/.test(g.lang) ? 'EN · KR' : g.lang) : null),
    h('span', { class: 't', text: g.title }),
    h('span', { class: 'by', text: madeBy(g) }),
    h('span', { class: 's', text: g.cats.slice(0, 2).join(' · ') }),
    opt && opt.notes && g.notes ? h('span', { class: 'whatsnew', text: (nw === 'new' ? 'New! ' : 'What’s new: ') + g.notes }) : null);
}
const fill = (el, games) => el.replaceChildren(...games.map(card));

function catTile(name, img, emoji) {
  const n = MAIN().filter(g => g.cats.includes(name)).length;
  return h('a', { class: 'cat' + (n ? '' : ' none'), href: '#/cat/' + encodeURIComponent(name) },
    CAT_READY.has(img) ? h('img', { src: `${ROOT}img/${img}.webp`, alt: '', loading: 'lazy', onerror: e => e.target.replaceWith(h('span', { class: 'ph', text: emoji })) }) : h('span', { class: 'ph', text: emoji }),
    h('b', { text: name }), h('span', { text: n ? plural(n, 'game') : 'Coming soon' }));
}

/* ---------- hero carousel ---------- */
let heroI = 0, heroT = null, heroPaused = false;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
function buildHero() {
  const fr = freshList().filter(g => wideOf(g)), feat = fr.concat(MAIN().filter(g => wideOf(g) && !fr.includes(g))).slice(0, 6);
  const slides = $('#hero-slides'), picks = $('#hero-picks');
  slides.replaceChildren(...feat.map((g, i) => h('div', { class: 'slide', id: 'slide-' + i, role: 'tabpanel', 'aria-roledescription': 'slide', 'aria-label': `${i + 1} of ${feat.length}: ${g.title}` },
    h('img', { src: wideOf(g), alt: '', loading: i ? 'lazy' : 'eager' }),
    h('div', { class: 'slide-copy' },
      h('span', { class: 'eyebrow' + (newness(g) ? ' fresh' : ''), text: newness(g) === 'new' ? '🆕 New game!' : newness(g) === 'upd' ? '✨ Just updated · v' + g.version : i === 0 ? '★ Featured' : '★ Top pick' }),
      h('h2', { text: g.title }), h('p', { text: g.desc }),
      h('div', { class: 'chips' }, ...g.cats.map(c => h('a', { class: 'chip hero-chip', href: '#/cat/' + encodeURIComponent(c), text: c }))),
      h('div', {}, h('a', { class: 'btn primary', href: '#/game/' + g.slug }, '▶ Play now'))))));
  picks.replaceChildren(...feat.map((g, i) => h('button', { class: 'pick', role: 'tab', 'aria-controls': 'slide-' + i, 'aria-label': g.title, onclick: () => showSlide(i, true) },
    h('img', { src: coverOf(g), alt: '' }))));
  showSlide(0);
  const hero = $('#hero');
  const pause = on => { heroPaused = on; hero.classList.toggle('paused', on); };
  hero.addEventListener('mouseenter', () => pause(true)); hero.addEventListener('mouseleave', () => pause(false));
  hero.addEventListener('focusin', () => pause(true)); hero.addEventListener('focusout', () => pause(false));
  if (!reduced) heroT = setInterval(() => { if (!heroPaused && !document.hidden && !$('#v-home').hidden) showSlide(heroI + 1); }, 7000);
}
function showSlide(i, user) {
  const slides = [...document.querySelectorAll('.slide')], picks = [...document.querySelectorAll('.pick')];
  if (!slides.length) return;
  heroI = (i + slides.length) % slides.length;
  slides.forEach((s, k) => { s.classList.toggle('on', k === heroI); s.toggleAttribute('inert', k !== heroI); });
  picks.forEach((p, k) => { p.setAttribute('aria-selected', String(k === heroI)); p.tabIndex = k === heroI ? 0 : -1; });
  if (user) picks.forEach(p => { if (p.getAttribute('aria-selected') === 'true') { p.style.animation = 'none'; p.offsetHeight; p.style.animation = ''; } });
}
$('#hero-picks').addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); showSlide(heroI + (e.key === 'ArrowRight' ? 1 : -1), true); document.querySelectorAll('.pick')[heroI].focus(); }
});

/* ---------- search (forgiving) ---------- */
const norm = s => s.toLowerCase().replace(/[^a-z0-9가-힣 ]/g, ' ').replace(/\s+/g, ' ').trim();
function near(a, b) { // one typo allowed for words of 4+ letters
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, d = 0;
  while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++d > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } }
  return d + (a.length - i) + (b.length - j) <= 1;
}
function search(q) {
  const words = norm(q).split(' ').filter(Boolean); if (!words.length) return [];
  return GAMES.map(g => {
    const hay = norm(`${g.title} ${g.desc} ${g.cats.join(' ')}`), toks = hay.split(' ');
    let score = 0;
    for (const w of words) {
      if (norm(g.title).includes(w)) score += 3; else if (hay.includes(w)) score += 2;
      else if (w.length >= 4 && toks.some(t => near(w, t.slice(0, w.length + 1)) || near(w, t))) score += 1; else return null;
    }
    return { g, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score).map(x => x.g);
}
const q = $('#q'), sug = $('#suggest');
let sugI = -1;
function renderSuggest() {
  const v = q.value.trim(); const res = v ? search(v).slice(0, 5) : [];
  sugI = -1;
  if (!v) { sug.hidden = true; q.setAttribute('aria-expanded', 'false'); return; }
  sug.replaceChildren(...res.map(g => h('a', { href: '#/game/' + g.slug, role: 'option' }, artNode(g), h('span', {}, g.title, h('small', { text: g.cats.join(' · ') })))),
    h('a', { class: 'all', href: '#/search/' + encodeURIComponent(v), role: 'option' }, res.length ? `See all results for “${v}”` : `No quick match. Search for “${v}”`));
  sug.hidden = false; q.setAttribute('aria-expanded', 'true');
}
q.addEventListener('input', renderSuggest);
q.addEventListener('focus', renderSuggest);
q.addEventListener('keydown', e => {
  const items = [...sug.querySelectorAll('a')];
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); if (!items.length) return;
    sugI = (sugI + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items.forEach((a, k) => a.setAttribute('aria-selected', String(k === sugI)));
  } else if (e.key === 'Enter') {
    e.preventDefault(); const v = q.value.trim(); if (!v) return;
    location.hash = sugI >= 0 ? items[sugI].getAttribute('href') : '#/search/' + encodeURIComponent(v);
    closeSuggest();
  } else if (e.key === 'Escape') closeSuggest();
});
const closeSuggest = () => { sug.hidden = true; q.setAttribute('aria-expanded', 'false'); };
document.addEventListener('click', e => { if (!e.target.closest('.search')) closeSuggest(); });
sug.addEventListener('click', () => { closeSuggest(); q.blur(); });

/* ---------- views ---------- */
const VIEWS = ['home', 'categories', 'list', 'my', 'about', 'game', 'admin', 'submit'];
function show(v, nav) {
  VIEWS.forEach(x => ($('#v-' + x).hidden = x !== v));
  document.querySelectorAll('.nav a').forEach(a => { if (a.dataset.nav === nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  window.scrollTo({ top: 0 });
}
function route() {
  if (!GAMES.length) return;
  closeSuggest();
  const raw = location.hash.replace(/^#\/?/, '');
  let dec; try { dec = decodeURIComponent(raw); } catch { dec = raw; }
  const [p0, ...rest] = dec.split('/');
  const arg = rest.join('/');
  if (p0 !== 'game') stopGame();
  document.title = 'PlayCraft — Free Original Browser Games';
  if (p0 === 'game' && bySlug(arg)) return openGame(bySlug(arg));
  if (p0 === 'categories') { show('categories', 'categories'); return; }
  if (p0 === 'cat') return openList(`${arg} games`, MAIN().filter(g => g.cats.includes(arg)), 'categories');
  if (p0 === 'search' && !arg.trim()) { location.hash = '#/'; return; }
  if (p0 === 'search') { q.value = arg; return openList(`Results for “${arg}”`, search(arg), null, arg); }
  if (p0 === 'my') return openMy();
  if (p0 === 'about') { show('about', 'about'); return; }
  if (p0 === 'submit') return openSubmit();
  if (p0 === 'admin') return openAdmin();
  renderHome(); show('home', 'home');
}
addEventListener('hashchange', route);
addEventListener('hashchange', () => { const d = document.querySelector('#signin'); if (d && d.open) d.close(); });

function renderHome() {
  const played = playedList().map(bySlug).filter(Boolean);
  const fresh = freshList();
  $('#shelf-new').hidden = !fresh.length; $('#row-new').replaceChildren(...fresh.map(g => card(g, { notes: true })));
  $('#shelf-recent').hidden = !played.length; fill($('#row-recent'), played);
  fill($('#grid-all'), MAIN()); $('#all-count').textContent = plural(MAIN().length, 'game');
}
function openList(title, games, nav, term) {
  $('#list-title').textContent = title; $('#list-count').textContent = plural(games.length, 'game');
  fill($('#grid-list'), games);
  $('#list-empty').hidden = games.length > 0;
  if (!games.length) {
    $('#empty-title').textContent = term ? `No games match “${term}” yet.` : 'No games in this category yet. More are on the way!';
    $('#empty-chips').replaceChildren(...['Space', 'Fighting', 'Action', 'Adventure'].map(c => h('a', { class: 'chip', href: '#/cat/' + c, text: c })));
  }
  show('list', nav);
}
let myRefreshing = false;
function openMy(fromRefresh) {
  if (!fromRefresh && signedIn() && !myRefreshing) { myRefreshing = true; refreshAccountData().then(() => { myRefreshing = false; if (!$('#v-my').hidden) openMy(true); }); }
  const saved = savedList().map(bySlug).filter(Boolean), played = playedList().map(bySlug).filter(Boolean);
  fill($('#grid-saved'), saved); fill($('#grid-played'), played);
  renderMySubs();
  const acc = $('#my-account'); acc.hidden = !signedIn();
  if (signedIn() && ACC.profile) { $('#ma-id').textContent = ACC.profile.username; $('#ma-nick').textContent = ACC.profile.nickname; $('#ma-age').textContent = ACC.profile.age ? (ACC.profile.age >= 18 ? '18+' : String(ACC.profile.age)) : '—'; }
  $('#my-paused').hidden = !(signedIn() && ACC.profile && ACC.profile.blocked);
  const st = $('#my-stats'), on = signedIn() && cloudStats;
  $('#my-lead').hidden = signedIn();
  st.hidden = !on;
  if (on) {
    const fav = [...cloudStats.games].sort((a, b) => b.seconds - a.seconds)[0];
    st.replaceChildren(
      h('div', { class: 'stat' }, h('b', { text: fmtTime(cloudStats.totalSeconds) }), h('span', { text: 'Total play time' })),
      h('div', { class: 'stat' }, h('b', { text: String(cloudStats.totalPlays) }), h('span', { text: cloudStats.totalPlays === 1 ? 'Game played' : 'Games played' })),
      h('div', { class: 'stat' }, h('b', { text: String(cloudStats.games.length) }), h('span', { text: 'Different games tried' })),
      fav && bySlug(fav.slug) ? h('div', { class: 'stat' }, h('b', { text: bySlug(fav.slug).title }), h('span', { text: 'Your most played' })) : null);
    // add per-game records under each played card
    [...$('#grid-played').children].forEach((el, k) => { const r = cloudStats.games.find(x => x.slug === played[k].slug); if (r) el.append(h('span', { class: 'rec', text: `${r.plays}× · ${fmtTime(r.seconds)} · last ${new Date(r.last).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` })); });
  }
  document.querySelectorAll('#v-my h2.sub').forEach((el, i) => (el.hidden = !(i ? played.length : saved.length)));
  $('#my-empty').hidden = saved.length + played.length > 0;
  show('my', 'my');
}

/* ---------- game page ---------- */
let current = null, playing = false;
function openGame(g) {
  if (current !== g) stopGame();
  current = g; document.title = `${g.title} · PlayCraft`;
  $('#crumbs').replaceChildren(h('a', { href: '#/', text: 'Home' }), h('span', { 'aria-hidden': 'true', text: '›' }), h('a', { href: '#/cat/' + encodeURIComponent(g.cats[0]), text: g.cats[0] }), h('span', { 'aria-hidden': 'true', text: '›' }), h('span', { 'aria-current': 'page', text: g.title }));
  const wb = wideOf(g); $('#start-bg').hidden = !wb; if (wb) $('#start-bg').src = wb;
  $('#start').style.cssText = wb ? '' : genBg(g.slug);
  $('#g-title').textContent = g.title; $('#g-desc').textContent = g.desc;
  const touch = matchMedia('(pointer: coarse)').matches;
  $('#start-note').textContent = touch ? (g.mobile ? 'Tip: tap ⛶ Big screen for the best view.' : 'This game needs a keyboard and mouse. It works best on a computer.')
    : 'Tip: click inside the game first so it can hear your keys.';
  $('#start-note').classList.toggle('mobile-note', touch && !g.mobile);
  $('#keys').replaceChildren(...(g.controls && g.controls.length ? g.controls.map(([k, a]) => h('li', {}, h('kbd', { text: k }), h('span', { text: a }))) : [h('li', { class: 'note', text: 'This game explains its controls when it starts.' })]));
  $('#tip').textContent = g.tip || ''; $('#tip').hidden = !g.tip;
  $('#device').textContent = g.mobile ? '📱 Works on a computer or a touch screen.' : '⌨️ Best on a computer with a keyboard and mouse.';
  const cu = coverOf(g); $('#g-cover').hidden = !cu; if (cu) $('#g-cover').src = cu;
  $('#g-name').textContent = g.title;
  $('#g-meta').textContent = `${madeBy(g)} · v${g.version} · ${g.cats.join(', ')}${g.multiplayer ? ' · 👥 Online' : ''}`;
  const alt = GAMES.find(x => x.variantOf === g.slug) || bySlug(g.variantOf);
  const meta = $('#g-meta'); meta.querySelectorAll('.alt-lang').forEach(n => n.remove());
  if (alt) meta.append(' · ', h('a', { class: 'alt-lang', href: '#/game/' + alt.slug, text: alt.lang === 'Korean' ? '🇰🇷 Play in Korean' : '🇺🇸 Play in English' }));
  syncSave();
  const next = MAIN().filter(x => x !== g && x.slug !== g.variantOf && x.variantOf !== g.slug)
    .sort((a, b) => b.cats.filter(c => g.cats.includes(c)).length - a.cats.filter(c => g.cats.includes(c)).length);
  fill($('#row-next'), next);
  $('#versions').replaceChildren(h('li', {}, h('span', { class: 'v', text: 'v' + g.version }), h('span', { class: 'd', text: new Date((g.updated || g.added) + 'T12:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) }), h('span', { class: 'n', text: g.notes })));
  show('game', null);
}
function syncSave() { const on = current && isSaved(current.slug); const b = $('#save-btn'); b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '♥ Saved' : '♡ Save'; }
function playGame() {
  if (!current) return;
  const st = $('#stage'); st.querySelectorAll('iframe').forEach(f => f.remove());
  let f;
  if (current.community) {
    f = h('iframe', { sandbox: 'allow-scripts allow-pointer-lock', allow: 'autoplay; gamepad', title: current.title });
    fetch(current.fileUrl, { cache: 'no-cache' }).then(r => r.text()).then(html => { f.srcdoc = SANDBOX_SHIM + html; }).catch(() => toast('We couldn’t load this game. Try again.'));
  } else f = h('iframe', { src: `${ROOT}games/${current.slug}/?v=${encodeURIComponent(current.version || 1)}`, allow: 'autoplay; fullscreen; gamepad', title: current.title });
  $('#start').hidden = true; st.append(f); fitFrame(); playing = true; markPlayed(current.slug); beginSession(current.slug);
  setTimeout(() => f.focus(), 400);
}
// Games are designed for a full desktop window. When the player box is smaller than 1280×720,
// render the game at that size and scale it down so nothing gets cut off.
const MIN_W = 1280, MIN_H = 720;
const SMALL = () => window.innerWidth < 860;
function fitFrame() {
  const st = $('#stage'), f = st && st.querySelector('iframe'); if (!f) return;
  const top = st.classList.contains('full') ? (st.querySelector('.big-bar')?.offsetHeight || 0) : 0;
  const w = st.clientWidth, hgt = st.clientHeight - top;
  const s = SMALL() ? 1 : Math.min(1, w / MIN_W, hgt / MIN_H);
  f.style.width = (w / s) + 'px'; f.style.height = (hgt / s) + 'px';
  f.style.transform = s < 1 ? `scale(${s})` : ''; f.style.transformOrigin = '0 0';
  f.style.top = top + 'px'; f.style.left = '0';
}
new ResizeObserver(fitFrame).observe(document.querySelector('#stage'));
// Player-made games can't use the site's storage inside the sandbox, so give them a temporary one.
const SANDBOX_SHIM = '<script>(function(){var m={};var s={getItem:function(k){return Object.prototype.hasOwnProperty.call(m,k)?m[k]:null},setItem:function(k,v){m[k]=String(v)},removeItem:function(k){delete m[k]},clear:function(){m={}},key:function(i){return Object.keys(m)[i]||null},get length(){return Object.keys(m).length}};try{window.localStorage.getItem("x")}catch(e){try{Object.defineProperty(window,"localStorage",{value:s});Object.defineProperty(window,"sessionStorage",{value:s})}catch(_){}}})();<\/script>';
function stopGame() { endSession(); const st = $('#stage'); st.querySelectorAll('iframe').forEach(f => f.remove()); $('#start').hidden = false; playing = false; setFull(false); }
// "Big screen": the game fills the browser window, with a slim bar ABOVE the game (never on top of it).
// We don't use the browser's own full screen, because there Esc both frees the mouse and exits full screen.
// Here Esc belongs to the game only.
let bar = null;
function setFull(on) {
  const st = $('#stage'); if (!st) return;
  st.classList.toggle('full', on); document.body.style.overflow = on ? 'hidden' : '';
  $('#full-btn').textContent = '⛶ Big screen';
  if (on && !bar) {
    bar = h('div', { class: 'big-bar' },
      h('strong', { text: current ? current.title : '' }),
      h('span', { class: 'hint', text: 'Esc is for the game (it frees the mouse). Use the button to leave big screen.' }),
      h('button', { class: 'btn primary small', onclick: () => setFull(false) }, '✕ Small screen'));
    st.prepend(bar); fitFrame();
    setTimeout(() => { const f = st.querySelector('iframe'); if (f) f.focus(); }, 100);
  }
  if (!on && bar) { bar.remove(); bar = null; }
  requestAnimationFrame(fitFrame);
}
$('#play-btn').addEventListener('click', playGame);
$('#restart-btn').addEventListener('click', () => { if (playing) playGame(); else playGame(); });
$('#full-btn').addEventListener('click', () => { if (!playing) playGame(); setFull(true); });
$('#save-btn').addEventListener('click', () => { if (!current) return; const on = toggleSave(current.slug); syncSave(); toast(on ? 'Saved to My Games ♥' : 'Removed from My Games'); });
$('#share-btn').addEventListener('click', async () => {
  const url = location.href;
  try { await navigator.clipboard.writeText(url); toast('Link copied! Paste it to share this game.'); }
  catch { toast('Copy this link from the address bar to share.'); }
});

/* ---------- play sessions (signed-in players) ---------- */
// Counts time while the game is open and the tab is visible; saves every 20 s and when the game closes.
let sess = null;
async function beginSession(slug) {
  endSession();
  if (!signedIn()) return;
  const s = { slug, id: null, secs: 0, last: Date.now() }; sess = s;
  s.timer = setInterval(() => { tick(s); if (s.id) ACC.updatePlay(s.id, s.secs).catch(() => {}); }, 20000);
  s.id = await ACC.startPlay(slug).catch(() => null);
  if (sess !== s && s.id) ACC.updatePlay(s.id, s.secs).catch(() => {}); // the game was closed while we were starting
}
function tick(s) { const now = Date.now(); if (!document.hidden) s.secs += (now - s.last) / 1000; s.last = now; }
function endSession() {
  const s = sess; if (!s) return; sess = null; clearInterval(s.timer); tick(s);
  if (s.id) ACC.updatePlay(s.id, s.secs).then(() => refreshAccountData()).then(() => { if (!$('#v-my').hidden) openMy(true); if (!$('#v-home').hidden) renderHome(); }).catch(() => {});
}
document.addEventListener('visibilitychange', () => { if (!sess) return; if (document.hidden) { tick(sess); if (sess.id) ACC.updatePlay(sess.id, sess.secs).catch(() => {}); } else sess.last = Date.now(); });
addEventListener('pagehide', () => { if (sess && sess.id) { tick(sess); ACC.updatePlayOnExit(sess.id, sess.secs); } });

/* ---------- sign in / create account ---------- */
const dlg = $('#signin');
function setTab(up) {
  $('#tab-in').setAttribute('aria-selected', String(!up)); $('#tab-up').setAttribute('aria-selected', String(up));
  $('#si-form').hidden = up; $('#su-form').hidden = !up;
  setTimeout(() => (up ? $('#su-id') : $('#si-id')).focus(), 30);
}
function openSignIn(up) {
  $('#si-err').hidden = true; $('#su-err').hidden = true; $('#si-pw').value = '';
  if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  setTab(!!up);
}
$('#tab-in').addEventListener('click', () => setTab(false));
$('#tab-up').addEventListener('click', () => setTab(true));
$('#go-up').addEventListener('click', e => { e.preventDefault(); setTab(true); });
document.querySelectorAll('.si-cancel').forEach(b => b.addEventListener('click', () => dlg.close()));
$('#si-form').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('#si-err'), go = $('#si-go'); err.hidden = true; go.disabled = true; go.textContent = 'Signing in…';
  try {
    await ACC.signIn($('#si-id').value, $('#si-pw').value);
    dlg.close(); toast('Welcome back! Your records are saved to your account now.');
  } catch (x) {
    err.textContent = x && x.message === 'bad-id' ? 'IDs use only letters, numbers, dots, dashes or underscores.'
      : x && x.message === 'offline' ? 'We can’t reach the sign-in service. Check your internet and try again.'
      : 'That ID and password don’t match. Check them and try again.';
    err.hidden = false;
  }
  go.disabled = false; go.textContent = 'Sign in';
});

// eye buttons: show / hide what was typed in a password box
document.querySelectorAll('.eye').forEach(b => b.addEventListener('click', () => {
  const inp = document.getElementById(b.dataset.for), show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  b.setAttribute('aria-pressed', String(show)); b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  inp.focus();
}));
// hide old error messages as soon as the player changes something
$('#si-form').addEventListener('input', () => ($('#si-err').hidden = true));
$('#su-form').addEventListener('input', () => ($('#su-err').hidden = true));
dlg.addEventListener('close', () => document.querySelectorAll('.eye').forEach(b => { const i = document.getElementById(b.dataset.for); i.type = 'password'; b.setAttribute('aria-pressed', 'false'); }));

// sign-up form
const ageSel = $('#su-age');
for (let a = 6; a <= 17; a++) ageSel.append(h('option', { value: a, text: `${a}` }));
ageSel.append(h('option', { value: 18, text: '18 or older' }));
const RULES = { len: p => p.length >= 8, letter: p => /[A-Za-z]/.test(p), num: p => /[0-9]/.test(p), sym: p => /[^A-Za-z0-9\s]/.test(p) };
const pwOk = p => Object.values(RULES).every(f => f(p));
$('#su-pw').addEventListener('input', () => { const p = $('#su-pw').value; document.querySelectorAll('#pw-rules li').forEach(li => li.classList.toggle('ok', RULES[li.dataset.r](p))); });
function checkMatch() {
  const a = $('#su-pw').value, b = $('#su-pw2').value, hint = $('#su-pw2-hint');
  hint.className = 'hint';
  if (!b) { hint.textContent = ''; return; }
  const ok = a === b; hint.textContent = ok ? '✓ Passwords match.' : '✗ Not the same yet.'; hint.classList.add(ok ? 'good' : 'bad');
}
$('#su-pw').addEventListener('input', checkMatch); $('#su-pw2').addEventListener('input', checkMatch);
ageSel.addEventListener('change', () => { const a = +ageSel.value; $('#su-guardian-row').hidden = !(a && a < 14); });
const ID_RE = /^[a-z0-9][a-z0-9._-]{2,19}$/;
let idTimer;
$('#su-id').addEventListener('input', () => {
  const v = $('#su-id').value.trim().toLowerCase(), hint = $('#su-id-hint');
  clearTimeout(idTimer); hint.className = 'hint'; hint.textContent = '';
  if (!v) return;
  if (!ID_RE.test(v)) { hint.textContent = 'Use 3–20 letters or numbers (you can also use . _ -). Start with a letter or number.'; hint.classList.add('bad'); return; }
  idTimer = setTimeout(async () => { const ok = await ACC.idAvailable(v); if ($('#su-id').value.trim().toLowerCase() !== v) return; hint.textContent = ok ? '✓ This ID is free.' : '✗ Someone already has this ID. Try another one.'; hint.classList.add(ok ? 'good' : 'bad'); }, 350);
});
$('#su-form').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('#su-err'), go = $('#su-go'), say = m => { err.textContent = m; err.hidden = false; };
  err.hidden = true;
  const id = $('#su-id').value.trim().toLowerCase(), nick = $('#su-nick').value.trim(), age = +ageSel.value, pw = $('#su-pw').value;
  if (!ID_RE.test(id)) return say('Please choose an ID with 3–20 letters or numbers.');
  if (nick.length < 2) return say('Please choose a nickname with at least 2 characters.');
  if (!age) return say('Please choose your age.');
  if (age < 14 && !$('#su-guardian').checked) return say('Because you’re under 14, a parent or guardian needs to say it’s OK. Ask them, then tick the box.');
  if (!pwOk(pw)) return say('Your password needs at least 8 characters with a letter, a number and a special character.');
  if (pw !== $('#su-pw2').value) return say('The two passwords don’t match. Type them again.');
  if (pw.toLowerCase().includes(id)) return say('Your password can’t contain your ID.');
  go.disabled = true; go.textContent = 'Creating…';
  try {
    if (!(await ACC.idAvailable(id))) { say('Someone already has this ID. Try another one.'); }
    else {
      await ACC.signUp({ id, password: pw, nickname: nick, age, guardianOk: $('#su-guardian').checked });
      dlg.close(); $('#su-form').reset(); document.querySelectorAll('#pw-rules li').forEach(li => li.classList.remove('ok')); $('#su-pw2-hint').textContent = '';
      toast(`Welcome to PlayCraft, ${nick}! 🎉`);
    }
  } catch (x) {
    const m = (x && x.message || '').toLowerCase();
    say(m.includes('already') ? 'Someone already has this ID. Try another one.'
      : m.includes('password') ? 'That password is too easy to guess. Try a longer one.'
      : m.includes('rate') ? 'Too many tries right now. Wait a minute and try again.'
      : 'We couldn’t create your account. Check your internet and try again.');
  }
  go.disabled = false; go.textContent = 'Create account';
});
const menu = $('#acct-menu');
$('#acct-btn').addEventListener('click', e => {
  e.stopPropagation();
  if (!signedIn()) return ACC ? openSignIn(false) : toast('Sign-in isn’t available right now.');
  menu.hidden = !menu.hidden;
});
document.addEventListener('click', e => { if (!e.target.closest('.acct')) menu.hidden = true; });
menu.addEventListener('click', () => (menu.hidden = true));
$('#signout-btn').addEventListener('click', async () => { endSession(); await ACC.signOut(); toast('Signed out.'); });
$('#my-signin').addEventListener('click', e => { e.preventDefault(); openSignIn(false); });
function renderAccount() {
  const b = $('#acct-btn'), on = signedIn();
  b.classList.toggle('on', on);
  $('#acct-label').textContent = on ? (ACC.profile ? ACC.profile.nickname : 'Me') : 'Sign in';
  $('#admin-link').hidden = !(on && ACC.profile && ACC.profile.is_admin);
  if (on) { $('#acct-nick').textContent = ACC.profile ? ACC.profile.nickname : ''; $('#acct-id').textContent = 'ID: ' + (ACC.profile ? ACC.profile.username : ''); }
}
let mergedOnce = false;
if (ACC) ACC.onChange(async () => {
  renderAccount();
  if (signedIn() && !mergedOnce) { // bring games saved on this device into the account, once
    mergedOnce = true; const local = store.get('saved');
    await refreshAccountData();
    for (const s of local) if (!cloudSaved.includes(s)) { await ACC.setSaved(s, true).catch(() => {}); cloudSaved.push(s); }
    store.set('saved', []); store.set('played', []);
  } else await refreshAccountData();
  if (!signedIn()) mergedOnce = false;
  if (GAMES.length) { if (current) syncSave(); if (!$('#v-home').hidden) renderHome(); if (!$('#v-my').hidden) openMy(); if (!$('#v-admin').hidden) openAdmin(); }
});
renderAccount();

/* ---------- admin page ---------- */
let admData = null;
async function openAdmin() {
  show('admin', null);
  const isAdm = signedIn() && ACC.profile && ACC.profile.is_admin;
  $('#adm-denied').hidden = !!isAdm; $('#adm-body').hidden = !isAdm;
  if (!isAdm) return;
  renderReview(); renderDaily();
  try { admData = await ACC.adminData(); } catch { toast('Couldn’t load admin data. Try Refresh.'); return; }
  renderAdmin();
}
function renderAdmin() {
  if (!admData) return;
  const { profiles, userStats, gameStats, totals } = admData, now = Date.now(), WEEKMS = 7 * 864e5;
  const per = {}; for (const u of userStats) per[u.user_id] = { plays: Number(u.plays), secs: Number(u.seconds), last: u.last_played };
  const totalSecs = Number(totals.seconds || 0), activeWeek = Number(totals.active_week || 0), totalPlays = Number(totals.plays || 0);
  $('#adm-stats').replaceChildren(
    h('div', { class: 'stat' }, h('b', { text: String(profiles.length) }), h('span', { text: 'Players signed up' })),
    h('div', { class: 'stat' }, h('b', { text: String(profiles.filter(p => now - Date.parse(p.created_at) < WEEKMS).length) }), h('span', { text: 'New this week' })),
    h('div', { class: 'stat' }, h('b', { text: String(activeWeek) }), h('span', { text: 'Played this week' })),
    h('div', { class: 'stat' }, h('b', { text: String(totalPlays) }), h('span', { text: 'Games played' })),
    h('div', { class: 'stat' }, h('b', { text: fmtTime(totalSecs) }), h('span', { text: 'Total play time' })));
  const gRows = gameStats.map(g => [g.game_slug, Number(g.plays), Number(g.players), Number(g.seconds)]).sort((a, b) => b[1] - a[1]); const gMax = Math.max(1, ...gRows.map(r => r[1]));
  $('#adm-games').replaceChildren(...(gRows.length ? gRows.map(([s, n, pl, sec]) => statBar(bySlug(s) ? bySlug(s).title : s, n, gMax, `${plural(n, 'play')} · ${plural(pl, 'player')} · ${fmtTime(sec)}`)) : [h('li', { class: 'note', text: 'No plays yet.' })]));
  const bands = [['6–9', a => a <= 9], ['10–12', a => a >= 10 && a <= 12], ['13–15', a => a >= 13 && a <= 15], ['16–17', a => a >= 16 && a <= 17], ['18+', a => a >= 18]];
  const aRows = bands.map(([l, f]) => [l, profiles.filter(p => p.age && f(p.age)).length]); const aMax = Math.max(1, ...aRows.map(r => r[1]));
  $('#adm-ages').replaceChildren(...aRows.map(([l, n]) => statBar(l, n, aMax, plural(n, 'player'))));
  const q = ($('#adm-q').value || '').trim().toLowerCase();
  const list = profiles.filter(p => !q || p.username.includes(q) || (p.nickname || '').toLowerCase().includes(q));
  $('#adm-count').textContent = `${list.length} of ${profiles.length}`;
  const me = ACC.user && ACC.user.id, d = t => t ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  $('#adm-rows').replaceChildren(...list.map(p => {
    const u = per[p.id] || { plays: 0, secs: 0, last: null };
    const status = p.blocked ? h('span', { class: 'pill bad', text: 'Paused' }) : p.is_admin ? h('span', { class: 'pill adm', text: 'Admin' }) : h('span', { class: 'pill ok', text: 'Active' });
    const acts = h('div', { class: 'acts' });
    acts.append(h('button', { class: 'btn primary tiny', onclick: () => openPlayLog(p) }, 'Play log'));
    if (p.id !== me) {
      acts.append(h('button', { class: 'btn ghost tiny', onclick: () => adminAct(p, 'block') }, p.blocked ? 'Unpause' : 'Pause'));
      acts.append(h('button', { class: 'btn ghost tiny', onclick: () => adminAct(p, 'admin') }, p.is_admin ? 'Remove admin' : 'Make admin'));
      acts.append(h('button', { class: 'btn ghost tiny', onclick: () => resetPw(p) }, 'Reset password'));
    } else acts.append(h('span', { class: 'note', text: 'You' }));
    return h('tr', {}, h('td', { class: 'mono', text: p.username }), h('td', { text: p.nickname }),
      h('td', {}, p.age ? String(p.age >= 18 ? '18+' : p.age) : '—', p.age && p.age < 14 ? h('span', { class: 'g', title: 'Guardian OK ticked at sign-up', text: p.guardian_ok ? ' ✓G' : ' !G' }) : null),
      h('td', { text: d(p.created_at) }), h('td', { text: d(u.last) }), h('td', { text: String(u.plays) }), h('td', { text: fmtTime(u.secs) }), h('td', {}, status), h('td', {}, acts));
  }));
}
// Admin: when and how long one player played each game, grouped by day (shown in the viewer's local time)
async function openPlayLog(p) {
  const box = $('#adm-log'); box.hidden = false; $('#adm-log-who').textContent = p.username; $('#adm-log-sum').textContent = '';
  $('#adm-log-body').replaceChildren(h('p', { class: 'note', text: 'Loading…' })); box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  let rows; try { rows = await ACC.adminUserPlays(p.id); } catch (x) { $('#adm-log-body').replaceChildren(h('p', { class: 'note', text: 'Couldn’t load the play log: ' + ((x && x.message) || 'try again') })); return; }
  if (!rows.length) { $('#adm-log-body').replaceChildren(h('p', { class: 'note', text: `${p.username} hasn’t played anything yet.` })); return; }
  const dayKey = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const dayLabel = t => new Date(t).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const clock = t => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const dur = s => (s > 0 ? fmtTime(s) : '<1 min / still open');
  const days = []; const byDay = {};
  for (const r of rows) { const k = dayKey(r.started_at); if (!byDay[k]) { byDay[k] = { label: dayLabel(r.started_at), rows: [], secs: 0, games: {} }; days.push(byDay[k]); } const D = byDay[k]; D.rows.push(r); D.secs += Number(r.seconds) || 0; D.games[r.game_slug] = (D.games[r.game_slug] || 0) + (Number(r.seconds) || 0); }
  const total = rows.reduce((a, r) => a + (Number(r.seconds) || 0), 0);
  $('#adm-log-sum').textContent = `${plural(rows.length, 'play')} · ${fmtTime(total)}${rows.length >= 500 ? ' (latest 500)' : ''}`;
  const title = s => (bySlug(s) ? bySlug(s).title : s);
  $('#adm-log-body').replaceChildren(...days.map(D => h('div', { class: 'log-day' },
    h('h3', {}, D.label, h('span', { class: 'note', text: ` · ${fmtTime(D.secs)} · ` + Object.entries(D.games).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]).map(([g, s]) => `${title(g)} ${fmtTime(s)}`).join(', ') })),
    h('div', { class: 'table-wrap' }, h('table', { class: 'adm-table log-table' },
      h('thead', {}, h('tr', {}, h('th', { text: 'Started' }), h('th', { text: 'Ended' }), h('th', { text: 'Game' }), h('th', { text: 'Time played' }))),
      h('tbody', {}, ...D.rows.map(r => { const s = Number(r.seconds) || 0; return h('tr', {}, h('td', { text: clock(r.started_at) }), h('td', { text: s > 0 ? clock(Date.parse(r.started_at) + s * 1000) : '—' }), h('td', { text: title(r.game_slug) }), h('td', { text: dur(s) })); })))))));
}
function statBar(label, n, max, title) {
  return h('li', {}, h('span', { class: 'bl', text: label }), h('span', { class: 'bt' }, h('span', { class: 'bf', style: `width:${Math.round(n / max * 100)}%` })), h('span', { class: 'bn', text: String(n), title }));
}
// Small confirm step built into the page (the browser’s confirm() is not used)
async function adminAct(p, kind) {
  const label = kind === 'block' ? (p.blocked ? `Unpause ${p.username}?` : `Pause ${p.username}? They can still sign in but their plays won’t be recorded.`) : (p.is_admin ? `Remove admin from ${p.username}?` : `Make ${p.username} an admin? Admins can see every player’s records.`);
  if (!(await ask(label))) return;
  try {
    if (kind === 'block') await ACC.adminSetBlocked(p.id, !p.blocked); else await ACC.adminSetAdmin(p.id, !p.is_admin);
    toast('Done.'); admData = await ACC.adminData(); renderAdmin();
  } catch (x) { toast('That didn’t work: ' + ((x && x.message) || 'try again')); }
}
// Give a player who forgot their password a temporary one (shown once, for the admin to pass on)
async function resetPw(p) {
  const pw = await askText(`New temporary password for ${p.username}. Tell them in person, and ask them to remember it.`, makeTempPw());
  if (!pw) return;
  try { await ACC.adminResetPassword(p.id, pw); toast(`Password for ${p.username} changed.`); }
  catch (x) { toast('That didn’t work: ' + ((x && x.message) || 'try again')); }
}
function makeTempPw() {
  const words = ['Rocket', 'Comet', 'Tiger', 'Pixel', 'Planet', 'Dragon', 'Falcon', 'Nova'], sym = '!@#$%';
  const r = n => Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * n);
  return words[r(words.length)] + (100 + r(900)) + sym[r(sym.length)];
}
function askText(text, value) {
  return new Promise(res => {
    const inp = h('input', { type: 'text', value, 'aria-label': 'New password', class: 'ask-input' });
    const d = h('dialog', { class: 'confirm' }, h('p', { text }), inp, h('div', { class: 'si-actions' },
      h('button', { class: 'btn ghost', onclick: () => { d.close(); res(null); } }, 'Cancel'),
      h('button', { class: 'btn primary', onclick: () => { const v = inp.value.trim(); d.close(); res(v || null); } }, 'Set password')));
    d.addEventListener('close', () => setTimeout(() => d.remove(), 0)); document.body.append(d); d.showModal(); inp.select();
  });
}
function ask(text) {
  return new Promise(res => {
    const d = h('dialog', { class: 'confirm' }, h('p', { text }), h('div', { class: 'si-actions' },
      h('button', { class: 'btn ghost', onclick: () => { d.close(); res(false); } }, 'Cancel'),
      h('button', { class: 'btn primary', onclick: () => { d.close(); res(true); } }, 'Yes, do it')));
    d.addEventListener('close', () => setTimeout(() => d.remove(), 0)); document.body.append(d); d.showModal();
  });
}
$('#adm-q').addEventListener('input', renderAdmin);
$('#ma-delete').addEventListener('click', async () => {
  if (!(await ask('Delete your PlayCraft account? Your ID, nickname, saved games and play records will be gone for good. This can’t be undone.'))) return;
  try { endSession(); await ACC.deleteMyAccount(); toast('Your account was deleted.'); location.hash = '#/'; }
  catch { toast('We couldn’t delete your account. Check your internet and try again.'); }
});
$('#adm-refresh').addEventListener('click', openAdmin);
$('#adm-log-close').addEventListener('click', () => { $('#adm-log').hidden = true; });

document.addEventListener('click', e => {
  const a = e.target.closest('a.back'); if (!a) return;
  // 게임 안에서 생긴 기록(iframe 해시 이동)까지 되돌리지 않도록, 항상 목록 화면으로 바로 이동
  e.preventDefault(); const to = a.getAttribute('href') || '#/';
  if (location.hash === to || (to === '#/' && (location.hash === '' || location.hash === '#'))) route(); else location.hash = to;
  try { scrollTo({ top: 0 }); } catch {}
});
addEventListener('hashchange', () => { try { sessionStorage.setItem('pc.nav', '1'); } catch {} });

/* ---------- submit a game ---------- */
const gCat = $('#g-cat-in'); CATS.forEach(([n]) => gCat.append(h('option', { value: n, text: n })));
function openSubmit() {
  show('submit', null);
  const on = signedIn();
  $('#sub-signin').hidden = on; $('#game-form').hidden = !on;
  if (on && ACC.profile) $('#sub-me').textContent = ACC.profile.username;
}
$('#sub-signin-btn').addEventListener('click', () => openSignIn(true));
$('#game-form').addEventListener('input', () => ($('#g-err').hidden = true));
$('#game-form').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('#g-err'), say = m => { err.textContent = m; err.hidden = false; }, go = $('#g-go');
  const title = $('#g-title-in').value.trim(), desc = $('#g-desc-in').value.trim(), file = $('#g-file-in').files[0], cover = $('#g-cover-in').files[0];
  if (title.length < 2) return say('Give your game a name (at least 2 letters).');
  if (!file) return say('Choose your game’s .html file.');
  if (!/\.html?$/i.test(file.name)) return say('The game file must end in .html');
  if (file.size > 2 * 1024 * 1024) return say('The game file is bigger than 2 MB. Try making it smaller.');
  if (cover && (!/^image\/(png|jpeg|webp)$/.test(cover.type) || cover.size > 2 * 1024 * 1024)) return say('The cover must be a PNG, JPG or WebP picture under 2 MB.');
  if (!$('#g-own-in').checked) return say('Please tick the box to confirm you made this game yourself.');
  if (ACC.profile && ACC.profile.blocked) return say('Your account is paused, so you can’t send games right now.');
  go.disabled = true; go.textContent = 'Sending…';
  try {
    await ACC.submitGame({ title, description: desc, category: gCat.value, multiplayer: $('#g-mp-in').checked, file, cover });
    $('#game-form').reset(); toast('Sent! An admin will check your game soon. 🎉'); location.hash = '#/my';
  } catch (x) { say((x && x.message && !/fetch|network/i.test(x.message)) ? x.message : 'We couldn’t send your game. Check your internet and try again.'); }
  go.disabled = false; go.textContent = '📤 Send for review';
});
async function renderMySubs() {
  const box = $('#my-subs'); if (!signedIn()) { box.hidden = true; return; }
  const list = await ACC.myGames().catch(() => []);
  box.hidden = false;
  const label = { pending: ['wait', '⏳ Waiting for review'], approved: ['ok', '✓ Live on PlayCraft'], rejected: ['bad', '✗ Not approved'] };
  $('#sub-list').replaceChildren(...(list.length ? list.map(g => h('li', {},
    h('span', { class: 't' }, g.title, h('small', { text: g.review_note ? `Admin note: ${g.review_note}` : new Date(g.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) })),
    h('span', { class: 'pill ' + label[g.status][0], text: label[g.status][1] }),
    g.status === 'approved' ? h('a', { class: 'btn ghost tiny', href: '#/game/' + g.slug }, 'Play') : null,
    g.status === 'pending' ? h('button', { class: 'btn ghost tiny', onclick: async () => { if (await ask(`Take back “${g.title}”? It will be removed from the review list.`)) { await ACC.withdrawGame(g).catch(() => toast('Couldn’t remove it.')); renderMySubs(); } } }, 'Take back') : null))
    : [h('li', {}, h('span', { class: 't', text: 'You haven’t sent a game yet.' }), h('a', { class: 'btn primary tiny', href: '#/submit' }, 'Submit one'))]));
}
async function renderReview() {
  const list = await ACC.adminPendingGames().catch(() => []);
  $('#adm-review-count').textContent = list.length ? `${list.length} waiting` : '';
  $('#adm-review').replaceChildren(...(list.length ? list.map(g => h('li', {},
    h('span', { class: 't' }, g.title, h('small', { text: `Made by ${g.creator_username} · ${g.category}${g.multiplayer ? ' · online' : ''} · ${g.description || ''}` })),
    h('button', { class: 'btn ghost tiny', onclick: () => previewGame(g) }, '▶ Try it'),
    h('button', { class: 'btn primary tiny', onclick: async () => { if (!(await ask(`Publish “${g.title}” by ${g.creator_username}? Everyone will be able to play it.`))) return; try { await ACC.adminApprove(g); toast('Published!'); renderReview(); } catch (x) { toast('Couldn’t publish: ' + (x.message || 'try again')); } } }, 'Approve'),
    h('button', { class: 'btn ghost tiny', onclick: async () => { const note = await askText(`Why isn’t “${g.title}” ready? ${g.creator_username} will see this note.`, 'Please fix: '); if (note === null) return; try { await ACC.adminReject(g, note); toast('Sent back with your note.'); renderReview(); } catch (x) { toast('Couldn’t update: ' + (x.message || 'try again')); } } }, 'Send back')))
    : [h('li', { class: 'note', text: 'No games waiting. 🎉' })]));
  renderHistory();
}
async function renderHistory() {
  const list = await ACC.adminReviewedGames().catch(() => null);
  if (!list) { $('#adm-history').replaceChildren(h('li', { class: 'note', text: 'Couldn’t load the history.' })); return; }
  const d = t => t ? new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
  $('#adm-hist-count').textContent = list.length ? `${list.filter(g => g.status === 'approved').length} approved · ${list.filter(g => g.status === 'rejected').length} sent back` : '';
  $('#adm-history').replaceChildren(...(list.length ? list.map(g => h('li', {},
    h('span', { class: 'pill ' + (g.status === 'approved' ? 'ok' : 'bad'), text: g.status === 'approved' ? '✓ Approved' : '↩ Sent back' }),
    h('span', { class: 't' }, g.title, h('small', { text: `Made by ${g.creator_username || '—'} · ${g.category} · sent ${d(g.created_at)} · decided ${d(g.reviewed_at)}${g.review_note ? ' · Note: ' + g.review_note : ''}` })),
    g.status === 'approved' ? h('a', { class: 'btn ghost tiny', href: '#/game/' + g.slug }, 'Play') : null))
    : [h('li', { class: 'note', text: 'No games approved or sent back yet.' })]));
}
let dailyDays = 14;
const DCOL = ['#6d28d9', '#f97316', '#10b981', '#3b82f6', '#ec4899', '#eab308', '#14b8a6', '#ef4444', '#8b5cf6', '#84cc16', '#0ea5e9', '#f43f5e'];
async function renderDaily() {
  const box = $('#adm-daily'), leg = $('#adm-daily-legend');
  document.querySelectorAll('#adm-daily-wrap [data-days]').forEach(b => b.classList.toggle('on', +b.dataset.days === dailyDays));
  box.replaceChildren(h('p', { class: 'note', text: 'Loading…' })); leg.replaceChildren();
  let rows; try { rows = await ACC.adminDailyMinutes(dailyDays); } catch { box.replaceChildren(h('p', { class: 'note', text: 'Couldn’t load the chart.' })); return; }
  const key = dt => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const days = []; for (let i = dailyDays - 1; i >= 0; i--) { const dt = new Date(); dt.setDate(dt.getDate() - i); days.push(key(dt)); }
  const tot = {}; rows.forEach(r => { tot[r.game_slug] = (tot[r.game_slug] || 0) + Number(r.minutes); });
  const games = Object.keys(tot).sort((a, b) => tot[b] - tot[a]), col = s => DCOL[games.indexOf(s) % DCOL.length], name = s => bySlug(s) ? bySlug(s).title : s;
  const by = {}; rows.forEach(r => { const k = String(r.day).slice(0, 10); (by[k] = by[k] || {})[r.game_slug] = r; });
  const dayTot = days.map(k => Object.values(by[k] || {}).reduce((a, r) => a + Number(r.minutes), 0));
  const all = dayTot.reduce((a, b) => a + b, 0);
  $('#adm-daily-sum').textContent = `${Math.round(all)} min in ${dailyDays} days`;
  if (!all) { box.replaceChildren(h('p', { class: 'note', text: 'No play time in these days yet.' })); return; }
  const step = [5, 10, 15, 30, 60, 120, 180, 300, 600].find(s => Math.max(...dayTot) / s <= 5) || 1200, top = Math.max(step, Math.ceil(Math.max(...dayTot) / step) * step);
  const W = 900, H = 300, L = 52, B = 34, T = 12, pw = W - L - 10, ph = H - B - T, bw = pw / days.length, NS = 'http://www.w3.org/2000/svg';
  const el = (n, a, kids) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); (kids || []).forEach(c => e.append(c)); return e; };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'daily-svg', role: 'img', 'aria-label': `Minutes played per day, last ${dailyDays} days` });
  for (let v = 0; v <= top; v += step) { const y = T + ph - v / top * ph; svg.append(el('line', { x1: L, x2: W - 10, y1: y, y2: y, class: 'grid' }), el('text', { x: L - 8, y: y + 4, 'text-anchor': 'end', class: 'ax' }, [document.createTextNode(v >= 60 && v % 60 === 0 ? (v / 60) + 'h' : v + 'm')])); }
  const lab = k => { const [, m, d] = k.split('-'); return `${+m}/${+d}`; }, every = days.length > 45 ? 7 : days.length > 20 ? 3 : 1;
  days.forEach((k, i) => {
    let y = T + ph; const x = L + i * bw + bw * 0.14, w = bw * 0.72, g = el('g', {});
    games.forEach(s => { const r = by[k] && by[k][s]; if (!r) return; const hgt = Number(r.minutes) / top * ph; y -= hgt;
      g.append(el('rect', { x, y, width: w, height: Math.max(hgt, 0.5), fill: col(s), rx: 2 }, [el('title', {}, [document.createTextNode(`${lab(k)} · ${name(s)}: ${Number(r.minutes)} min · ${r.plays} plays · ${r.players} players`)])])); });
    if (dayTot[i]) g.append(el('text', { x: x + w / 2, y: y - 5, 'text-anchor': 'middle', class: 'val' }, [document.createTextNode(Math.round(dayTot[i]))]));
    if (i % every === 0 || i === days.length - 1) g.append(el('text', { x: x + w / 2, y: H - 12, 'text-anchor': 'middle', class: 'ax' }, [document.createTextNode(lab(k))]));
    svg.append(g); });
  box.replaceChildren(svg);
  leg.replaceChildren(...games.map(s => h('li', {}, h('i', { style: `background:${col(s)}` }), h('span', { text: name(s) }), h('b', { text: `${Math.round(tot[s])} min` }))));
}
document.querySelectorAll('#adm-daily-wrap [data-days]').forEach(b => b.addEventListener('click', () => { dailyDays = +b.dataset.days; renderDaily(); }));
async function previewGame(g) {
  try {
    const html = await ACC.submissionText(g.file_path);
    const fr = h('iframe', { sandbox: 'allow-scripts allow-pointer-lock', title: 'Preview: ' + g.title, class: 'pv-frame' }); fr.srcdoc = SANDBOX_SHIM + html;
    const d = h('dialog', { class: 'pv' }, h('div', { class: 'pv-bar' }, h('strong', { text: `Preview: ${g.title} — by ${g.creator_username}` }), h('button', { class: 'btn primary small', onclick: () => d.close() }, '✕ Close')), fr);
    d.addEventListener('close', () => setTimeout(() => d.remove(), 0)); document.body.append(d); d.showModal();
  } catch { toast('Couldn’t open the preview.'); }
}

/* ---------- boot ---------- */
fetch(ROOT + 'games.json', { cache: 'no-cache' }).then(r => r.json()).then(list => {
  GAMES = list;
  return (ACC ? ACC.approvedGames().catch(() => []) : Promise.resolve([])).then(extra => {
    for (const c of extra) GAMES.push({ slug: c.slug, title: c.title, desc: c.description || '', cats: [c.category], community: true, author: c.creator_username,
      coverUrl: ACC.publicUrl(c.cover_path), fileUrl: ACC.publicUrl(c.file_path), multiplayer: c.multiplayer, controls: [], tip: '', lang: 'English',
      version: 1, added: (c.reviewed_at || c.created_at).slice(0, 10), notes: 'First release', mobile: false });
  });
}).then(() => {
  buildHero();
  const cats = CATS.map(([n, i, e]) => catTile(n, i, e));
  $('#cats-a').replaceChildren(...cats.map(c => c.cloneNode(true)));
  $('#cats-b').replaceChildren(...CATS.map(([n, i, e]) => catTile(n, i, e)));
  route();
}).catch(() => { $('#grid-all').replaceChildren(h('p', { text: 'We couldn’t load the games. Please refresh the page.' })); });
})();
