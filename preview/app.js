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

/* ---------- sign in / out ---------- */
const dlg = $('#signin');
function openSignIn() { $('#si-err').hidden = true; $('#si-pw').value = ''; if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); setTimeout(() => $('#si-id').focus(), 50); }
$('#si-cancel').addEventListener('click', () => dlg.close());
$('#si-form').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('#si-err'), go = $('#si-go'); err.hidden = true; go.disabled = true; go.textContent = 'Signing in…';
  try {
    await ACC.signIn($('#si-id').value, $('#si-pw').value);
    dlg.close(); toast('Welcome back! Your records are saved to your account now.');
  } catch (x) {
    err.textContent = x && x.message === 'bad-id' ? 'IDs use only letters, numbers, dots, dashes or underscores.'
      : x && x.message === 'offline' ? 'We can’t reach the sign-in service. Check your internet and try again.'
      : 'That ID and password don’t match. Check them and try again, or ask your admin.';
    err.hidden = false;
  }
  go.disabled = false; go.textContent = 'Sign in';
});
const menu = $('#acct-menu');
$('#acct-btn').addEventListener('click', e => {
  e.stopPropagation();
  if (!signedIn()) return ACC ? openSignIn() : toast('Sign-in isn’t available right now.');
  menu.hidden = !menu.hidden;
});
document.addEventListener('click', e => { if (!e.target.closest('.acct')) menu.hidden = true; });
menu.addEventListener('click', () => (menu.hidden = true));
$('#signout-btn').addEventListener('click', async () => { endSession(); await ACC.signOut(); toast('Signed out.'); });
$('#my-signin').addEventListener('click', e => { e.preventDefault(); openSignIn(); });
function renderAccount() {
  const b = $('#acct-btn'), on = signedIn();
  b.classList.toggle('on', on);
  $('#acct-label').textContent = on ? (ACC.profile ? ACC.profile.nickname : 'Me') : 'Sign in';
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
  if (GAMES.length) { if (current) syncSave(); if (!$('#v-home').hidden) renderHome(); if (!$('#v-my').hidden) openMy(); }
});
renderAccount();

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
