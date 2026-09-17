/* ═══════════════════════════════════════════
   AUTODEX — reference data
   ═══════════════════════════════════════════ */

export const TYPES = [
  { id: 'hatch',    label: 'Hatchback',    colour: '#5bbd63' },
  { id: 'saloon',   label: 'Saloon',       colour: '#4a90d9' },
  { id: 'estate',   label: 'Estate',       colour: '#2fa8a0' },
  { id: 'suv',      label: 'SUV',          colour: '#a1743b' },
  { id: 'crossover',label: 'Crossover',    colour: '#c08a4a' },
  { id: 'coupe',    label: 'Coupé',        colour: '#8b5cf6' },
  { id: 'convert',  label: 'Convertible',  colour: '#38bdf8' },
  { id: 'sports',   label: 'Sports',       colour: '#ef4444' },
  { id: 'super',    label: 'Supercar',     colour: '#d10f4a' },
  { id: 'hyper',    label: 'Hypercar',     colour: '#e0457b' },
  { id: 'hothatch', label: 'Hot Hatch',    colour: '#f97316' },
  { id: 'luxury',   label: 'Luxury',       colour: '#caa24a' },
  { id: 'classic',  label: 'Classic',      colour: '#b98c5a' },
  { id: 'jdm',      label: 'JDM',          colour: '#ec4899' },
  { id: 'usdm',     label: 'American',     colour: '#3b6fd4' },
  { id: 'ev',       label: 'Electric',     colour: '#eab308' },
  { id: 'hybrid',   label: 'Hybrid',       colour: '#84cc16' },
  { id: 'diesel',   label: 'Diesel',       colour: '#64748b' },
  { id: 'offroad',  label: 'Off-road',     colour: '#6b7f3a' },
  { id: 'van',      label: 'Van',          colour: '#78716c' },
  { id: 'pickup',   label: 'Pickup',       colour: '#8a5a2b' },
  { id: 'mpv',      label: 'MPV',          colour: '#6366f1' },
  { id: 'city',     label: 'City Car',     colour: '#22c55e' },
  { id: 'modified', label: 'Modified',     colour: '#d946ef' },
  { id: 'track',    label: 'Track',        colour: '#94a3b8' },
  { id: 'rally',    label: 'Rally',        colour: '#0ea5e9' },
  { id: 'emergency',label: 'Emergency',    colour: '#1d6fe0' },
  { id: 'commercial',label:'Commercial',   colour: '#57534e' },
  { id: 'barnfind', label: 'Barn Find',    colour: '#a16207' },
  { id: 'concept',  label: 'Concept',      colour: '#14b8a6' }
];
export const TYPE_MAP = Object.fromEntries(TYPES.map(t => [t.id, t]));

/* ── The ten tiers ──────────────────────────
   XP climbs steeply at the top because those cars are genuinely
   once-in-a-lifetime, but the cap keeps one spot from dwarfing a year
   of ordinary spotting. */
export const RARITIES = [
  { id: 'common',    tier: 1,  label: 'Common',    colour: '#8a93a3', xp: 10,
    blurb: 'Everyday traffic', eg: 'Fiesta, Corsa, Qashqai' },
  { id: 'uncommon',  tier: 2,  label: 'Uncommon',  colour: '#4ade80', xp: 20,
    blurb: 'Regularly seen, but noticeably less common', eg: 'MX-5, GR86, Z4' },
  { id: 'rare',      tier: 3,  label: 'Rare',      colour: '#38bdf8', xp: 40,
    blurb: "Something you'd genuinely notice", eg: 'Cayman GT4, GT-R, Emira' },
  { id: 'epic',      tier: 4,  label: 'Epic',      colour: '#a855f7', xp: 75,
    blurb: 'A serious spot; phone comes out', eg: 'Roma, Huracán, 570S' },
  { id: 'legendary', tier: 5,  label: 'Legendary', colour: '#f5c542', xp: 130,
    blurb: 'Very unusual even among supercars', eg: '812 Competizione, SVJ, 765LT' },
  { id: 'mythic',    tier: 6,  label: 'Mythic',    colour: '#ff5ecd', xp: 220,
    blurb: 'Hypercar territory', eg: 'Chiron, Huayra, Jesko' },
  { id: 'exotic',    tier: 7,  label: 'Exotic',    colour: '#22d3ee', xp: 340,
    blurb: 'Tiny production numbers', eg: 'Veneno, Zonda Cinque, Speedtail' },
  { id: 'relic',     tier: 8,  label: 'Relic',     colour: '#d4a373', xp: 480,
    blurb: 'Historically significant and exceptionally scarce', eg: '250 GTO, 300 SLR, Atlantic' },
  { id: 'prototype', tier: 9,  label: 'Prototype', colour: '#a3e635', xp: 650,
    blurb: 'Concepts, prototypes and true one-offs', eg: 'Bolide prototype, test mules' },
  { id: 'absurd',    tier: 10, label: '???',       colour: '#ffffff', xp: 900,
    blurb: 'How did you even find that', eg: 'Unreleased one-offs' }
];
export const RARITY_MAP = Object.fromEntries(RARITIES.map(r => [r.id, r]));
export const RARITY_ORDER = RARITIES.map(r => r.id);

