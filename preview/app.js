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
const VIEWS = ['home', 'categories', 'list', 'my', 'about', 'game', 'admin'];
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
  if (p0 === 'admin') return openAdmin();
  renderHome(); show('home', 'home');
}
addEventListener('hashchange', route);

function renderHome() {
  const played = playedList().map(bySlug).filter(Boolean);
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
  const saved = savedList().map(bySlug).filter(Boolean), played = playedList().map(bySlug).filter(Boolean);
  fill($('#grid-saved'), saved); fill($('#grid-played'), played);
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
  $('#start').hidden = true; st.append(f); fitFrame(); playing = true; markPlayed(current.slug); beginSession(current.slug);
  setTimeout(() => f.focus(), 400);
}
// Games are designed for a full desktop window. When the player box is smaller than 1280×720,
// render the game at that size and scale it down so nothing gets cut off.
const MIN_W = 1280, MIN_H = 720;
function fitFrame() {
  const st = $('#stage'), f = st && st.querySelector('iframe'); if (!f) return;
  const top = st.classList.contains('full') ? (st.querySelector('.big-bar')?.offsetHeight || 0) : 0;
  const w = st.clientWidth, hgt = st.clientHeight - top;
  const s = Math.min(1, w / MIN_W, hgt / MIN_H);
  f.style.width = (w / s) + 'px'; f.style.height = (hgt / s) + 'px';
  f.style.transform = s < 1 ? `scale(${s})` : ''; f.style.transformOrigin = '0 0';
  f.style.top = top + 'px'; f.style.left = '0';
}
new ResizeObserver(fitFrame).observe(document.querySelector('#stage'));
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
  s.id = await ACC.startPlay(slug).catch(() => null);
  s.timer = setInterval(() => { tick(s); if (s.id) ACC.updatePlay(s.id, s.secs).catch(() => {}); }, 20000);
}
function tick(s) { const now = Date.now(); if (!document.hidden) s.secs += (now - s.last) / 1000; s.last = now; }
function endSession() {
  const s = sess; if (!s) return; sess = null; clearInterval(s.timer); tick(s);
  if (s.id) ACC.updatePlay(s.id, s.secs).then(() => refreshAccountData()).catch(() => {});
}
document.addEventListener('visibilitychange', () => { if (sess) { if (document.hidden) { tick(sess); } else sess.last = Date.now(); } });
addEventListener('pagehide', () => { if (sess && sess.id) { tick(sess); ACC.updatePlay(sess.id, sess.secs); } });

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
  try { admData = await ACC.adminData(); } catch { toast('Couldn’t load admin data. Try Refresh.'); return; }
  renderAdmin();
}
function renderAdmin() {
  if (!admData) return;
  const { profiles, plays } = admData, now = Date.now(), WEEKMS = 7 * 864e5;
  const per = {}; for (const p of plays) { const u = per[p.user_id] || (per[p.user_id] = { plays: 0, secs: 0, last: null }); u.plays++; u.secs += p.seconds || 0; if (!u.last || p.started_at > u.last) u.last = p.started_at; }
  const totalSecs = plays.reduce((s, p) => s + (p.seconds || 0), 0);
  const activeWeek = new Set(plays.filter(p => now - Date.parse(p.started_at) < WEEKMS).map(p => p.user_id)).size;
  $('#adm-stats').replaceChildren(
    h('div', { class: 'stat' }, h('b', { text: String(profiles.length) }), h('span', { text: 'Players signed up' })),
    h('div', { class: 'stat' }, h('b', { text: String(profiles.filter(p => now - Date.parse(p.created_at) < WEEKMS).length) }), h('span', { text: 'New this week' })),
    h('div', { class: 'stat' }, h('b', { text: String(activeWeek) }), h('span', { text: 'Played this week' })),
    h('div', { class: 'stat' }, h('b', { text: String(plays.length) }), h('span', { text: 'Games played' })),
    h('div', { class: 'stat' }, h('b', { text: fmtTime(totalSecs) }), h('span', { text: 'Total play time' })));
  const byGame = {}; for (const p of plays) byGame[p.game_slug] = (byGame[p.game_slug] || 0) + 1;
  const gRows = Object.entries(byGame).sort((a, b) => b[1] - a[1]); const gMax = Math.max(1, ...gRows.map(r => r[1]));
  $('#adm-games').replaceChildren(...(gRows.length ? gRows.map(([s, n]) => statBar(bySlug(s) ? bySlug(s).title : s, n, gMax, plural(n, 'play'))) : [h('li', { class: 'note', text: 'No plays yet.' })]));
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
    if (p.id !== me) {
      acts.append(h('button', { class: 'btn ghost tiny', onclick: () => adminAct(p, 'block') }, p.blocked ? 'Unpause' : 'Pause'));
      acts.append(h('button', { class: 'btn ghost tiny', onclick: () => adminAct(p, 'admin') }, p.is_admin ? 'Remove admin' : 'Make admin'));
    } else acts.append(h('span', { class: 'note', text: 'You' }));
    return h('tr', {}, h('td', { class: 'mono', text: p.username }), h('td', { text: p.nickname }),
      h('td', {}, p.age ? String(p.age >= 18 ? '18+' : p.age) : '—', p.age && p.age < 14 ? h('span', { class: 'g', title: 'Guardian OK ticked at sign-up', text: p.guardian_ok ? ' ✓G' : ' !G' }) : null),
      h('td', { text: d(p.created_at) }), h('td', { text: d(u.last) }), h('td', { text: String(u.plays) }), h('td', { text: fmtTime(u.secs) }), h('td', {}, status), h('td', {}, acts));
  }));
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
function ask(text) {
  return new Promise(res => {
    const d = h('dialog', { class: 'confirm' }, h('p', { text }), h('div', { class: 'si-actions' },
      h('button', { class: 'btn ghost', onclick: () => { d.close(); res(false); } }, 'Cancel'),
      h('button', { class: 'btn primary', onclick: () => { d.close(); res(true); } }, 'Yes, do it')));
    d.addEventListener('close', () => setTimeout(() => d.remove(), 0)); document.body.append(d); d.showModal();
  });
}
$('#adm-q').addEventListener('input', renderAdmin);
$('#adm-refresh').addEventListener('click', openAdmin);

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
