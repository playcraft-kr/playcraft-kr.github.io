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
const isSaved = s => store.get('saved').includes(s);
function toggleSave(s) {
  const list = store.get('saved'); const i = list.indexOf(s);
  if (i >= 0) list.splice(i, 1); else list.unshift(s);
  store.set('saved', list); return i < 0;
}
function markPlayed(s) { const l = store.get('played').filter(x => x !== s); l.unshift(s); store.set('played', l.slice(0, 12)); }

let toastT;
const toast = m => { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600); };

/* ---------- cards ---------- */
function card(g) {
  const oldest = Math.min(...GAMES.map(x => Date.parse(x.added)));
  const fresh = Date.now() - Date.parse(g.added) < WEEK && Date.parse(g.added) > oldest;
  return h('a', { class: 'card', href: '#/game/' + g.slug, 'aria-label': `${g.title}. ${g.desc}` },
    h('div', { class: 'art' },
      h('img', { src: ROOT + g.cover, alt: '', loading: 'lazy', width: 640, height: 640 }),
      fresh ? h('span', { class: 'badge' }, '✨ NEW') : null,
      g.lang !== 'English' ? h('span', { class: 'badge lang', title: `In-game text is in ${g.lang}` }, g.lang === 'Korean' ? 'KR' : g.lang) : null),
    h('span', { class: 't', text: g.title }),
    h('span', { class: 's', text: g.cats.slice(0, 2).join(' · ') }));
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
  const feat = MAIN();
  const slides = $('#hero-slides'), picks = $('#hero-picks');
  slides.replaceChildren(...feat.map((g, i) => h('div', { class: 'slide', id: 'slide-' + i, role: 'tabpanel', 'aria-roledescription': 'slide', 'aria-label': `${i + 1} of ${feat.length}: ${g.title}` },
    h('img', { src: ROOT + g.wide, alt: '', loading: i ? 'lazy' : 'eager' }),
    h('div', { class: 'slide-copy' },
      h('span', { class: 'eyebrow', text: i === 0 ? '★ Featured' : '★ Top pick' }),
      h('h2', { text: g.title }), h('p', { text: g.desc }),
      h('div', { class: 'chips' }, ...g.cats.map(c => h('span', { class: 'chip', text: c }))),
      h('div', {}, h('a', { class: 'btn primary', href: '#/game/' + g.slug }, '▶ Play now'))))));
  picks.replaceChildren(...feat.map((g, i) => h('button', { class: 'pick', role: 'tab', 'aria-controls': 'slide-' + i, 'aria-label': g.title, onclick: () => showSlide(i, true) },
    h('img', { src: ROOT + g.cover, alt: '' }))));
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
  sug.replaceChildren(...res.map(g => h('a', { href: '#/game/' + g.slug, role: 'option' }, h('img', { src: ROOT + g.cover, alt: '' }), h('span', {}, g.title, h('small', { text: g.cats.join(' · ') })))),
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
const VIEWS = ['home', 'categories', 'list', 'my', 'about', 'game'];
function show(v, nav) {
  VIEWS.forEach(x => ($('#v-' + x).hidden = x !== v));
  document.querySelectorAll('.nav a').forEach(a => { if (a.dataset.nav === nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  window.scrollTo({ top: 0 });
}
function route() {
  if (!GAMES.length) return;
  closeSuggest();
  const [p0, ...rest] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/');
  const arg = rest.join('/');
  if (p0 !== 'game') stopGame();
  document.title = 'PlayCraft — Free Original Browser Games';
  if (p0 === 'game' && bySlug(arg)) return openGame(bySlug(arg));
  if (p0 === 'categories') { show('categories', 'categories'); return; }
  if (p0 === 'cat') return openList(`${arg} games`, MAIN().filter(g => g.cats.includes(arg)), 'categories');
  if (p0 === 'search') { q.value = arg; return openList(`Results for “${arg}”`, search(arg), null, arg); }
  if (p0 === 'my') return openMy();
  if (p0 === 'about') { show('about', 'about'); return; }
  renderHome(); show('home', 'home');
}
addEventListener('hashchange', route);

function renderHome() {
  const played = store.get('played').map(bySlug).filter(Boolean);
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
function openMy() {
  const saved = store.get('saved').map(bySlug).filter(Boolean), played = store.get('played').map(bySlug).filter(Boolean);
  fill($('#grid-saved'), saved); fill($('#grid-played'), played);
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
  $('#start-bg').src = ROOT + g.wide;
  $('#g-title').textContent = g.title; $('#g-desc').textContent = g.desc;
  $('#start-note').textContent = g.lang === 'English' ? 'Tip: click inside the game first so it can hear your keys.' : `In-game text is in ${g.lang}. The controls are on the right.`;
  $('#keys').replaceChildren(...g.controls.map(([k, a]) => h('li', {}, h('kbd', { text: k }), h('span', { text: a }))));
  $('#tip').textContent = g.tip;
  $('#device').textContent = g.mobile ? '📱 Works on a computer or a touch screen.' : '⌨️ Best on a computer with a keyboard and mouse.';
  $('#g-cover').src = ROOT + g.cover;
  $('#g-name').textContent = g.title;
  $('#g-meta').textContent = `PlayCraft Original · v${g.version} · ${g.cats.join(', ')}`;
  const alt = GAMES.find(x => x.variantOf === g.slug) || bySlug(g.variantOf);
  const meta = $('#g-meta'); meta.querySelectorAll('.alt-lang').forEach(n => n.remove());
  if (alt) meta.append(' · ', h('a', { class: 'alt-lang', href: '#/game/' + alt.slug, text: alt.lang === 'Korean' ? '🇰🇷 Play in Korean' : '🇺🇸 Play in English' }));
  syncSave();
  const next = MAIN().filter(x => x !== g && x.slug !== g.variantOf && x.variantOf !== g.slug)
    .sort((a, b) => b.cats.filter(c => g.cats.includes(c)).length - a.cats.filter(c => g.cats.includes(c)).length);
  fill($('#row-next'), next);
  $('#versions').replaceChildren(h('li', {}, h('span', { class: 'v', text: 'v' + g.version }), h('span', { class: 'd', text: new Date(g.added + 'T12:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) }), h('span', { class: 'n', text: g.notes })));
  show('game', null);
}
function syncSave() { const on = current && isSaved(current.slug); const b = $('#save-btn'); b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '♥ Saved' : '♡ Save'; }
function playGame() {
  if (!current) return;
  const st = $('#stage'); st.querySelectorAll('iframe').forEach(f => f.remove());
  const f = h('iframe', { src: `${ROOT}games/${current.slug}/`, allow: 'autoplay; fullscreen; gamepad', title: current.title });
  $('#start').hidden = true; st.append(f); playing = true; markPlayed(current.slug);
  setTimeout(() => f.focus(), 400);
}
function stopGame() { const st = $('#stage'); st.querySelectorAll('iframe').forEach(f => f.remove()); $('#start').hidden = false; playing = false; setFull(false); }
// Real browser full screen: no button covers the game, and the browser itself exits on Esc.
// Only browsers without the Fullscreen API (older iPhones) get a fill-the-window mode with a small corner button.
let exitBtn = null;
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
function setFull(on) {
  const st = $('#stage'); if (!st) return;
  if (on) {
    const req = st.requestFullscreen || st.webkitRequestFullscreen;
    if (req) { Promise.resolve(req.call(st)).catch(() => fallbackFull(true)); return; }
    return fallbackFull(true);
  }
  if (fsEl()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); }
  fallbackFull(false);
}
function fallbackFull(on) {
  const st = $('#stage');
  st.classList.toggle('full', on); document.body.style.overflow = on ? 'hidden' : '';
  if (on && !exitBtn) { exitBtn = h('button', { class: 'full-exit', 'aria-label': 'Exit full screen', title: 'Exit full screen', onclick: () => setFull(false) }, '✕'); document.body.append(exitBtn); }
  if (!on && exitBtn) { exitBtn.remove(); exitBtn = null; }
}
const syncFsBtn = () => { $('#full-btn').textContent = fsEl() ? '⛶ Exit full screen' : '⛶ Full screen'; if (fsEl()) setTimeout(() => { const f = $('#stage iframe'); if (f) f.focus(); }, 100); };
document.addEventListener('fullscreenchange', syncFsBtn);
document.addEventListener('webkitfullscreenchange', syncFsBtn);
$('#play-btn').addEventListener('click', playGame);
$('#restart-btn').addEventListener('click', () => { if (playing) playGame(); else playGame(); });
$('#full-btn').addEventListener('click', () => { if (!playing) playGame(); setFull(true); });
$('#save-btn').addEventListener('click', () => { if (!current) return; const on = toggleSave(current.slug); syncSave(); toast(on ? 'Saved to My Games ♥' : 'Removed from My Games'); });
$('#share-btn').addEventListener('click', async () => {
  const url = location.href;
  try { await navigator.clipboard.writeText(url); toast('Link copied! Paste it to share this game.'); }
  catch { toast('Copy this link from the address bar to share.'); }
});
addEventListener('keydown', e => { if (e.key === 'Escape') setFull(false); });

/* ---------- boot ---------- */
fetch(ROOT + 'games.json', { cache: 'no-cache' }).then(r => r.json()).then(list => {
  GAMES = list;
  buildHero();
  const cats = CATS.map(([n, i, e]) => catTile(n, i, e));
  $('#cats-a').replaceChildren(...cats.map(c => c.cloneNode(true)));
  $('#cats-b').replaceChildren(...CATS.map(([n, i, e]) => catTile(n, i, e)));
  route();
}).catch(() => { $('#grid-all').replaceChildren(h('p', { text: 'We couldn’t load the games. Please refresh the page.' })); });
})();