export const COLOURS = [
  { id: 'black',  label: 'Black',        hex: '#15181d' },
  { id: 'white',  label: 'White',        hex: '#f2f4f7' },
  { id: 'silver', label: 'Silver',       hex: '#c3c8d0' },
  { id: 'grey',   label: 'Grey',         hex: '#7b828d' },
  { id: 'blue',   label: 'Blue',         hex: '#2f6fd0' },
  { id: 'red',    label: 'Red',          hex: '#d32f34' },
  { id: 'green',  label: 'Green',        hex: '#2f8f52' },
  { id: 'yellow', label: 'Yellow',       hex: '#e8c33a' },
  { id: 'orange', label: 'Orange',       hex: '#e8802f' },
  { id: 'brown',  label: 'Brown',        hex: '#7a5230' },
  { id: 'beige',  label: 'Beige',        hex: '#cbbfa4' },
  { id: 'purple', label: 'Purple',       hex: '#7a45c2' },
  { id: 'pink',   label: 'Pink',         hex: '#e06a9e' },
  { id: 'gold',   label: 'Gold',         hex: '#c9a227' },
  { id: 'bronze', label: 'Bronze',       hex: '#a8722c' },
  { id: 'multi',  label: 'Multi / Wrap', hex: '#5eead4' }
];
export const COLOUR_MAP = Object.fromEntries(COLOURS.map(c => [c.id, c]));

/* Garage lists — the three collections on the Garage screen. */
export const GARAGE_LISTS = [
  { id: 'dream',    label: 'Dream Cars', icon: '✨', blurb: 'The ones you want in the driveway' },
  { id: 'fav',      label: 'Favourites', icon: '★',  blurb: 'Best things you have actually seen' },
  { id: 'tofind',   label: 'To Find',    icon: '🎯', blurb: 'Pin one and it shows on your home screen' }
];

export const RANKS = [
  { min: 0,      title: 'Kerb Crawler' },
  { min: 800,    title: 'Spotter' },
  { min: 2200,   title: 'Trainspotter of Tarmac' },
  { min: 4500,   title: 'Car Nerd' },
  { min: 8000,   title: 'Lay-by Legend' },
  { min: 14500,  title: 'Bonnet Botherer' },
  { min: 21000,  title: 'Concours Judge' },
  { min: 28000,  title: 'Marque Specialist' },
  { min: 38000,  title: 'Dex Master' },
  { min: 52000,  title: 'Grand Archivist' },
  { min: 72000,  title: 'Living Encyclopaedia' },
  { min: 100000, title: 'Tarmac Historian' },
  { min: 135000, title: 'The Completionist' },
  { min: 185000, title: 'Immortal of the Hard Shoulder' }
];

export function rankFor(xp) {
  let r = RANKS[0];
  for (const rank of RANKS) if (xp >= rank.min) r = rank;
  return r;
}

export const STATS = [
  { id: 'presence',  label: 'Presence',  hint: 'Road presence / menace' },
  { id: 'style',     label: 'Style',     hint: 'How good does it look' },
  { id: 'sound',     label: 'Sound',     hint: 'Exhaust note / silence' },
  { id: 'condition', label: 'Condition', hint: 'Showroom vs shed' }
];

export const CLASSIC_YEAR = 1995;

/* Catalogue lookup is injected by app.js so this module stays standalone. */
let _catLookup = null;
export function setCatalogueLookup(fn) { _catLookup = fn; }

export function guessMeta(make, model, year) {
  if (_catLookup) {
    const hit = _catLookup(make, model);
    if (hit) {
      const types = [hit.type];
      const y = Number(year);
      if (y && y < CLASSIC_YEAR && !types.includes('classic')) types.push('classic');
      return { types, rarity: hit.rarity, cat: hit };
    }
  }
  return { types: [], rarity: 'common', cat: null };
}
