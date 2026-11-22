// PlayCraft accounts: sign in with an admin-issued ID + password, and keep play records per person.
// The publishable key below is meant to be public; every table is locked so each player only sees their own rows.
(() => {
'use strict';
const SUPABASE_URL = 'https://mglfvwxlleevbvglijzl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0jKAyNY2GzWyIU63M_eD3g_PkVubQ6X';
const ID_DOMAIN = 'id.playcraft.kr'; // login IDs become ID@id.playcraft.kr behind the scenes (no real email needed)

const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, storageKey: 'pc.auth' } }) : null;
let user = null, profile = null;
const listeners = new Set();
const emit = () => listeners.forEach(fn => { try { fn(); } catch {} });

const Account = {
  ready: false,
  get user() { return user; },
  get profile() { return profile; },
  get signedIn() { return !!user; },
  onChange(fn) { listeners.add(fn); },

  async signIn(id, password) {
    if (!sb) throw new Error('offline');
    const clean = String(id || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{2,30}$/.test(clean)) throw new Error('bad-id');
    const { error } = await sb.auth.signInWithPassword({ email: `${clean}@${ID_DOMAIN}`, password });
    if (error) throw error;
  },
  async signOut() { if (sb) await sb.auth.signOut(); },

  // ---- saved games ----
  async savedList() {
    if (!user) return null;
    const { data } = await sb.from('saved_games').select('game_slug, created_at').order('created_at', { ascending: false });
    return (data || []).map(r => r.game_slug);
  },
  async setSaved(slug, on) {
    if (!user) return;
    if (on) await sb.from('saved_games').upsert({ game_slug: slug }, { onConflict: 'user_id,game_slug' });
    else await sb.from('saved_games').delete().eq('game_slug', slug);
  },

  // ---- play sessions ----
  async startPlay(slug) {
    if (!user) return null;
    const { data } = await sb.from('plays').insert({ game_slug: slug }).select('id').single();
    return data ? data.id : null;
  },
  async updatePlay(id, seconds) {
    if (!user || !id) return;
    await sb.from('plays').update({ seconds: Math.min(86400, Math.round(seconds)) }).eq('id', id);
  },
  async stats() {
    if (!user) return null;
    const { data } = await sb.from('plays').select('game_slug, started_at, seconds').order('started_at', { ascending: false }).limit(1000);
    const rows = data || [], per = {};
    for (const r of rows) {
      const p = per[r.game_slug] || (per[r.game_slug] = { slug: r.game_slug, plays: 0, seconds: 0, last: r.started_at });
      p.plays++; p.seconds += r.seconds || 0;
    }
    return { totalPlays: rows.length, totalSeconds: rows.reduce((s, r) => s + (r.seconds || 0), 0), games: Object.values(per) };
  },
};
window.Account = Account;

async function loadProfile() {
  if (!user) { profile = null; return; }
  const { data } = await sb.from('profiles').select('username, nickname, is_admin').eq('id', user.id).maybeSingle();
  profile = data || { username: (user.email || '').split('@')[0], nickname: (user.email || '').split('@')[0], is_admin: false };
}
if (sb) {
  sb.auth.onAuthStateChange(async (_evt, session) => {
    user = session ? session.user : null;
    await loadProfile();
    Account.ready = true; emit();
  });
} else { Account.ready = true; }
})();
