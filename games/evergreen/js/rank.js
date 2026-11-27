// EVERGREEN — Zanycade leaderboard: the most loved villages, ranked by reputation (the game's own progress score).
// One row per player in the shared table game_kv, filed under their own sign-in ID; players are shown by nickname only.
// A row is only replaced when the new reputation is higher. Shown on the title screen and in the pause menu.
import { E, LEVELS, levelOf, esc } from './ctx.js';

const SLUG = 'evergreen';
const PCA = (() => { try { return window.parent !== window && window.parent.Account ? window.parent.Account : null; } catch (e) { return null; } })();
const myName = () => { try { return PCA && PCA.signedIn && PCA.profile ? String(PCA.profile.username || '') : ''; } catch (e) { return ''; } };
const isLimited = () => { try { return !!(PCA && PCA.limited); } catch (e) { return false; } };
async function pcReady() { for (let i = 0; i < 50 && PCA && !PCA.ready; i++) await new Promise(r => setTimeout(r, 100)); }

let sentRep = -1, busy = Promise.resolve(), cache = null;
const playing = () => (E.mode === 'play' || E.mode === 'build') && E.S;

function record() {
  if (!PCA || !playing()) return;
  const rep = Math.floor(+E.S.rep || 0), day = +E.S.day || 1;
  if (rep <= 0 || rep <= sentRep) return;
  busy = busy.then(() => send(rep, day)).catch(() => { });
}
async function send(rep, day) {
  await pcReady(); const me = myName(); if (!me || isLimited()) return;
  let c = null; try { c = await PCA.kvGet(SLUG, 'rank', me); } catch (e) { }
  const cs = c ? +c.s || 0 : 0;
  if (rep > cs) { await PCA.kvSet(SLUG, 'rank', me, { s: rep, l: levelOf(rep), d: day, t: Date.now() }); cache = null; }
  sentRep = Math.max(rep, cs);
}

async function rows() {
  if (cache && Date.now() - cache.t < 20000) return cache.rows;
  let r = [];
  try { r = (await PCA.kvList(SLUG, 'rank', 300)).filter(x => x && x.data && +x.data.s > 0).map(x => ({ id: x.doc_id, nk: x.data.nick || x.data.n || x.doc_id, s: +x.data.s, d: +x.data.d || 0, t: +x.data.t || 0 })).sort((a, b) => b.s - a.s || a.d - b.d || a.t - b.t); } catch (e) { }
  cache = { t: Date.now(), rows: r }; return r;
}
async function render(el) {
  if (!el || !PCA) return; await pcReady();
  const me = myName(), list = await rows(), myI = list.findIndex(r => r.id === me);
  const row = (r, i) => `<div class="r${r.id === me ? ' me' : ''}"><span>${i < 3 ? ['🥇', '🥈', '🥉'][i] : (i + 1) + '.'}</span><span>${esc(String(r.nk).slice(0, 16))}</span><span><b>${r.s}</b></span><span>${esc(LEVELS[Math.min(LEVELS.length, levelOf(r.s)) - 1].name)}</span></div>`;
  let h = '<h3>🏆 Most loved villages</h3>' + (list.length ? '<div class="r hd"><span></span><span>Player</span><span>Reputation</span><span>Village</span></div>' + list.slice(0, 10).map(row).join('') : '<p class="m">No villages yet. Be the first!</p>');
  if (myI >= 10) h += '<p class="m">…</p>' + row(list[myI], myI);
  if (!me) h += '<p class="m">Sign in to Zanycade to join the board.</p>';
  else if (isLimited()) h += '<p class="m">Your score will join the board after your parent approves your Zanycade account (My Games → Your account → “Ask my parent”).</p>';
  el.innerHTML = h; el.hidden = false;
}

if (PCA) {
  // check every 15 s while playing, and right away when the page is hidden
  setInterval(record, 15000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) record(); });
  window.addEventListener('pagehide', record);
  // title screen board
  render(document.getElementById('evlbTitle'));
  // pause menu board: the panel is rebuilt each time it opens
  const panel = document.getElementById('panel');
  if (panel) new MutationObserver(() => { const el = panel.querySelector('#evlb'); if (el && !el.dataset.done) { el.dataset.done = '1'; record(); busy.then(() => render(el)); } }).observe(panel, { childList: true });
}
