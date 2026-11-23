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
  get realtime() { return sb ? { channel: (...a) => sb.channel(...a), removeChannel: c => sb.removeChannel(c) } : null; },
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
      sb.from('profiles').select('id, username, nickname, age, guardian_ok, is_admin, blocked, created_at').order('created_at', { ascending: false }).range(0, 4999),
      sb.rpc('admin_user_stats'), sb.rpc('admin_game_stats'), sb.rpc('admin_totals'),
    ]);
    for (const r of [p, us, gs, tot]) if (r.error) throw r.error;
    return { profiles: p.data || [], userStats: us.data || [], gameStats: gs.data || [], totals: tot.data || {} };
  },
  async adminSetBlocked(id, value) { const { error } = await sb.rpc('admin_set_blocked', { target: id, value }); if (error) throw error; },
  async adminResetPassword(id, pw) { const { error } = await sb.rpc('admin_reset_password', { target: id, new_password: pw }); if (error) throw error; },
  // one player's play sessions, newest first (admin only; checked in the database)
  async adminUserPlays(id) { const { data, error } = await sb.rpc('admin_user_plays', { target: id, max_rows: 500 }); if (error) throw error; return data || []; },
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

async function loadProfile() {
  if (!user) { profile = null; return; }
  const { data } = await sb.from('profiles').select('username, nickname, is_admin, blocked, age').eq('id', user.id).maybeSingle();
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
