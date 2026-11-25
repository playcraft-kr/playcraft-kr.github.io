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
const madeBy = g => (g.authorName || g.author) ? `Made by ${g.authorName || g.author}` : 'PlayCraft Original';
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
// NEW only for the 4 most recently added games (within 2 weeks, not launch day), so the badge still means something.
let NEW_SET = null;
function newSet() {
  if (NEW_SET) return NEW_SET;
  const launch = Math.min(...GAMES.map(x => dayOf(x.added))), now = Date.now();
  NEW_SET = new Set(MAIN().filter(g => dayOf(g.added) > launch && now - dayOf(g.added) < 2 * WEEK).sort((a, b) => dayOf(b.added) - dayOf(a.added)).slice(0, 4).map(g => g.slug));
  return NEW_SET;
}
function newness(g) {
  if (newSet().has(g.slug)) return 'new';
  if (g.updated && Date.now() - dayOf(g.updated) < WEEK) return 'upd';
  return '';
}
const freshAt = g => Math.max(dayOf(g.added), dayOf(g.updated));
// "New & updated" row: at most 5, newest first.
const freshList = () => MAIN().filter(newness).sort((a, b) => freshAt(b) - freshAt(a)).slice(0, 5);
function card(g, opt) {
  const nw0 = newness(g), nw = nw0 === 'upd' && !(opt && opt.notes) ? '' : nw0;
  return h('a', { class: 'card' + (nw ? ' is-' + nw : ''), href: '#/game/' + g.slug, 'aria-label': `${g.title}. ${g.desc}` },
    h('div', { class: 'art' },
      artNode(g),
      g.multiplayer ? h('span', { class: 'mp-badge' }, '👥 Online') : null,
      nw === 'new' ? h('span', { class: 'badge new' }, '🆕 NEW') : nw === 'upd' ? h('span', { class: 'badge upd' }, `✨ UPDATED · v${g.version}`) : null,
      g.lang !== 'English' ? h('span', { class: 'badge lang', title: `In-game text is in ${g.lang}` }, g.lang === 'Korean' ? '한국어' : /English/.test(g.lang) && /Korean/.test(g.lang) ? 'EN · 한국어' : g.lang) : null),
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
  if (p0 !== 'search') q.value = '';
  menu.hidden = true;
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
  $('#my-waiting').hidden = !(signedIn() && ACC.profile && ACC.profile.approved === false);
  if (!$('#my-waiting').hidden) ACC.myParentConsent().then(c => { $('#my-parent-line').textContent = c ? (c.status === 'declined' ? `Your parent (${c.email_hint}) said not yet.` : c.expired ? `The message to ${c.email_hint} ran out.` : `We sent a message to ${c.email_hint}.`) : 'We haven’t emailed your parent yet.'; $('#my-parent-btn').textContent = c ? 'Send to my parent again' : 'Ask my parent'; }).catch(() => {});
  if (signedIn()) { renderLearnAcct(); renderRecovery(); }
  const st = $('#my-stats'), on = signedIn() && cloudStats;
  $('#my-lead').hidden = signedIn();
  st.hidden = !on;
  if (on) {
    const fav = [...cloudStats.games].sort((a, b) => b.seconds - a.seconds)[0];
    st.replaceChildren(
      h('div', { class: 'stat' }, h('b', { text: fmtTime(cloudStats.totalSeconds) }), h('span', { text: 'Total play time' })),
      h('div', { class: 'stat' }, h('b', { text: String(cloudStats.totalPlays) }), h('span', { text: cloudStats.totalPlays === 1 ? 'Game played' : 'Games played' })),
      h('div', { class: 'stat' }, h('b', { text: String(cloudStats.games.length) }), h('span', { text: 'Different games tried' })),
      ...(fav && bySlug(fav.slug) ? [h('div', { class: 'stat' }, h('b', { text: bySlug(fav.slug).title }), h('span', { text: 'Your most played' }))] : []));
    // add per-game records under each played card
    [...$('#grid-played').children].forEach((el, k) => { const r = cloudStats.games.find(x => x.slug === played[k].slug); if (r) el.append(h('span', { class: 'rec', text: `${r.plays}× · ${fmtTime(r.seconds)} · last ${new Date(r.last).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` })); });
  }
  document.querySelectorAll('#v-my h2.sub').forEach((el, i) => (el.hidden = !(i ? played.length : saved.length)));
  $('#my-empty').hidden = saved.length + played.length > 0;
  show('my', 'my');
}

/* ---------- game page ---------- */
let current = null, playing = false;
/* ---------- ideas & hearts under each game ---------- */
const nextVersion = g => (+(g && g.version) || 1) + 1;
async function renderComments() {
  const g = current, list = $('#cmt-list'), form = $('#cmt-form'), gate = $('#cmt-gate');
  if (!g || !list) return;
  const isAdm = signedIn() && ACC.profile && ACC.profile.is_admin;
  form.hidden = true; gate.hidden = true;
  if (!signedIn()) { gate.hidden = false; gate.replaceChildren('Sign in to write an idea or give a ❤️. ', h('a', { href: '#', onclick: e => { e.preventDefault(); openSignIn(false); } }, 'Sign in')); }
  else if (ACC.limited) { gate.hidden = false; gate.textContent = 'Writing ideas opens after your parent approves your account. You can still give ❤️ to ideas you like.'; }
  else form.hidden = false;
  let rows = []; try { rows = await ACC.comments(g.slug); } catch { list.replaceChildren(h('li', { class: 'note', text: 'Couldn’t load ideas right now.' })); return; }
  if (current !== g) return;
  if (!rows.length) { list.replaceChildren(h('li', { class: 'cmt-empty', text: 'No ideas yet. Be the first!' })); return; }
  list.replaceChildren(...rows.map(c => {
    const heart = h('button', { class: 'cmt-heart' + (c.my_heart ? ' on' : ''), 'aria-pressed': String(!!c.my_heart), title: 'Give a heart',
      onclick: async () => { if (!signedIn()) return openSignIn(false); let n; try { n = await ACC.toggleHeart(c.id); } catch { return; } if (n < 0) return toast('Hearts are only for ideas others can see.'); renderComments(); } },
      (c.my_heart ? '❤️ ' : '🤍 ') + c.hearts);
    const tools = h('span', { class: 'cmt-tools' });
    if (c.mine) tools.append(h('button', { class: 'linkish', onclick: async () => { if (!(await ask('Delete your idea?'))) return; try { await ACC.deleteComment(c.id); renderComments(); } catch { toast('Couldn’t delete it.'); } } }, 'Delete'));
    if (isAdm) {
      tools.append(c.picked_version
        ? h('button', { class: 'linkish', onclick: async () => { await ACC.adminPickComment(c.id, null).catch(() => {}); renderComments(); } }, 'Unpick')
        : h('button', { class: 'linkish', onclick: async () => { if (!(await ask(`Pick this idea for version ${nextVersion(g)}? It moves to the top and is added to the game requests.`))) return; try { await ACC.adminPickComment(c.id, nextVersion(g)); toast('Picked! It’s in the game requests too.'); } catch { toast('Couldn’t pick it.'); } renderComments(); } }, `⭐ Pick for v${nextVersion(g)}`));
      tools.append(h('button', { class: 'linkish', onclick: async () => { await ACC.adminCommentStatus(c.id, c.status === 'pending' ? 'shown' : 'hidden').catch(() => {}); renderComments(); } }, c.status === 'pending' ? 'Show' : 'Hide'));
    }
    return h('li', { class: 'cmt' + (c.picked_version ? ((+g.version || 1) >= c.picked_version ? ' picked added' : ' picked') : '') + (c.status === 'pending' ? ' pending' : '') },
      c.picked_version ? ((+g.version || 1) >= c.picked_version ? h('div', { class: 'cmt-badge done', text: `✅ Added in version ${c.picked_version}! Thanks, ${c.nickname}` }) : h('div', { class: 'cmt-badge', text: `⭐ Picked! Coming in version ${c.picked_version}` })) : null,
      c.status === 'pending' ? h('div', { class: 'cmt-wait', text: c.mine ? '⏳ Waiting for a grown-up to check it. Only you can see it for now.' : '⏳ Waiting for your check' }) : null,
      h('p', { class: 'cmt-body', text: c.body }),
      h('div', { class: 'cmt-meta' }, h('span', { class: 'cmt-who', text: isAdm && c.username ? `${c.nickname} (${c.username})` : c.nickname }), heart, tools));
  }));
}
$('#cmt-body').addEventListener('input', () => { $('#cmt-count').textContent = `${$('#cmt-body').value.length} / 300`; });
$('#cmt-form').addEventListener('submit', async e => {
  e.preventDefault();
  const body = $('#cmt-body').value.trim(); if (!body || !current) return;
  const go = $('#cmt-go'); go.disabled = true;
  let r; try { r = await ACC.addComment(current.slug, body); } catch { r = 'error'; }
  go.disabled = false;
  if (r === 'shown' || r === 'pending') { $('#cmt-body').value = ''; $('#cmt-count').textContent = '0 / 300'; toast(r === 'shown' ? 'Thanks for your idea! 💡' : 'Thanks! A grown-up will check your idea, then everyone can see it.'); renderComments(); return; }
  toast(r === 'contact' ? 'Please take out emails, phone numbers and links.' : r === 'wait' ? 'That’s a lot of ideas! Wait a little and try again.' : r === 'long' ? 'Please keep it under 300 characters.'
    : r === 'limited' ? 'Writing ideas opens after your parent approves your account.' : r === 'signin' ? 'Please sign in first.' : 'Couldn’t post. Try again.');
});
async function renderPendingComments() {
  const wrap = $('#adm-cmt-wrap'); let rows = [];
  try { rows = await ACC.adminPendingComments(); } catch { wrap.hidden = true; return; }
  wrap.hidden = !rows.length; $('#adm-cmt-count').textContent = rows.length || '';
  $('#adm-cmt').replaceChildren(...rows.map(c => h('li', {}, h('div', {}, h('b', { text: c.username }), ' on ', h('a', { href: '#/game/' + c.slug, text: c.slug }), h('p', { class: 'cmt-body', text: c.body })),
    h('div', { class: 'si-actions' },
      h('button', { class: 'btn ghost tiny', onclick: async () => { await ACC.adminCommentStatus(c.id, 'hidden').catch(() => {}); renderPendingComments(); } }, 'Hide'),
      h('button', { class: 'btn primary tiny', onclick: async () => { await ACC.adminCommentStatus(c.id, 'shown').catch(() => {}); renderPendingComments(); } }, 'Show')))));
}
function openGame(g) {
  if (current !== g) stopGame();
  current = g; document.title = `${g.title} · PlayCraft`; playLabel(); renderComments();
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
  $('#req-btn').hidden = !(signedIn() && ACC.profile && ACC.profile.is_admin);
  showCoins();
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
/* playing needs an account: without one the sign-in window opens, and the game starts right after signing in */
let pendingPlay = null;
function playLabel() { const b = $('#play-btn'); if (b) b.innerHTML = signedIn() ? '<span aria-hidden="true">▶</span> Play' : '<span aria-hidden="true">🔒</span> Sign in to play'; }
// a locked game area asks for the sign-up window (message from games/guard.js, same site only)
addEventListener('message', e => {
  if (e.origin !== location.origin || !e.data || e.data.pc !== 'signup') return;
  if (current) pendingPlay = current.slug;
  stopGame(); openSignIn(true);
});

/* ---------- learning mode: other games cost game minutes (from Math Space War) or 10 Word League coins a minute, with a daily limit ---------- */
const LEARN_GAMES = new Set(['ssat-word-league', 'math-space-war', 'study-arcade']);
const learnOn = () => !!(signedIn() && ACC.profile && ACC.profile.learn_mode);
const needsCoins = g => learnOn() && g && !LEARN_GAMES.has(g.slug);

async function askParent(reason) {
  // Once a parent has approved, the link always goes back to that parent; only the parent can change their email (on their page).
  let cur = null; try { cur = await ACC.myParentConsent(); } catch {}
  let em = '';
  if (cur && cur.status === 'approved') {
    if (!(await ask(`We’ll email a link to your parent (${cur.email_hint}). They can change settings and the parent PIN there. Send it?`))) return;
  } else {
    em = await askText(reason || 'Type your parent’s email. We’ll send them a link to approve your account (and to choose learning mode).', '', 'Send');
    if (em === null) return;
  }
  let r; try { r = await ACC.requestParentConsent(em); } catch { return toast('Couldn’t send. Try again.'); }
  toast(r.ok ? (r.mailed ? 'Sent! Ask your parent to check their email.' : 'Saved! A PlayCraft grown-up will pass the message to your parent.')
    : r.why === 'same' ? 'That’s your own recovery email. Please type your parent’s email.' : r.why === 'email' ? 'That email doesn’t look right.' : r.why === 'wait' ? 'Please wait 2 minutes before sending again.' : r.why === 'limit' ? 'You’ve sent 5 today. Try again tomorrow.' : 'Couldn’t send.');
  if (!$('#v-my').hidden) openMy(true);
}
$('#my-parent-btn').addEventListener('click', () => askParent());
/* ---------- password recovery ---------- */
function infoDialog(title, text) {
  const d = h('dialog', { class: 'confirm' }, h('p', {}, h('b', { text: title })), h('p', { text }),
    h('div', { class: 'si-actions' }, h('button', { class: 'btn primary', onclick: () => d.close() }, 'OK')));
  d.addEventListener('close', () => setTimeout(() => d.remove(), 0)); document.body.append(d); d.showModal();
}
$('#forgot-pw').addEventListener('click', async e => {
  e.preventDefault();
  const id = await askText('Type your PlayCraft ID. If your account has a confirmed email (your parent’s, or your own recovery email), we’ll send a link to set a new password.', $('#si-id').value.trim(), 'Send link');
  if (id === null) return;
  try { await ACC.requestPasswordReset(id); } catch {}
  // Same answer every time, so nobody can find out which accounts exist or have an email.
  infoDialog('Check your email 📬', 'If your account has a verified email address, we’ve sent you a password reset link. Under 13? We’ll send the link to your parent’s email address instead.\n\nStill no email after 10 minutes? Check your spam folder.\n\nIf your account doesn’t have an email address, you won’t be able to reset your password. Ask a grown-up to help you create a new account.');
});
$('#forgot-id').addEventListener('click', async e => {
  e.preventDefault();
  const em = await askText('Parents: type the email you used to approve your child. We’ll email you every PlayCraft ID linked to it.', '', 'Email me the IDs');
  if (em === null) return;
  try { await ACC.sendUsernames(em); } catch {}
  infoDialog('Check your email 📬', 'If any PlayCraft IDs are linked to this email, we just sent you the list.');
});
async function addRecovery(pw, email) {
  if (!pw) { pw = await askText('To add a recovery email, first type your current password.', '', 'Next', false, 'password'); if (pw === null) return; }
  if (!email) { email = await askText('Type the email you want to use if you forget your password.', '', 'Send code'); if (email === null) return; }
  let r; try { r = await ACC.setRecoveryEmail(pw, email); } catch { return toast('Couldn’t send the code. Try again.'); }
  if (r !== 'sent') return toast(r === 'password' ? 'That password isn’t right.' : r === 'email' ? 'That email doesn’t look right.' : r === 'wait' ? 'Too many tries. Wait an hour and try again.' : r === 'child' ? 'Under 13, your parent’s email is used instead.' : 'Couldn’t send the code.');
  await enterRecoveryCode();
}
async function enterRecoveryCode() {
  for (let i = 0; i < 5; i++) {
    const code = await askText('We emailed you a 6-number code. Type it here (it works for 15 minutes).', '', 'Confirm');
    if (code === null) break;
    let r; try { r = await ACC.confirmRecoveryEmail(code); } catch { toast('Couldn’t check the code. Try again.'); break; }
    if (r === 'ok') { toast('Recovery email saved. ✓'); break; }
    if (r !== 'wrong') { toast('That code ran out. Add the email again to get a new one.'); break; }
    toast('That code isn’t right. Try again.');
  }
  renderRecovery();
}
async function renderRecovery() {
  const row = $('#ma-recovery'); if (!row) return;
  let r; try { r = await ACC.myRecoveryEmail(); } catch { row.hidden = true; return; }
  if (!r || !r.can_add) { row.hidden = true; return; }
  row.hidden = false;
  $('#ma-recovery-state').textContent = r.email_hint ? `${r.email_hint} ✓` : r.pending_hint ? `${r.pending_hint} (waiting for the code)` : 'None — without one, a forgotten password can’t be recovered.';
  const add = $('#ma-recovery-add'), code = $('#ma-recovery-code'), del = $('#ma-recovery-del');
  add.hidden = false; add.textContent = r.email_hint ? 'Change' : 'Add'; add.onclick = () => addRecovery();
  code.hidden = !r.pending_hint; code.onclick = () => enterRecoveryCode();
  del.hidden = !r.email_hint; del.onclick = async () => {
    const pw = await askText('To remove your recovery email, type your current password.', '', 'Remove', false, 'password'); if (pw === null) return;
    let x; try { x = await ACC.removeRecoveryEmail(pw); } catch { return toast('Couldn’t remove it.'); }
    toast(x === 'ok' ? 'Recovery email removed.' : x === 'password' ? 'That password isn’t right.' : 'Too many tries. Wait an hour.'); renderRecovery();
  };
}
// Forgot the parent PIN: a link goes to the parent's email (or the player's confirmed recovery email).
async function forgotPin() {
  let r; try { r = await ACC.requestPinReset(); } catch { return toast('Couldn’t send. Try again.'); }
  if (r === 'parent') toast('We sent a link to your parent’s email to choose a new PIN.');
  else if (r === 'wait') toast('A link was just sent. Please wait an hour before asking again.');
  else askParent('There’s no email on this account yet. Type your parent’s email and we’ll send them a link to choose a new PIN.');
}
async function renderLearnAcct() {
  const st = $('#ma-learn-state'), btn = $('#ma-learn-btn'), coinEl = $('#ma-coins');
  let ls; try { ls = await ACC.learnStatus(); } catch { st.textContent = '—'; return; }
  st.textContent = ls.learn_mode ? 'On' : 'Off';
  coinEl.textContent = '';
  if (ls.learn_mode) walletText(true).then(t => { coinEl.textContent = t; }).catch(() => {});
  const lb = $('#ma-limits-btn'); if (lb) lb.hidden = true;
  const pf = $('#ma-pin-forgot'); if (pf) { pf.hidden = !ls.has_pin; pf.onclick = forgotPin; }
  btn.hidden = false;
  // The parent PIN is only ever set from the parent's email link, so a child can't make one.
  if (!ls.has_pin || (ACC.profile && ACC.profile.age && ACC.profile.age < 13)) {
    btn.textContent = ls.has_pin ? 'Ask my parent to change it' : 'Ask my parent to set it up';
    btn.onclick = () => askParent('Type your parent’s email. We’ll send them a link where they can set the parent PIN and turn learning mode on or off.');
  }
  else {
    if (lb && ls.learn_mode) { lb.hidden = false; lb.onclick = changeLimits; }
    btn.textContent = ls.learn_mode ? 'Turn off (parent PIN)' : 'Turn on (parent PIN)';
    btn.onclick = async () => { const pin = await askText(`Parent: enter your PIN to turn learning mode ${ls.learn_mode ? 'off' : 'on'}.`, '', ls.learn_mode ? 'Turn off' : 'Turn on'); if (pin === null) return;
      let r; try { r = await ACC.setLearnMode(pin, !ls.learn_mode); } catch { return toast('Couldn’t change it. Try again.'); }
      toast(r === 'ok' ? `Learning mode is ${ls.learn_mode ? 'off' : 'on'}.` : r === 'locked' ? 'Too many wrong tries. Try again in 15 minutes.' : r === 'wrong' ? 'Wrong PIN.' : 'Couldn’t change it.'); renderLearnAcct(); };
  }
}
let coinTimer = null, coinMins = 0, wlMins = 0, coinGame = null;
// Paid time is counted by the second, only while a game is on screen and the window is in use.
// "credit" = seconds already paid for; unused seconds carry over to the next game (no new minute each time a game opens).
let leftMin = 0, credit = 0, warned = false, paying = false;
const activeNow = () => playing && !document.hidden && document.hasFocus();
async function refreshLeft() {
  const [w, c] = await Promise.all([ACC.learnWallet().catch(() => null), ACC.walletCoins().catch(() => 0)]);
  let n = (w ? w.math_min : 0) + Math.floor(c / ACC.WL_PER_MIN);
  if (w && w.play_cap != null) n = Math.min(n, Math.max(0, w.play_cap - w.play_today));
  leftMin = n; drawLeft();
}
function drawLeft() {
  let el = $('#play-timer');
  if (!coinTimer) { if (el) el.hidden = true; return; }
  if (!el) { el = h('div', { id: 'play-timer', class: 'play-timer', 'aria-live': 'polite' }); $('#stage').append(el); }
  const secs = Math.max(0, leftMin * 60 + credit), t = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  el.textContent = activeNow() ? `⏱ ${t} left` : `⏸ Paused · ${t} left`;
  el.classList.toggle('low', secs <= 60); el.hidden = false;
  if (secs <= 60 && !warned) { warned = true; toast('1 minute of game time left!'); }
}
const capText = c => c == null ? 'no daily limit' : `${c} min a day`;
// "⏱ 3 game min · 🪙 120 coins (= 12 min) · today 20 / 60 min"
async function walletText(long) {
  const [w, c] = await Promise.all([ACC.learnWallet().catch(() => null), ACC.walletCoins().catch(() => 0)]);
  const per = ACC.WL_PER_MIN, gm = w ? w.math_min : 0;
  if (long) {
    const mins = gm + Math.floor(c / per);
    return `You have ${plural(mins, 'minute')} of game time (${plural(gm, 'minute')} from Math Space War + ${plural(c, 'Word League coin')}). ` +
      (w ? (w.play_cap == null ? `Today: ${plural(w.play_today, 'minute')} played.` : `Today: ${w.play_today} of ${w.play_cap} minutes used.`) : '');
  }
  const parts = [`⏱ ${gm} game min`, `🪙 ${c} coin${c === 1 ? '' : 's'}${long ? ` (${per} coins = 1 min)` : ''}`];
  if (w) parts.push(w.play_cap == null ? `today ${w.play_today} min` : `today ${w.play_today} / ${w.play_cap} min`);
  return parts.join(' · ');
}
async function showCoins() { const el = $('#g-coins'); if (!needsCoins(current)) { el.hidden = true; return; } try { el.textContent = await walletText(false); el.hidden = false; } catch { el.hidden = true; } }
async function changeLimits() {
  let w = null; try { w = await ACC.learnWallet(); } catch {}
  const cap = await askText(`Parent: minutes of other games per day (now ${capText(w && w.play_cap)}). Type 0–600, or leave empty for no limit.`, w && w.play_cap != null ? String(w.play_cap) : '', 'Next');
  if (cap === null) return;
  const capN = cap.trim() === '' ? null : parseInt(cap, 10);
  if (capN !== null && !(capN >= 0 && capN <= 600)) return toast('Type a number from 0 to 600.');
  const gr = await askText(`School grade for Math Space War (1–12). Only rounds at this grade or higher give game minutes. Leave empty to use the age (grade ${w ? w.math_grade : '?'} now).`, w && w.math_grade ? String(w.math_grade) : '', 'Next');
  if (gr === null) return;
  const grN = gr.trim() === '' ? null : parseInt(gr, 10);
  if (grN !== null && !(grN >= 1 && grN <= 12)) return toast('Type a grade from 1 to 12.');
  const ec = await askText(`Most game time your child can earn per day in Math Space War and Study Arcade together (now ${w ? w.math_cap : 30} min). Type 0–600.`, w ? String(w.math_cap) : '30', 'Next');
  if (ec === null) return;
  const ecN = parseInt(ec, 10);
  if (!(ecN >= 0 && ecN <= 600)) return toast('Type a number from 0 to 600.');
  const pin = await askText('Parent: enter your PIN to save.', '', 'Save', false, 'password'); if (pin === null) return;
  let r; try { r = await ACC.setLearnLimits(pin, capN, grN, ecN); } catch { return toast('Couldn’t save. Try again.'); }
  toast(r === 'ok' ? 'Saved.' : r === 'locked' ? 'Too many wrong tries. Try again in 15 minutes.' : r === 'wrong' ? 'Wrong PIN.' : 'Couldn’t save.'); renderLearnAcct();
}
function needCoinsDialog(g, why) {
  const cap = why === 'cap';
  const go = slug => () => { d.close(); location.hash = '#/game/' + slug; };
  const card = (slug, icon, name, line) => h('button', { class: 'gt-card', onclick: go(slug) },
    h('span', { class: 'gt-ic', text: icon }), h('span', { class: 'gt-tx' }, h('b', { text: name }), h('small', { text: line })), h('span', { class: 'gt-go', text: '›' }));
  const d = h('dialog', { class: 'confirm gt-dialog' },
    h('div', { class: 'gt-big', text: cap ? '⏰' : '⏱' }),
    h('h3', { text: cap ? 'That’s all for today!' : why === 'out' ? 'Your game time is up!' : 'You need game time first' }),
    h('p', { class: 'gt-sub', text: cap ? 'Come back tomorrow for more game time.\nThe learning games are still open.' : 'Play a learning game to earn more.' }),
    card('math-space-war', '🧮', 'Math Space War', '8 right out of 10 = 1 minute'),
    card('study-arcade', '🕹️', 'Study Arcade', '8 right out of 10 = 1 minute'),
    card('ssat-word-league', '📚', 'Word League', 'Earn coins = more minutes'),
    h('div', { class: 'gt-foot' }, h('a', { href: '../learning.html', target: '_blank', rel: 'noopener' }, 'How it works'),
      h('button', { class: 'btn ghost', onclick: () => d.close() }, 'Not now')));
  d.addEventListener('close', () => setTimeout(() => d.remove(), 0)); document.body.append(d); d.showModal();
}
function stopCoinTimer() {
  clearInterval(coinTimer); coinTimer = null; drawLeft();
  if (wlMins && coinGame) { const n = wlMins, t = coinGame; ACC.walletNote(`PlayCraft: ${t} (${n} min)`, n * ACC.WL_PER_MIN).catch(() => {}); }
  coinMins = 0; wlMins = 0; coinGame = null;
}
// Pays one minute: game minutes first, then Word League coins. Returns 'math' | 'wl' | 'cap' | 'none'.
async function payMinute() {
  const per = ACC.WL_PER_MIN;
  let coins = 0; try { coins = await ACC.walletCoins(); } catch {}
  let r = 'none'; try { r = await ACC.playMinute(coins >= per); } catch { return 'none'; }
  if (r === 'wl') { let ok = false; try { ok = await ACC.walletSpend(per); } catch {} if (!ok) return 'none'; wlMins++; }
  return r;
}
async function secondTick() {
  if (!playing || !current || !coinTimer) return;
  if (activeNow() && !paying) {
    credit--;
    if (credit <= 0) {
      paying = true; const r = await payMinute(); paying = false;
      if (r !== 'math' && r !== 'wl') { credit = 0; const g = current; stopGame(); needCoinsDialog(g, r === 'cap' ? 'cap' : 'out'); return; }
      credit += 60; coinMins++; showCoins(); refreshLeft();
    }
  }
  drawLeft();
}
let starting = false;
async function playGame() {
  if (!current || starting) return;
  starting = true;
  try { await playGameInner(); } finally { starting = false; }
}
async function playGameInner() {
  if (!signedIn()) {
    pendingPlay = current.slug; openSignIn(false);
    $('#si-form .si-lead').textContent = `Sign in to play ${current.title}. New here? Make a free account — it only takes a minute.`;
    return;
  }
  pendingPlay = null;
  if (needsCoins(current)) {
    stopCoinTimer(); coinGame = current.title;
    if (credit <= 0) {
      const r = await payMinute();
      if (r !== 'math' && r !== 'wl') { coinGame = null; wlMins = 0; needCoinsDialog(current, r === 'cap' ? 'cap' : 'none'); return; }
      credit = 60; coinMins = 1;
    }
    warned = false; coinTimer = setInterval(secondTick, 1000); showCoins(); refreshLeft();
  }
  const st = $('#stage'); st.querySelectorAll('iframe').forEach(f => f.remove());
  let f;
  if (current.community) {
    f = h('iframe', { sandbox: 'allow-scripts allow-pointer-lock', allow: 'autoplay; gamepad', title: current.title });
    fetch(current.fileUrl, { cache: 'no-cache' }).then(r => r.text()).then(html => { f.srcdoc = SANDBOX_SHIM + html; }).catch(() => toast('We couldn’t load this game. Try again.'));
  } else f = h('iframe', { src: `${ROOT}games/${current.slug}/?v=${encodeURIComponent(current.version || 1)}`, allow: 'autoplay; fullscreen; gamepad', title: current.title });
  $('#start').hidden = true; st.append(f); fitFrame(); playing = true; markPlayed(current.slug); beginSession(current.slug);
  setTimeout(() => f.focus(), 400);
  if (SMALL()) setFull(true);   // phones: open the game full screen, like other game sites
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
function stopGame() { stopCoinTimer(); endSession(); const st = $('#stage'); st.querySelectorAll('iframe').forEach(f => f.remove()); $('#start').hidden = false; playing = false; setFull(false); }
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
$('#full-btn').addEventListener('click', async () => { if (!playing) await playGame(); if (playing) setFull(true); });
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
  $('#si-form .si-lead').textContent = 'Your plays, play time and saved games follow you to any computer.';
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
// Password rule (NIST SP 800-63B-4 style): length, no easy passwords, not the ID. No character-type rules. The server checks the same on resets.
const COMMON_PW = new Set('12345678 123456789 1234567890 password password1 password12 password123 passw0rd qwerty123 qwertyuiop iloveyou iloveyou1 11111111 00000000 88888888 12341234 asdfasdf asdfghjkl qwertyui abc12345 abcd1234 1q2w3e4r 1qaz2wsx zaq12wsx zxcvbnm1 baseball baseball1 football football1 basketball soccer123 princess princess1 sunshine sunshine1 superman superman1 starwars pokemon1 pokemon123 minecraft minecraft1 fortnite fortnite1 roblox123 robloxian letmein1 welcome1 welcome123 trustno1 computer michelle jennifer whatever dragon123 monkey123 shadow123 master123 killer123 charlie1 freedom1 internet 00001111 87654321 11223344 12121212 qwer1234 asdf1234 zxcv1234 game1234 gamer123 playgame password! iloveyou! chocolate butterfly unicorn1 spiderman batman123 ninja123 hello123 hello1234 abcdefgh aaaaaaaa'.split(' '));
const pwCommon = p => { const l = p.toLowerCase(); return COMMON_PW.has(l) || /^(.)\1+$/.test(l) || '01234567890123456789'.includes(l) || '98765432109876543210'.includes(l) || 'abcdefghijklmnopqrstuvwxyz'.includes(l); };
const pwHasName = (p, id) => { const l = p.toLowerCase(); return l.includes('playcraft') || (id && id.length >= 3 && l.includes(id.toLowerCase())); };
const RULES = { len: p => p.length >= 8, common: p => p.length > 0 && !pwCommon(p), name: p => p.length > 0 && !pwHasName(p, ($('#su-id') ? $('#su-id').value.trim() : '')) };
const pwOk = p => Object.values(RULES).every(f => f(p));
$('#su-pw').addEventListener('input', () => { const p = $('#su-pw').value; document.querySelectorAll('#pw-rules li').forEach(li => li.classList.toggle('ok', RULES[li.dataset.r](p))); });
function checkMatch() {
  const a = $('#su-pw').value, b = $('#su-pw2').value, hint = $('#su-pw2-hint');
  hint.className = 'hint';
  if (!b) { hint.textContent = ''; return; }
  const ok = a === b; hint.textContent = ok ? '✓ Passwords match.' : '✗ Not the same yet.'; hint.classList.add(ok ? 'good' : 'bad');
}
$('#su-pw').addEventListener('input', checkMatch); $('#su-pw2').addEventListener('input', checkMatch);
ageSel.addEventListener('change', () => { const a = +ageSel.value; $('#su-parent-row').hidden = !(a && a < 13); $('#su-recovery-row').hidden = !(a >= 13); });
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
  const parentEmail = $('#su-parent').value.trim();
  if (age < 13 && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(parentEmail)) return say('Because you’re under 13, please type your parent’s email so they can approve your account.');
  if (pw.length < 8) return say('Your password needs at least 8 characters.');
  if (pwCommon(pw)) return say('That password is too easy to guess. Try three words, like tiger-pizza-moon.');
  if (pwHasName(pw, id)) return say('Your password can’t contain your ID or “playcraft”.');
  const recEmail = age >= 13 ? $('#su-recovery').value.trim() : '';
  if (recEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recEmail)) return say('That recovery email doesn’t look right. Fix it or leave it empty.');
  if (pw !== $('#su-pw2').value) return say('The two passwords don’t match. Type them again.');
  if (pw.toLowerCase().includes(id)) return say('Your password can’t contain your ID.');
  go.disabled = true; go.textContent = 'Creating…';
  try {
    if (!(await ACC.idAvailable(id))) { say('Someone already has this ID. Try another one.'); }
    else {
      await ACC.signUp({ id, password: pw, nickname: nick, age, guardianOk: age < 13 });
      if (age < 13) { try { await ACC.requestParentConsent(parentEmail); } catch { toast('Account made. Open My Games to send the message to your parent again.'); } }
      dlg.close(); $('#su-form').reset(); $('#su-parent-row').hidden = true; $('#su-recovery-row').hidden = true;
      if (recEmail) setTimeout(() => addRecovery(pw, recEmail), 400); document.querySelectorAll('#pw-rules li').forEach(li => li.classList.remove('ok')); $('#su-pw2-hint').textContent = '';
      toast(age < 13 ? `Welcome, ${nick}! 🎉 You can play now. We sent your parent an email so they can turn on leaderboards and online play.` : `Welcome to PlayCraft, ${nick}! 🎉`);
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
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { menu.hidden = true; $('#acct-btn').focus(); } });
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
  renderAccount(); playLabel();
  if (!signedIn() && playing) stopGame();
  if (signedIn() && pendingPlay && current && current.slug === pendingPlay && !$('#v-game').hidden) { if (dlg.open) dlg.close(); playGame(); }
  if (signedIn() && !mergedOnce) { // bring games saved on this device into the account, once
    mergedOnce = true; const local = store.get('saved');
    await refreshAccountData();
    for (const s of local) if (!cloudSaved.includes(s)) { await ACC.setSaved(s, true).catch(() => {}); cloudSaved.push(s); }
    store.set('saved', []); store.set('played', []);
  } else await refreshAccountData();
  if (!signedIn()) mergedOnce = false;
  $('#req-btn').hidden = !(signedIn() && ACC.profile && ACC.profile.is_admin);
  if (GAMES.length) { if (current) { syncSave(); if (!$('#v-game').hidden) renderComments(); } if (!$('#v-home').hidden) renderHome(); if (!$('#v-my').hidden) openMy(); if (!$('#v-admin').hidden) openAdmin(); if (!$('#v-submit').hidden) openSubmit(); }
});
renderAccount();

