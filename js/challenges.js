/* ═══════════════════════════════════════════
   AUTODEX — weekly challenges

   Deterministic, not random: the week number picks the challenge, so the
   same week always shows the same thing and there's no state to store or
   sync. No timers, no expiry punishment — if you miss one it simply comes
   round again.
   ═══════════════════════════════════════════ */

import { RARITY_MAP } from './data.js';

/* ISO-ish week index since epoch. */
function weekIndex(d = new Date()) {
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / (7 * 86400000));
}

function daysLeftInWeek(d = new Date()) {
  const day = (d.getDay() + 6) % 7;      // Monday = 0
  return 7 - day;
}

/* Count entries logged within the current week. */
function thisWeek(entries) {
  const wk = weekIndex();
  return entries.filter(e =>
    (e.sightings || []).some(s => s.at && weekIndex(new Date(s.at)) === wk));
}

const tierAtLeast = (e, min) => {
  const r = RARITY_MAP[e.rarity];
  return r && r.tier >= min;
};

export const CHALLENGES = [
  { title: 'Five in seven',      desc: 'Log any 5 cars this week',                goal: 5,
    fn: (w) => w.length },
  { title: 'Rare hunter',        desc: 'Log 3 cars at Rare or above this week',   goal: 3,
    fn: (w) => w.filter(e => tierAtLeast(e, 3)).length },
  { title: 'Rainbow week',       desc: 'Log 5 different colours this week',       goal: 5,
    fn: (w) => new Set(w.map(e => e.colour).filter(Boolean)).size },
  { title: 'Badge variety',      desc: 'Log 6 different manufacturers this week', goal: 6,
    fn: (w) => new Set(w.map(e => e.make).filter(Boolean)).size },
  { title: 'Hot week',           desc: 'Log 3 hot hatches this week',             goal: 3,
    fn: (w) => w.filter(e => (e.types || []).includes('hothatch')).length },
  { title: 'Old metal',          desc: 'Log 3 cars built before 1995',            goal: 3,
    fn: (w) => w.filter(e => Number(e.year) && Number(e.year) < 1995).length },
  { title: 'Silent running',     desc: 'Log 4 electric or hybrid cars this week', goal: 4,
    fn: (w) => w.filter(e => (e.types || []).some(t => t === 'ev' || t === 'hybrid')).length },
  { title: 'Photographer',       desc: 'Take 12 photos this week',                goal: 12,
    fn: (w) => w.reduce((a, e) => a + (e.photos || []).length, 0) },
  { title: 'Serious spot',       desc: 'Log an Epic or better this week',         goal: 1,
    fn: (w) => w.filter(e => tierAtLeast(e, 4)).length },
  { title: 'Working week',       desc: 'Log 3 vans, pickups or commercials',      goal: 3,
    fn: (w) => w.filter(e => (e.types || []).some(t => ['van', 'pickup', 'commercial'].includes(t))).length },
  { title: 'New ground',         desc: 'Log 4 models you have never caught before', goal: 4,
    fn: (w, all) => {
      const before = new Set();
      for (const e of all) {
        const k = `${e.make}|${e.model}`.toLowerCase();
        if (!w.includes(e)) before.add(k);
      }
      return w.filter(e => !before.has(`${e.make}|${e.model}`.toLowerCase())).length;
    } },
  { title: 'Field work',         desc: 'Log spots in 4 different places',         goal: 4,
    fn: (w) => new Set(w.flatMap(e => (e.sightings || []).map(s => (s.place || '').trim().toLowerCase())).filter(Boolean)).size }
];

export function currentChallenge() {
  const c = CHALLENGES[weekIndex() % CHALLENGES.length];
  return {
    ...c,
    daysLeft: daysLeftInWeek(),
    progress: (entries) => {
      const w = thisWeek(entries);
      try { return c.fn(w, entries) || 0; } catch { return 0; }
    }
  };
}
