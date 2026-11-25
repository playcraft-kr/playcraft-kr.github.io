// PlayCraft accounts: sign in with an admin-issued ID + password, and keep play records per person.
// The publishable key below is meant to be public; every table is locked so each player only sees their own rows.
(() => {
'use strict';
const SUPABASE_URL = 'https://mglfvwxlleevbvglijzl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0jKAyNY2GzWyIU63M_eD3g_PkVubQ6X';
const ID_DOMAIN = 'id.playcraft.kr'; // login IDs become ID@id.playcraft.kr behind the scenes (no real email needed)

const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, storageKey: 'pc.auth' } }) : null;
let user = null, profile = null, accessToken = null;
const listeners = new Set();
const emit = () => listeners.forEach(fn => { try { fn(); } catch {} });

const Account = {
  ready: false,
  get user() { return user; },
  get profile() { return profile; },
  get signedIn() { return !!user; },
  // 게임끼리 실시간으로 만나는 채널용 (방송 채널만 사용)
  // under-13 accounts waiting for a parent's OK: no online play, nothing on leaderboards
  get limited() { return !!(profile && profile.approved === false); },
  get realtime() { return sb && !(profile && profile.approved === false) ? { channel: (...a) => sb.channel(...a), removeChannel: c => sb.removeChannel(c) } : null; },
  onChange(fn) { listeners.add(fn); },

  async signIn(id, password) {
    if (!sb) throw new Error('offline');
    const clean = String(id || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{2,30}$/.test(clean)) throw new Error('bad-id');
    const { error } = await sb.auth.signInWithPassword({ email: `${clean}@${ID_DOMAIN}`, password });
    if (error) throw error;
  },
  async signOut() { if (sb) await sb.auth.signOut(); },
  async idAvailable(id) {
    if (!sb) return true;
    const { data, error } = await sb.rpc('id_available', { wanted: id });
    return error ? true : !!data;
  },
  async signUp({ id, password, nickname, age, guardianOk }) {
    if (!sb) throw new Error('offline');
    const clean = String(id || '').trim().toLowerCase();
    const { data, error } = await sb.auth.signUp({ email: `${clean}@${ID_DOMAIN}`, password,
      options: { data: { nickname, age, guardian_ok: !!guardianOk } } });
    if (error) throw error;
    if (!data.session) await Account.signIn(clean, password); // in case the project asks for confirmation later
  },

  // ---- admin (allowed only for admin accounts; the database checks this too) ----
  async adminData() {
    // totals are added up inside the database, so they stay right no matter how many plays there are
    const [p, us, gs, tot] = await Promise.all([
      sb.from('profiles').select('id, username, nickname, age, guardian_ok, is_admin, blocked, created_at, learn_mode, approved').order('created_at', { ascending: false }).range(0, 4999),
      sb.rpc('admin_user_stats'), sb.rpc('admin_game_stats'), sb.rpc('admin_totals'),
    ]);
    for (const r of [p, us, gs, tot]) if (r.error) throw r.error;
    return { profiles: p.data || [], userStats: us.data || [], gameStats: gs.data || [], totals: tot.data || {} };
  },
  async adminSetBlocked(id, value) { const { error } = await sb.rpc('admin_set_blocked', { target: id, value }); if (error) throw error; },
  // ---- ideas & hearts under each game (SQL 018) ----
  async comments(slug) { const { data, error } = await sb.rpc('game_comments_list', { p_slug: slug }); if (error) throw error; return data || []; },
  async addComment(slug, body) { const { data, error } = await sb.rpc('add_comment', { p_slug: slug, p_body: body }); if (error) throw error; return data; },
  async deleteComment(id) { const { error } = await sb.rpc('delete_my_comment', { p_id: id }); if (error) throw error; },
  async toggleHeart(id) { const { data, error } = await sb.rpc('toggle_heart', { p_id: id }); if (error) throw error; return data; },
  async adminCommentStatus(id, status) { const { error } = await sb.rpc('admin_comment_status', { p_id: id, p_status: status }); if (error) throw error; },
  async adminPickComment(id, version) { const { error } = await sb.rpc('admin_pick_comment', { p_id: id, p_version: version }); if (error) throw error; },
  async adminPendingComments() { const { data, error } = await sb.rpc('admin_pending_comments'); if (error) throw error; return data || []; },
  // ---- password recovery (SQL 017) ----
  async requestPasswordReset(id) { const { error } = await sb.rpc('request_password_reset', { p_username: String(id || '').trim().toLowerCase() }); if (error) throw error; },
  async sendUsernames(email) { const { error } = await sb.rpc('send_usernames', { p_email: email }); if (error) throw error; },
  async myRecoveryEmail() { const { data, error } = await sb.rpc('my_recovery_email'); if (error) throw error; return (data && data[0]) || null; },
  async setRecoveryEmail(pw, email) { const { data, error } = await sb.rpc('set_recovery_email', { p_password: pw, p_email: email }); if (error) throw error; return data; },
  async confirmRecoveryEmail(code) { const { data, error } = await sb.rpc('confirm_recovery_email', { p_code: code }); if (error) throw error; return data; },
  async removeRecoveryEmail(pw) { const { data, error } = await sb.rpc('remove_recovery_email', { p_password: pw }); if (error) throw error; return data; },
  async adminSendReset(id) { const { data, error } = await sb.rpc('admin_send_reset', { target: id }); if (error) throw error; return data; },
  async adminDeleteUser(id, nickname) { const { data, error } = await sb.rpc('admin_delete_user', { target: id, confirm_nickname: nickname }); if (error) throw error; return data; },
  async adminResetPassword(id, pw) { const { error } = await sb.rpc('admin_reset_password', { target: id, new_password: pw }); if (error) throw error; },
  // one player's play sessions, newest first (admin only; checked in the database)
  async adminUserPlays(id) { const { data, error } = await sb.rpc('admin_user_plays', { target: id, max_rows: 500 }); if (error) throw error; return data || []; },
  // minutes played per game per day, grouped in the admin's own time zone (admin only; checked in the database)
  async adminDailyMinutes(days) {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const { data, error } = await sb.rpc('admin_daily_minutes', { n_days: days, zone }); if (error) throw error; return data || [];
  },
  // games the admin already approved or sent back, newest decision first
  async adminReviewedGames() {
    const { data, error } = await sb.from('community_games').select('slug, title, category, creator_username, status, review_note, created_at, reviewed_at').in('status', ['approved', 'rejected']).order('reviewed_at', { ascending: false }).limit(200);
    if (error) throw error; return data || [];
  },
  // ---- game requests: one inbox per game (admin only; checked in the database) ----
  async adminRequests() {
    const { data, error } = await sb.from('game_requests').select('id, slug, author_name, body, status, reply, handled_by, created_at, updated_at').order('created_at', { ascending: false }).limit(500);
    if (error) throw error; return data || [];
  },
  async adminAddRequest(slug, body) { const { error } = await sb.from('game_requests').insert({ slug, body }); if (error) throw error; },
  async adminUpdateRequest(id, fields) { const { error } = await sb.from('game_requests').update(fields).eq('id', id); if (error) throw error; },
  async adminDeleteRequest(id) { const { error } = await sb.from('game_requests').delete().eq('id', id); if (error) throw error; },
  async adminOwners() { const { data, error } = await sb.from('game_owners').select('slug, owner'); if (error) throw error; return data || []; },
  async adminSetOwner(slug, owner) {
    const r = owner ? await sb.from('game_owners').upsert({ slug, owner, updated_at: new Date().toISOString() }) : await sb.from('game_owners').delete().eq('slug', slug);
    if (r.error) throw r.error;
  },
  // what changed in a game lately, from the public GitHub history of its folder
  async gameCommits(slug) {
    const r = await fetch(`https://api.github.com/repos/playcraft-kr/playcraft-kr.github.io/commits?path=games/${encodeURIComponent(slug)}&per_page=12`);
    if (!r.ok) throw new Error('history ' + r.status);
    return (await r.json()).map(c => ({ sha: c.sha, url: c.html_url, date: c.commit.author.date, msg: c.commit.message.split('\n')[0] }));
  },

  // ---- learning mode: other games cost coins earned in the learning games (the database guards the switch) ----
  async learnStatus() { const { data, error } = await sb.rpc('learn_status'); if (error) throw error; return (data && data[0]) || { learn_mode: false, has_pin: false }; },
  async setupLearnMode(on, pin) { const { error } = await sb.rpc('setup_learn_mode', { p_on: !!on, p_pin: pin }); if (error) throw error; await loadProfile(); emit(); },
  async setLearnMode(pin, on) { const { data, error } = await sb.rpc('set_learn_mode', { p_pin: pin, p_on: !!on }); if (error) throw error; if (data === 'ok') { await loadProfile(); emit(); } return data; },
  // ---- parent e-mail consent (under 13) ----
  async requestParentConsent(email) { const { data, error } = await sb.rpc('request_parent_consent', { p_email: email }); if (error) throw error; return data || {}; },
  async myParentConsent() { const { data, error } = await sb.rpc('my_parent_consent'); if (error) throw error; return (data && data[0]) || null; },
  async adminParentConsents() { const { data, error } = await sb.rpc('admin_parent_consents'); if (error) throw error; return data || []; },
  async adminSetApproved(id, value) { const { error } = await sb.rpc('admin_set_approved', { target: id, value }); if (error) throw error; },
  async adminSetLearnMode(id, value) { const { error } = await sb.rpc('admin_set_learn_mode', { target: id, value }); if (error) throw error; },
  async adminClearPin(id) { const { error } = await sb.rpc('admin_clear_parent_pin', { target: id }); if (error) throw error; },
  // ---- learning mode, round 2: game minutes from Math Space War, daily limit, 10 Word League coins per minute ----
  get WL_PER_MIN() { return 10; },
  async learnWallet() { const { data, error } = await sb.rpc('learn_wallet', { p_tz: TZ() }); if (error) throw error; return (data && data[0]) || null; },
  async mathRound(n, levels) { const { data, error } = await sb.rpc('math_round', { p_n: n, p_levels: levels, p_tz: TZ() }); if (error) throw error; return data || {}; },
  async playMinute(wlOk) { const { data, error } = await sb.rpc('play_minute', { p_wl_ok: !!wlOk, p_tz: TZ() }); if (error) throw error; return data; },
  async setLearnLimits(pin, playCap, mathGrade) { const { data, error } = await sb.rpc('set_learn_limits', { p_pin: pin, p_play_cap: playCap, p_math_grade: mathGrade }); if (error) throw error; return data; },
  // The coin wallet is Word League's: its saved state keeps xp, spent and (written by the game) pcCoins.
  async walletCoins() {
    const st = walletState(await this.loadSave(WALLET_SLUG));
    return st ? coinsOf(st.doc) : 0;
  },
  async walletSpend(n, keep = 0) {
    const sv = await this.loadSave(WALLET_SLUG), st = walletState(sv);
    if (!st || coinsOf(st.doc) < n + keep) return false;
    const d = st.doc, before = coinsOf(d); d.spent = (+d.spent || 0) + n; d.pcCoins = Math.max(0, before - n);
    st.data.docs[st.key] = d; st.data.ts = (+st.data.ts || 0) + 1;
    await this.writeSave(WALLET_SLUG, st.data); return true;
  },
  async walletNote(name, cost) {
    const sv = await this.loadSave(WALLET_SLUG), st = walletState(sv); if (!st || !cost) return;
    st.doc.claims = [...(st.doc.claims || []), { name, cost, at: new Date().toISOString(), pc: 1 }];
    st.data.docs[st.key] = st.doc; st.data.ts = (+st.data.ts || 0) + 1; await this.writeSave(WALLET_SLUG, st.data);
  },
  async adminSetAdmin(id, value) { const { error } = await sb.rpc('admin_set_admin', { target: id, value }); if (error) throw error; },

  // ---- player-made games ----
  publicUrl(path) { return path ? sb.storage.from('community').getPublicUrl(path).data.publicUrl : null; },
  async approvedGames() {
    if (!sb) return [];
    const { data } = await sb.from('community_games').select('slug, title, description, category, multiplayer, creator_username, file_path, cover_path, created_at, reviewed_at').eq('status', 'approved').order('reviewed_at', { ascending: false });
    return data || [];
  },
  async myGames() {
    if (!user) return [];
    const { data } = await sb.from('community_games').select('slug, title, status, review_note, created_at, file_path, cover_path').eq('creator_id', user.id).order('created_at', { ascending: false });
    return data || [];
  },
  async submitGame({ title, description, category, multiplayer, file, cover }) {
    if (!user) throw new Error('Please sign in first.');
    const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'game';
    const slug = (/^[a-z0-9]/.test(base) ? base : 'g-' + base) + '-' + Math.random().toString(36).slice(2, 6);
    const dir = `${user.id}/${slug}`;
    const up = await sb.storage.from('submissions').upload(`${dir}/game.html`, file, { contentType: 'text/html', upsert: false });
    if (up.error) throw up.error;
    let coverPath = null;
    if (cover) {
      const ext = (cover.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      const c = await sb.storage.from('submissions').upload(`${dir}/cover.${ext}`, cover, { contentType: cover.type, upsert: false });
      if (c.error) throw c.error; coverPath = `${dir}/cover.${ext}`;
    }
    const { error } = await sb.from('community_games').insert({ slug, title, description, category, multiplayer, file_path: `${dir}/game.html`, cover_path: coverPath });
    if (error) { await sb.storage.from('submissions').remove([`${dir}/game.html`].concat(coverPath ? [coverPath] : [])); throw error; }
    return slug;
  },
  async withdrawGame(g) {
    const { error } = await sb.from('community_games').delete().eq('slug', g.slug); if (error) throw error;
    await sb.storage.from('submissions').remove([g.file_path].concat(g.cover_path ? [g.cover_path] : []));
  },
  async adminPendingGames() {
    const { data, error } = await sb.from('community_games').select('*').eq('status', 'pending').order('created_at');
    if (error) throw error; return data || [];
  },
  async submissionText(path) {
    const { data, error } = await sb.storage.from('submissions').download(path); if (error) throw error; return await data.text();
  },
  async adminApprove(g) {
    const html = await sb.storage.from('submissions').download(g.file_path); if (html.error) throw html.error;
    const pubFile = `${g.slug}/game.html`;
    const htmlBlob = new Blob([await html.data.arrayBuffer()], { type: 'text/html' }); // storage hands HTML back labeled as plain text
    const u1 = await sb.storage.from('community').upload(pubFile, htmlBlob, { contentType: 'text/html', upsert: true }); if (u1.error) throw u1.error;
    let pubCover = null;
    if (g.cover_path) {
      const cv = await sb.storage.from('submissions').download(g.cover_path);
      if (!cv.error) { const ext = g.cover_path.split('.').pop(), type = ext === 'jpg' ? 'image/jpeg' : 'image/' + ext; pubCover = `${g.slug}/cover.${ext}`; const u2 = await sb.storage.from('community').upload(pubCover, new Blob([await cv.data.arrayBuffer()], { type }), { contentType: type, upsert: true }); if (u2.error) pubCover = null; }
    }
    const { error } = await sb.rpc('admin_review_game', { game: g.slug, approve: true, note: '', public_file: pubFile, public_cover: pubCover });
    if (error) throw error;
  },
  async adminReject(g, note) {
    const { error } = await sb.rpc('admin_review_game', { game: g.slug, approve: false, note: note || '', public_file: null, public_cover: null });
    if (error) throw error;
  },

  // ---- saved games ----
  async savedList() {
    if (!user) return null;
    const { data } = await sb.from('saved_games').select('game_slug, created_at').eq('user_id', user.id).order('created_at', { ascending: false });
    return (data || []).map(r => r.game_slug);
  },
  async setSaved(slug, on) {
    if (!user) return;
    if (on) await sb.from('saved_games').upsert({ game_slug: slug }, { onConflict: 'user_id,game_slug' });
    else await sb.from('saved_games').delete().eq('user_id', user.id).eq('game_slug', slug);
  },

  // ---- game progress (one row per player per game; table game_saves, RLS: own rows only) ----
  async loadSave(slug) {
    if (!user) return null;
    const { data, error } = await sb.from('game_saves').select('data, updated_at').eq('user_id', user.id).eq('game_slug', slug).maybeSingle();
    if (error) throw error;
    return data ? { data: data.data, updatedAt: data.updated_at } : null;
  },
  async writeSave(slug, payload) {
    if (!user) return false;
    const { error } = await sb.from('game_saves').upsert({ user_id: user.id, game_slug: slug, data: payload, updated_at: new Date().toISOString() }, { onConflict: 'user_id,game_slug' });
    if (error) throw error;
    return true;
  },

  // ---- shared game data: leaderboards and shared decks (table game_kv; anyone reads, players write their own rows) ----
  async kvGet(game, coll, id) {
    if (!sb) return null;
    const { data, error } = await sb.from('game_kv').select('data').eq('game', game).eq('coll', coll).eq('doc_id', id).maybeSingle();
    if (error) throw error;
    return data ? data.data : null;
  },
  async kvList(game, coll, limit = 500) {
    if (!sb) return [];
    const { data, error } = await sb.from('game_kv').select('doc_id, data').eq('game', game).eq('coll', coll).order('updated_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return data || [];
  },
  async kvSet(game, coll, id, value) {
    if (!user) throw new Error('Please sign in first.');
    if (profile && profile.approved === false) return false;
    const { error } = await sb.from('game_kv').upsert({ game, coll, doc_id: id, data: value }, { onConflict: 'game,coll,doc_id' });
    if (error) throw error;
    return true;
  },

  // ---- play sessions ----
  async startPlay(slug) {
    if (!user) return null;
    const { data } = await sb.from('plays').insert({ game_slug: slug }).select('id').single();
    return data ? data.id : null;
  },
  async updatePlay(id, seconds) {
    if (!user || !id) return;
    await sb.from('plays').update({ seconds: Math.min(86400, Math.round(seconds)) }).eq('id', id).eq('user_id', user.id);
  },
  // last save when the tab is closing: a normal request gets cancelled, so use keepalive
  updatePlayOnExit(id, seconds) {
    if (!user || !id || !accessToken) return;
    try {
      fetch(`${SUPABASE_URL}/rest/v1/plays?id=eq.${encodeURIComponent(id)}&user_id=eq.${user.id}`, {
        method: 'PATCH', keepalive: true,
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ seconds: Math.min(86400, Math.round(seconds)) }),
      });
    } catch {}
  },
  async deleteMyAccount() {
    const { error } = await sb.rpc('delete_my_account'); if (error) throw error;
    await sb.auth.signOut();
  },
  async stats() {
    if (!user) return null;
    const { data, error } = await sb.rpc('my_game_stats');
    if (error) throw error;
    const games = (data || []).map(r => ({ slug: r.game_slug, plays: Number(r.plays), seconds: Number(r.seconds), last: r.last_played }));
    return { totalPlays: games.reduce((s, g) => s + g.plays, 0), totalSeconds: games.reduce((s, g) => s + g.seconds, 0), games };
  },
};
window.Account = Account;


const WALLET_SLUG = 'ssat-word-league';
const TZ = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; } };
// Word League saves { ts, docs: { '<…>study/state': state, … } }
function walletState(sv) {
  const data = sv && sv.data; if (!data || !data.docs) return null;
  const key = Object.keys(data.docs).find(k => /study\/state$/.test(k)); if (!key) return null;
  return { data, key, doc: data.docs[key] || {} };
}
const coinsOf = d => Math.max(0, d.pcCoins != null ? +d.pcCoins : (+d.xp || 0) - (+d.spent || 0));
async function loadProfile() {
  if (!user) { profile = null; return; }
  const { data } = await sb.from('profiles').select('username, nickname, is_admin, blocked, age, learn_mode, approved').eq('id', user.id).maybeSingle();
  profile = data || { username: (user.email || '').split('@')[0], nickname: (user.email || '').split('@')[0], is_admin: false };
}
if (sb) {
  // Don't call the database inside this callback (Supabase docs): defer so the session is fully set first.
  sb.auth.onAuthStateChange((_evt, session) => {
    user = session ? session.user : null; accessToken = session ? session.access_token : null;
    setTimeout(async () => { await loadProfile(); Account.ready = true; emit(); }, 0);
  });
} else { Account.ready = true; }
})();
