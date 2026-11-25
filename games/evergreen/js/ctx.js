// EVERGREEN — shared engine context and small UI helpers
export const E = { S: null, buildings: [], visitors: [], litter: [], keys: {}, mode: 'title', panel: null };

export const ICON = {
  c: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#e8b13c"/><circle cx="12" cy="12" r="7" fill="#f6cf62"/><path d="M12 7v10M9.5 9.5h4a1.6 1.6 0 010 3.2h-3a1.6 1.6 0 000 3.2h4" stroke="#b57a1a" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>',
  w: '<svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="9" rx="4.5" fill="#a66c3e"/><circle cx="18" cy="12.5" r="4.5" fill="#e3b77e"/><circle cx="18" cy="12.5" r="2.4" fill="none" stroke="#a66c3e" stroke-width="1.2"/></svg>',
  s: '<svg viewBox="0 0 24 24"><path d="M4 17l3-8 6-3 6 4 1 7z" fill="#9b968c"/><path d="M7 9l6-3 6 4-5 2z" fill="#c2bdb2"/></svg>',
  f: '<svg viewBox="0 0 24 24"><path d="M12 13v9" stroke="#4f8a35" stroke-width="2"/><g fill="#f29bb5"><circle cx="12" cy="6" r="3.3"/><circle cx="7.5" cy="10" r="3.3"/><circle cx="16.5" cy="10" r="3.3"/><circle cx="9.3" cy="14" r="3"/><circle cx="14.7" cy="14" r="3"/></g><circle cx="12" cy="10.5" r="2.6" fill="#f6cf62"/></svg>',
  r: '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill="#e8b13c"/></svg>',
  v: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5" fill="#3f6a48"/><path d="M2.5 20c.5-4 3-6 6.5-6s6 2 6.5 6z" fill="#3f6a48"/><circle cx="17" cy="9" r="2.8" fill="#e08a3c"/><path d="M13.5 20c.4-3.4 1.8-5 3.5-5s3.6 1.6 4 5z" fill="#e08a3c"/></svg>',
  fish: '<svg viewBox="0 0 24 24"><path d="M3 12c3-5 10-6 14-2l4-3v10l-4-3c-4 4-11 3-14-2z" fill="#5b8fd6"/><circle cx="8" cy="11" r="1.2" fill="#fff"/></svg>',
};
export const COST_KEYS = [['c', 'coins'], ['w', 'wood'], ['s', 'stone'], ['f', 'flowers']];
export function costHTML(cost, have) {
  return '<div class="cost">' + COST_KEYS.filter(([k]) => cost[k]).map(([k, n]) => `<span class="${have && have[n] < cost[k] ? 'no' : ''}">${ICON[k]}${cost[k]}</span>`).join('') + (Object.keys(cost).length ? '' : '<span>Free</span>') + '</div>';
}
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
export const WEATHERS = { sunny: 'Sunny', cloudy: 'Cloudy', rainy: 'Rainy', snowy: 'Snowy', foggy: 'Foggy' };
export const LEVELS = [
  { name: 'Tiny Retreat', rep: 0, unlock: 'Starter buildings and decorations' },
  { name: 'Cozy Hamlet', rep: 100, unlock: 'Business & nature buildings, Guest Lodge, Visitor Center · Lakeside and Meadow can be unlocked' },
  { name: 'Forest Village', rep: 350, unlock: 'Tea House, Grocery, Luxury Cabin, Hot Spring, Tower, Botanical Garden, Hall & Stage · Highlands can be unlocked' },
  { name: 'Popular Resort', rep: 900, unlock: 'Lakeside Resort, wealthy guests · the Old Woodland can be unlocked' },
  { name: 'Evergreen Paradise', rep: 2000, unlock: 'Twice as many wealthy guests, festival crowds and the Paradise title' },
];
export function levelOf(rep) { let l = 1; for (let i = 0; i < LEVELS.length; i++) if (rep >= LEVELS[i].rep) l = i + 1; return l; }
