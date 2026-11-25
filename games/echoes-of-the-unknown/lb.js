/* Echoes of the Unknown — PlayCraft leaderboard (kept outside the built bundle in assets/, which is not edited).
   Ranks explorers by achievements earned, ties broken by level. Reads the game's own state through window.__game
   (exposed by the bundle). One row per player in the shared table game_kv, filed under their own sign-in ID;
   a row is only replaced by a better one. Players are shown by nickname only. */
(function () {
  'use strict';
  var SLUG = 'echoes-of-the-unknown';
  var PCA = (function () { try { return window.parent !== window && window.parent.Account ? window.parent.Account : null; } catch (e) { return null; } })();
  if (!PCA) return;
  var esc = function (t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var myName = function () { try { return PCA.signedIn && PCA.profile ? String(PCA.profile.username || '') : ''; } catch (e) { return ''; } };
  var isLimited = function () { try { return !!PCA.limited; } catch (e) { return false; } };
  var pcReady = async function () { for (var i = 0; i < 50 && !PCA.ready; i++) await new Promise(function (r) { setTimeout(r, 100); }); };
  var better = function (a, b) { return !b || a.a > (+b.a || 0) || (a.a === (+b.a || 0) && a.l > (+b.l || 0)); };
  var sent = null, busy = Promise.resolve();

  function current() {
    var g = window.__game, s = g && g.state;
    if (!s || typeof s.level !== 'number') return null;
    return { a: Object.keys(s.achievements || {}).length, l: s.level };
  }
  function record() {
    var c = current(); if (!c || (c.a === 0 && c.l <= 1)) return;
    if (sent && !better(c, sent)) return;
    busy = busy.then(function () { return send(c); }).catch(function () { });
  }
  async function send(c) {
    await pcReady(); var me = myName(); if (!me || isLimited()) return;
    var old = null; try { old = await PCA.kvGet(SLUG, 'rank', me); } catch (e) { }
    if (better(c, old)) { await PCA.kvSet(SLUG, 'rank', me, { a: c.a, l: c.l, t: Date.now() }); sent = c; }
    else sent = { a: +old.a || 0, l: +old.l || 0 };
  }
  async function render() {
    var el = document.getElementById('lbBoard'); if (!el) return;
    await pcReady(); var me = myName(), rows = [];
    try {
      rows = (await PCA.kvList(SLUG, 'rank', 300)).filter(function (r) { return r && r.data; }).map(function (r) {
        return { id: r.doc_id, nk: r.data.nick || r.data.n || r.doc_id, a: +r.data.a || 0, l: +r.data.l || 0, t: +r.data.t || 0 };
      }).sort(function (x, y) { return y.a - x.a || y.l - x.l || x.t - y.t; });
    } catch (e) { }
    var myI = -1; rows.forEach(function (r, i) { if (r.id === me && myI < 0) myI = i; });
    var row = function (r, i) { return '<div class="r' + (r.id === me ? ' me' : '') + '"><span>' + (i < 3 ? ['🥇', '🥈', '🥉'][i] : (i + 1) + '.') + '</span><span>' + esc(String(r.nk).slice(0, 16)) + '</span><span>' + r.a + '</span><span>Lv ' + r.l + '</span></div>'; };
    var h = '<h3>Top Explorers</h3>' + (rows.length ? '<div class="r hd"><span></span><span>Explorer</span><span>Achievements</span><span>Level</span></div>' + rows.slice(0, 10).map(row).join('') : '<p class="m">No explorers yet. Be the first!</p>');
    if (myI >= 10) h += '<p class="m">…</p>' + row(rows[myI], myI);
    if (!me) h += '<p class="m">Sign in to PlayCraft to join the board.</p>';
    else if (isLimited()) h += '<p class="m">Your score will join the board after your parent approves your PlayCraft account (My Games → Your account → “Ask my parent”).</p>';
    el.innerHTML = h; el.hidden = false;
  }
  function onMenu() { var m = document.getElementById('menu'); if (m && !m.classList.contains('hidden')) { record(); busy.then(render); } }

  setInterval(record, 10000);
  document.addEventListener('visibilitychange', function () { if (document.hidden) record(); });
  window.addEventListener('pagehide', record);
  function init() {
    var m = document.getElementById('menu'); if (!m) return;
    new MutationObserver(onMenu).observe(m, { attributes: true, attributeFilter: ['class'] });
    onMenu();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