/* ---------- admin page ---------- */
let admData = null;
async function openAdmin() {
  show('admin', null);
  const isAdm = signedIn() && ACC.profile && ACC.profile.is_admin;
  $('#adm-denied').hidden = !!isAdm; $('#adm-body').hidden = !isAdm;
  if (!isAdm) return;
  renderReview(); renderDaily(); renderRequests(); renderPendingComments();
  try { admData = await ACC.adminData(); } catch { toast('Couldn’t load admin data. Try Refresh.'); return; }
  renderAdmin();
}

async function approveUser(p) {
  if (!(await ask(`Approve ${p.username}${p.age ? ' (age ' + p.age + ')' : ''}? Do this only after their parent has said OK. Leaderboards, online play and sending in games open for them.`))) return;
  try { await ACC.adminSetApproved(p.id, true); toast(`${p.username} now has every feature.`); openAdmin(); } catch { toast('Couldn’t approve. Try again.'); }
}
async function renderWaiting(profiles) {
  const w = profiles.filter(p => p.approved === false), d = t => t ? new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
  $('#adm-wait-wrap').hidden = !w.length; $('#adm-wait-count').textContent = w.length ? `${w.length} waiting` : '';
  if (!w.length) return;
  const reqs = await ACC.adminParentConsents().catch(() => []), by = Object.fromEntries(reqs.map(r => [r.user_id, r]));
  const ready = reqs.length ? reqs[0].mail_ready : null;
  const head = ready === false ? [h('li', { class: 'note', text: '✉️ The email service isn’t set up yet, so nothing is sent automatically. Copy each parent link below and send it to the parent yourself.' })] : [];
  $('#adm-wait').replaceChildren(...head, ...w.map(p => {
    const r = by[p.id];
    const info = r ? `parent ${r.parent_email} · ${r.status === 'declined' ? 'parent said not yet' : 'waiting for parent'} · sent ${r.sends}× · last ${d(r.last_sent)} · link until ${d(r.expires_at)}` : 'no parent email yet';
    return h('li', {},
      h('span', { class: 'pill wait', text: 'Needs parent OK' }),
      h('span', { class: 't' }, `${p.username} · ${p.nickname}`, h('small', { text: `age ${p.age ?? '—'} · signed up ${d(p.created_at)} · ${info}` })),
      r && r.manual_link ? h('button', { class: 'btn ghost tiny', onclick: () => navigator.clipboard.writeText(r.manual_link).then(() => toast('Parent link copied. Send it to the parent.'), () => toast(r.manual_link)) }, '📋 Copy parent link') : null,
      h('button', { class: 'btn primary tiny', onclick: () => approveUser(p) }, 'Approve'),
      h('button', { class: 'btn ghost tiny', onclick: () => adminAct(p, 'block') }, p.blocked ? 'Unpause' : 'Pause'));
  }));
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
  renderWaiting(profiles);
  $('#adm-rows').replaceChildren(...list.map(p => {
    const u = per[p.id] || { plays: 0, secs: 0, last: null };
    const status = p.approved === false ? h('span', { class: 'pill wait', text: 'Needs parent OK' }) : p.blocked ? h('span', { class: 'pill bad', text: 'Paused' }) : p.is_admin ? h('span', { class: 'pill adm', text: 'Admin' }) : h('span', { class: 'pill ok', text: 'Active' });
    const acts = h('div', { class: 'acts' });
    acts.append(h('button', { class: 'btn primary tiny', onclick: () => openPlayLog(p) }, 'Play log'));
    if (p.id !== me) {
      if (p.approved === false) acts.append(h('button', { class: 'btn primary tiny', onclick: () => approveUser(p) }, 'Approve'));
      acts.append(h('button', { class: 'btn ghost tiny', onclick: () => adminAct(p, 'block') }, p.blocked ? 'Unpause' : 'Pause'));
      acts.append(h('button', { class: 'btn ghost tiny', onclick: () => adminAct(p, 'admin') }, p.is_admin ? 'Remove admin' : 'Make admin'));
      acts.append(h('button', { class: 'btn ghost tiny', title: 'Send a reset link to an email confirmed before (parent or recovery email)', onclick: () => sendResetLink(p) }, 'Send reset link'));
      acts.append(h('button', { class: 'btn ghost tiny', title: 'Learning mode: other games cost coins earned in Word League', onclick: async () => { if (!(await ask(`${p.learn_mode ? 'Turn off' : 'Turn on'} learning mode for ${p.username}?`))) return; try { await ACC.adminSetLearnMode(p.id, !p.learn_mode); toast('Saved.'); openAdmin(); } catch { toast('Couldn’t change it.'); } } }, p.learn_mode ? '📘 Learning: on' : '📘 Learning: off'));
      acts.append(h('button', { class: 'btn ghost tiny', title: 'Clear a forgotten parent PIN', onclick: async () => { if (!(await ask(`Clear the parent PIN for ${p.username}? A parent can then choose a new one.`))) return; try { await ACC.adminClearPin(p.id); toast('PIN cleared.'); } catch { toast('Couldn’t clear it.'); } } }, 'Clear PIN'));
      if (!p.is_admin) acts.append(h('button', { class: 'btn ghost tiny', style: 'color:#b3123d;border-color:#f3b6c6', title: 'Delete this account for good', onclick: () => deleteAccount(p) }, 'Delete account'));
    } else acts.append(h('span', { class: 'note', text: 'You' }));
    return h('tr', {}, h('td', { class: 'mono', text: p.username }), h('td', { text: p.nickname }),
      h('td', {}, p.age ? String(p.age >= 18 ? '18+' : p.age) : '—', p.age && p.age < 13 ? h('span', { class: 'g', title: 'Guardian OK ticked at sign-up', text: p.guardian_ok ? ' ✓G' : ' !G' }) : null),
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
  const agg = {}; for (const r of rows) { const k = dayKey(r.started_at) + '|' + r.game_slug; const A = agg[k] || (agg[k] = { day: dayKey(r.started_at), game_slug: r.game_slug, minutes: 0, plays: 0 }); A.minutes += (Number(r.seconds) || 0) / 60; A.plays++; }
  const aggRows = Object.values(agg).map(r => ({ ...r, minutes: Math.round(r.minutes * 10) / 10 }));
  const chartBox = h('div', { class: 'log-chart' }), legBox = h('ul', { class: 'daily-legend' });
  const span = Math.ceil((Date.now() - Math.min(...rows.map(r => Date.parse(r.started_at)))) / 864e5) + 1;
  let logDays = span <= 14 ? 14 : 30;
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'How many days' }, ...[14, 30, 90].map(n => h('button', { class: 'btn ghost tiny', 'data-n': n, onclick: () => { logDays = n; drawLog(); } }, `${n} days`)));
  const drawLog = () => { const c = dailyChart(aggRows, logDays); chartBox.replaceChildren(c.chart); legBox.replaceChildren(...c.legend); seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.n === logDays)); };
  drawLog();
  $('#adm-log-body').replaceChildren(h('div', { class: 'log-chart-wrap' }, h('div', { class: 'adm-users-head' }, h('h3', { text: 'Play time by day' }), seg), chartBox, legBox), ...days.map(D => h('div', { class: 'log-day' },
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
// Admin can only re-send a reset link to an email that was confirmed before (never type a password or attach a new email).
async function sendResetLink(p) {
  if (!(await ask(`Send a password reset link for ${p.username}? It goes only to the email already confirmed for this account (parent or recovery email).`))) return;
  let r; try { r = await ACC.adminSendReset(p.id); } catch { return toast('Couldn’t send. Try again.'); }
  toast(r === 'parent' ? 'Sent to the parent’s email.' : r === 'self' ? 'Sent to their recovery email.' : r === 'limit' ? 'Too many links for this account today. Try again later.'
    : 'This account has no confirmed email, so no link can be sent. They’ll need a new account.');
}
// Delete an account for good. To avoid mistakes the admin must type the nickname exactly (the server checks it too).
async function deleteAccount(p) {
  const typed = await askText(`Delete ${p.username} for good? Their saves, play records, game time and parent settings are erased, and this can’t be undone. Games they sent in stay on the site.\n\nType the nickname exactly to confirm:\n${p.nickname}`, '', 'Delete for good');
  if (typed === null) return;
  if (typed !== p.nickname) return toast('The nickname doesn’t match, so nothing was deleted.');
  let r; try { r = await ACC.adminDeleteUser(p.id, typed); } catch { return toast('Couldn’t delete. Try again.'); }
  toast(r === 'ok' ? `${p.username} was deleted.` : r === 'mismatch' ? 'The nickname doesn’t match, so nothing was deleted.' : r === 'admin' ? 'Admins can’t be deleted here.' : 'Couldn’t delete.');
  if (r === 'ok') openAdmin();
}
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
function askText(text, value, okLabel = 'Set password', multi = false, inputType = 'text') {
  return new Promise(res => {
    const inp = multi ? h('textarea', { rows: 4, maxlength: 2000, 'aria-label': text, class: 'ask-input' }) : h('input', { type: inputType, value, 'aria-label': okLabel === 'Set password' ? 'New password' : text, class: 'ask-input' });
    if (multi) inp.value = value || '';
    const d = h('dialog', { class: 'confirm' }, h('p', { text }), inp, h('div', { class: 'si-actions' },
      h('button', { class: 'btn ghost', onclick: () => { d.close(); res(null); } }, 'Cancel'),
      h('button', { class: 'btn primary', onclick: () => { const v = inp.value.trim(); d.close(); res(v || null); } }, okLabel)));
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
  const lim = on && ACC.limited;
  $('#sub-signin').hidden = on; $('#game-form').hidden = !on || lim; $('#sub-limited').hidden = !lim;
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
    : [h('li', {}, h('span', { class: 't', text: 'You haven’t sent a game yet.' }), (ACC.limited ? null : h('a', { class: 'btn primary tiny', href: '#/submit' }, 'Submit one')))]));
}
async function renderReview() {
  const list = await ACC.adminPendingGames().catch(() => []);
  $('#adm-review-count').textContent = list.length ? `${list.length} waiting` : '';
  $('#adm-review').replaceChildren(...(list.length ? list.map(g => h('li', {},
    h('span', { class: 't' }, g.title, h('small', { text: `Made by ${g.creator_username} · ${g.category}${g.multiplayer ? ' · online' : ''} · ${g.description || ''}` })),
    h('button', { class: 'btn ghost tiny', onclick: () => previewGame(g) }, '▶ Try it'),
    h('button', { class: 'btn primary tiny', onclick: async () => { if (!(await ask(`Publish “${g.title}” by ${g.creator_username}? Everyone will be able to play it.`))) return; try { await ACC.adminApprove(g); toast('Published!'); renderReview(); } catch (x) { toast('Couldn’t publish: ' + (x.message || 'try again')); } } }, 'Approve'),
    h('button', { class: 'btn ghost tiny', onclick: async () => { const note = await askText(`Why isn’t “${g.title}” ready? ${g.creator_username} will see this note.`, 'Please fix: ', 'Send back'); if (note === null) return; try { await ACC.adminReject(g, note); toast('Sent back with your note.'); renderReview(); } catch (x) { toast('Couldn’t update: ' + (x.message || 'try again')); } } }, 'Send back')))
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
/* ---------- game requests: one inbox per game ---------- */
let reqStatus = 'open', reqGame = '';
const REQ_LABEL = { waiting: ['wait', '⏳ Waiting'], doing: ['adm', '🔧 Working on it'], done: ['ok', '✓ Done'], declined: ['bad', '✕ Declined'] };
const when = t => t ? new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
const gameName = s => bySlug(s) ? bySlug(s).title : s;
function fillReqGames() {
  const opts = sel => GAMES.slice().sort((a, b) => a.title.localeCompare(b.title)).map(g => h('option', { value: g.slug, text: g.title, selected: g.slug === sel }));
  $('#adm-req-game').replaceChildren(h('option', { value: '', text: 'All games' }), ...opts(reqGame));
  const keep = $('#adm-req-new-game').value || reqGame; $('#adm-req-new-game').replaceChildren(...opts(keep));
}
async function renderRequests() {
  fillReqGames();
  document.querySelectorAll('#adm-req-wrap [data-st]').forEach(b => b.classList.toggle('on', b.dataset.st === reqStatus));
  const list = $('#adm-req-list');
  let rows; try { rows = await ACC.adminRequests(); } catch { list.replaceChildren(h('li', { class: 'note', text: 'Couldn’t load requests.' })); return; }
  const isOpen = r => r.status === 'waiting' || r.status === 'doing', n = rows.filter(isOpen).length;
  $('#adm-req-count').textContent = n ? `${n} in progress` : '';
  const shown = rows.filter(r => (!reqGame || r.slug === reqGame) && (reqStatus === 'all' || isOpen(r)));
  list.replaceChildren(...(shown.length ? shown.map(reqItem) : [h('li', { class: 'note', text: reqStatus === 'open' ? 'Nothing in progress. 🎉 Tap All to see finished requests.' : 'No requests yet.' })]));
  renderReqGame();
}
function reqItem(r) {
  const [cls, lab] = REQ_LABEL[r.status] || ['wait', r.status];
  const upd = async (fields, msg) => { try { await ACC.adminUpdateRequest(r.id, fields); toast(msg); renderRequests(); } catch (x) { toast('Couldn’t update: ' + (x.message || 'try again')); } };
  const isOpen = r.status === 'waiting' || r.status === 'doing';
  return h('li', { class: 'req-item' },
    h('span', { class: 'pill ' + cls, text: lab }),
    h('span', { class: 't' }, h('b', { class: 'req-game-name', text: gameName(r.slug) + ' · ' }), h('span', { class: 'req-body', text: r.body }),
      h('small', { text: `#${r.id} · asked by ${r.author_name || '—'} · ${when(r.created_at)}${r.handled_by ? ' · handled by ' + r.handled_by : ''}${r.updated_at && r.status !== 'waiting' ? (r.status === 'done' ? ' · finished ' : r.status === 'declined' ? ' · declined ' : ' · started ') + when(r.updated_at) : ''}` }),
      r.reply ? h('small', { class: 'req-reply', text: '→ ' + r.reply }) : null),
    isOpen ? h('button', { class: 'btn primary tiny', onclick: async () => { const v = await askText('What was changed? (one line)', r.reply || '', 'Mark done', true); if (v !== null) upd({ status: 'done', reply: v }, 'Marked done.'); } }, 'Mark done') : null,
    isOpen ? h('button', { class: 'btn ghost tiny', onclick: async () => { const v = await askText('Why not? (the asker will see this)', '', 'Decline', true); if (v !== null) upd({ status: 'declined', reply: v }, 'Declined.'); } }, 'Decline') : null,
    !isOpen ? h('button', { class: 'btn ghost tiny', onclick: () => upd({ status: 'waiting' }, 'Reopened.') }, 'Reopen') : null,
    h('button', { class: 'btn ghost tiny', 'aria-label': 'Delete request', onclick: async () => { if (!(await ask(`Delete request #${r.id}? This can’t be undone.`))) return; try { await ACC.adminDeleteRequest(r.id); toast('Deleted.'); renderRequests(); } catch { toast('Couldn’t delete.'); } } }, '🗑'));
}
async function renderReqGame() {
  const box = $('#adm-req-info'); box.hidden = !reqGame; if (!reqGame) return;
  const slug = reqGame, owners = await ACC.adminOwners().catch(() => []), own = (owners.find(o => o.slug === slug) || {}).owner;
  const ownLine = h('p', { class: 'req-owner' }, h('b', { text: 'Looked after by: ' }), h('span', { text: own || 'not set yet' }), ' ',
    h('button', { class: 'btn ghost tiny', onclick: async () => { const v = await askText(`Which Claude window looks after ${gameName(slug)}? Only that window should change it. (Leave empty to clear.)`, own || '', 'Save'); if (v === null && !own) return; try { await ACC.adminSetOwner(slug, v || ''); toast('Saved.'); renderReqGame(); } catch { toast('Couldn’t save.'); } } }, own ? 'Change' : 'Set'));
  const hist = h('ul', { class: 'req-commits' }, h('li', { class: 'note', text: 'Loading recent changes…' }));
  box.replaceChildren(ownLine, h('h3', { class: 'hist-h', text: 'Recent changes to this game' }), hist);
  try {
    const cs = await ACC.gameCommits(slug); if (reqGame !== slug) return;
    hist.replaceChildren(...(cs.length ? cs.map(c => h('li', {}, h('span', { class: 'mono', text: when(c.date) }), ' ', h('a', { href: c.url, target: '_blank', rel: 'noopener', text: c.msg }))) : [h('li', { class: 'note', text: 'No changes yet.' })]));
  } catch { hist.replaceChildren(h('li', { class: 'note', text: 'Couldn’t load the change history (GitHub may be busy). Try again later.' })); }
}
$('#adm-req-game').addEventListener('change', e => { reqGame = e.target.value; if (reqGame) $('#adm-req-new-game').value = reqGame; renderRequests(); });
document.querySelectorAll('#adm-req-wrap [data-st]').forEach(b => b.addEventListener('click', () => { reqStatus = b.dataset.st; renderRequests(); }));
$('#adm-req-form').addEventListener('submit', async e => {
  e.preventDefault(); const slug = $('#adm-req-new-game').value, body = $('#adm-req-text').value.trim(); if (!slug || !body) return;
  try { await ACC.adminAddRequest(slug, body); $('#adm-req-text').value = ''; toast('Request added.'); renderRequests(); } catch (x) { toast('Couldn’t add: ' + (x.message || 'try again')); }
});
$('#req-btn').addEventListener('click', async () => {
  if (!current) return; const v = await askText(`What should change in ${current.title}? It goes to the Game requests list on the Admin page.`, '', 'Send request', true);
  if (v === null) return; try { await ACC.adminAddRequest(current.slug, v); toast('Request sent. You can follow it on the Admin page.'); } catch (x) { toast('Couldn’t send: ' + (x.message || 'try again')); }
});
let dailyDays = 14;
const DCOL = ['#6d28d9', '#f97316', '#10b981', '#3b82f6', '#ec4899', '#eab308', '#14b8a6', '#ef4444', '#8b5cf6', '#84cc16', '#0ea5e9', '#f43f5e'];
/* stacked bar chart: minutes per game per day. rows = [{day:'YYYY-MM-DD', game_slug, minutes, plays, players?}] */
function dailyChart(rows, nDays) {
  const key = dt => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const days = []; for (let i = nDays - 1; i >= 0; i--) { const dt = new Date(); dt.setDate(dt.getDate() - i); days.push(key(dt)); }
  const inRange = rows.filter(r => days.includes(String(r.day).slice(0, 10)));
  const tot = {}; inRange.forEach(r => { tot[r.game_slug] = (tot[r.game_slug] || 0) + Number(r.minutes); });
  const games = Object.keys(tot).sort((a, b) => tot[b] - tot[a]), col = s => DCOL[games.indexOf(s) % DCOL.length], name = s => bySlug(s) ? bySlug(s).title : s;
  const by = {}; inRange.forEach(r => { const k = String(r.day).slice(0, 10); (by[k] = by[k] || {})[r.game_slug] = r; });
  const dayTot = days.map(k => Object.values(by[k] || {}).reduce((a, r) => a + Number(r.minutes), 0));
  const all = dayTot.reduce((a, b) => a + b, 0);
  if (!all) return { all, chart: h('p', { class: 'note', text: 'No play time in these days.' }), legend: [] };
  const step = [5, 10, 15, 30, 60, 120, 180, 300, 600].find(s => Math.max(...dayTot) / s <= 5) || 1200, top = Math.max(step, Math.ceil(Math.max(...dayTot) / step) * step);
  const W = 900, H = 300, L = 52, B = 34, T = 18, pw = W - L - 10, ph = H - B - T, bw = pw / days.length, NS = 'http://www.w3.org/2000/svg';
  const el = (n, a, kids) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); (kids || []).forEach(c => e.append(c)); return e; };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'daily-svg', role: 'img', 'aria-label': `Minutes played per day, last ${nDays} days` });
  for (let v = 0; v <= top; v += step) { const y = T + ph - v / top * ph; svg.append(el('line', { x1: L, x2: W - 10, y1: y, y2: y, class: 'grid' }), el('text', { x: L - 8, y: y + 4, 'text-anchor': 'end', class: 'ax' }, [document.createTextNode(v >= 60 && v % 60 === 0 ? (v / 60) + 'h' : v + 'm')])); }
  const lab = k => { const [, m, d] = k.split('-'); return `${+m}/${+d}`; }, every = days.length > 45 ? 7 : days.length > 20 ? 3 : 1;
  days.forEach((k, i) => {
    let y = T + ph; const x = L + i * bw + bw * 0.14, w = bw * 0.72, g = el('g', {});
    games.forEach(s => { const r = by[k] && by[k][s]; if (!r) return; const hgt = Number(r.minutes) / top * ph; y -= hgt;
      g.append(el('rect', { x, y, width: w, height: Math.max(hgt, 0.5), fill: col(s), rx: 2 }, [el('title', {}, [document.createTextNode(`${lab(k)} · ${name(s)}: ${Number(r.minutes)} min · ${r.plays} plays${r.players != null ? ' · ' + r.players + ' players' : ''}`)])])); });
    if (dayTot[i]) g.append(el('text', { x: x + w / 2, y: y - 5, 'text-anchor': 'middle', class: 'val' }, [document.createTextNode(Math.round(dayTot[i]))]));
    if (i % every === 0 || i === days.length - 1) g.append(el('text', { x: x + w / 2, y: H - 12, 'text-anchor': 'middle', class: 'ax' }, [document.createTextNode(lab(k))]));
    svg.append(g); });
  const chart = h('div', { class: 'daily' }); chart.append(svg);
  return { all, chart, legend: games.map(s => h('li', {}, h('i', { style: `background:${col(s)}` }), h('span', { text: name(s) }), h('b', { text: `${Math.round(tot[s])} min` }))) };
}
async function renderDaily() {
  const box = $('#adm-daily'), leg = $('#adm-daily-legend');
  document.querySelectorAll('#adm-daily-wrap [data-days]').forEach(b => b.classList.toggle('on', +b.dataset.days === dailyDays));
  box.replaceChildren(h('p', { class: 'note', text: 'Loading…' })); leg.replaceChildren();
  let rows; try { rows = await ACC.adminDailyMinutes(dailyDays); } catch { box.replaceChildren(h('p', { class: 'note', text: 'Couldn’t load the chart.' })); return; }
  const c = dailyChart(rows, dailyDays);
  $('#adm-daily-sum').textContent = `${Math.round(c.all)} min in ${dailyDays} days`;
  box.replaceChildren(c.chart); leg.replaceChildren(...c.legend);
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
    let nick = {};
    if (extra.length && ACC.publicNicknames) ACC.publicNicknames([...new Set(extra.map(c => c.creator_username))]).then(m => { nick = m; GAMES.forEach(g => { if (g.community && nick[g.author]) g.authorName = nick[g.author]; }); }).catch(() => {});
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
