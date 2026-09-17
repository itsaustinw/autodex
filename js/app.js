/* ═══════════════════════════════════════════
   AUTODEX — app logic (v2 shell)
   ═══════════════════════════════════════════ */

import {
  TYPES, TYPE_MAP, RARITIES, RARITY_MAP, RARITY_ORDER, COLOURS, COLOUR_MAP,
  STATS, GARAGE_LISTS, RANKS, rankFor, guessMeta, setCatalogueLookup
} from './data.js';
import * as DB from './store.js';
import {
  CATALOGUE, CATALOGUE_MAKES, CATALOGUE_COUNT, lookup as catLookup, norm
} from './catalogue.js';
import { CHALLENGES, currentChallenge } from './challenges.js';

setCatalogueLookup(catLookup);

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const S = {
  entries: [], urls: new Map(), screen: 'home',
  editing: null, draft: null, pending: [],
  dexFilter: { q: '', tier: null, type: null },
  browseFilter: { q: '', tier: null, show: null },
  garageList: 'dream',
  garage: { dream: [], tofind: [] },   // catalogue keys
  pinned: null,
  boardIdx: 0
};

init();

async function init() {
  try { await boot(); }
  catch (e) { console.error(e); toast('Failed to start — try reopening', 6000); }
}

async function boot() {
  await DB.open();
  DB.persist();
  S.garage.dream  = await DB.getMeta('garage-dream', []);
  S.garage.tofind = await DB.getMeta('garage-tofind', []);
  S.pinned        = await DB.getMeta('pinned', null);

  buildForm();
  S.entries = await DB.allEntries();
  await hydrate();
  renderHome();
  registerSW();
}

async function hydrate() {
  const ids = S.entries.map(e => e.photos && e.photos[0]).filter(Boolean);
  const rows = await DB.getPhotos(ids);
  for (const r of rows) {
    if (r && !S.urls.has(r.id)) S.urls.set(r.id, URL.createObjectURL(r.thumb || r.blob));
  }
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  let reloading = false;
  const once = () => { if (!reloading) { reloading = true; location.reload(); } };
  sw.addEventListener('controllerchange', once);
  sw.addEventListener('message', e => { if (e.data && e.data.type === 'RELOAD') once(); });
  sw.register('sw.js').then(reg => {
    const nudge = () => { if (reg.waiting) try { reg.waiting.postMessage({ type: 'SKIP_WAITING' }); } catch {} };
    nudge();
    reg.addEventListener('updatefound', () => {
      const w = reg.installing; if (!w) return;
      w.addEventListener('statechange', () => { if (w.state === 'installed') nudge(); });
    });
    const check = () => reg.update().catch(() => {});
    check();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
  }).catch(() => {});
}

/* ═══════ NAVIGATION ═══════ */

const SCREENS = { home: '#scHome', dex: '#scDex', garage: '#scGarage', browse: '#scBrowse' };

function go(name) {
  const el = $(SCREENS[name]); if (!el) return;
  $$('.screen').forEach(s => s.classList.remove('active', 'slide'));
  el.classList.add('active');
  if (name !== 'home') el.classList.add('slide');
  S.screen = name;
  if (name === 'home')   renderHome();
  if (name === 'dex')    renderDex();
  if (name === 'garage') renderGarage();
  if (name === 'browse') renderBrowse();
  el.querySelector('.scrollarea, .homescroll')?.scrollTo(0, 0);
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-go]');
  if (b) { go(b.dataset.go); haptic(6); }
});

/* ═══════ SCORING ═══════ */

function xpOf(e) {
  const r = RARITY_MAP[e.rarity] || RARITY_MAP.common;
  return r.xp * Math.max(1, (e.sightings || []).length);
}
function totalXP() { return S.entries.reduce((a, e) => a + xpOf(e), 0); }

function caughtKeys() {
  const set = new Set();
  for (const e of S.entries) {
    const hit = catLookup(e.make, e.model);
    if (hit) set.add(`${hit.make}|${hit.model}`);
  }
  return set;
}

/* ═══════ HOME ═══════ */

function renderHome() {
  renderBoard();
  const caught = caughtKeys();
  $('#doorDexSub').textContent = `${S.entries.length} caught`;
  const gn = S.garage.dream.length + S.garage.tofind.length + S.entries.filter(e => e.fav).length;
  $('#doorGarageSub').textContent = gn === 0 ? 'nothing yet' : `${gn} saved`;
  $('#doorBrowseSub').textContent = `${CATALOGUE_COUNT.toLocaleString()} cars`;

  const recent = S.entries.slice().sort((a, b) => b.no - a.no).slice(0, 8);
  $('#recentRow').innerHTML = recent.length
    ? recent.map(e => {
        const pid = e.photos && e.photos[0];
        const url = pid ? S.urls.get(pid) : null;
        return `<button class="rthumb" data-open="${e.id}">
          ${url ? `<img src="${url}" alt="" loading="lazy">`
                : `<div class="noshot" style="display:grid;place-items:center;height:100%;font-size:20px;opacity:.4">🚗</div>`}
          <span class="rno">#${String(e.no).padStart(3, '0')}</span>
        </button>`;
      }).join('')
    : `<div class="rempty">Nothing captured yet</div>`;

  const xp = totalXP();
  const rank = rankFor(xp);
  const next = RANKS.find(r => r.min > xp);
  const pct = next ? Math.round(((xp - rank.min) / (next.min - rank.min)) * 100) : 100;
  $('#progCard').innerHTML = `
    <div class="progtop">
      <span class="progrank">${esc(rank.title)}</span>
      <span class="progxp">${xp.toLocaleString()} XP</span>
    </div>
    <div class="progbar"><i style="width:${pct}%"></i></div>
    <div class="prognext">${next ? `${(next.min - xp).toLocaleString()} XP to ${esc(next.title)}`
                                 : 'Top rank reached'}</div>
    <div class="progstats">
      <div class="pstat"><div class="n">${S.entries.length}</div><div class="l">CAUGHT</div></div>
      <div class="pstat"><div class="n">${caught.size}</div><div class="l">OF ${CATALOGUE_COUNT.toLocaleString()}</div></div>
      <div class="pstat"><div class="n">${new Set(S.entries.map(e => e.make).filter(Boolean)).size}</div><div class="l">MAKES</div></div>
    </div>`;
}

$('#recentRow').addEventListener('click', e => {
  const b = e.target.closest('[data-open]'); if (b) openView(b.dataset.open);
});

/* ── the shuffle board ── */
function renderBoard() {
  const cards = [];
  const caught = caughtKeys();

  // 1. weekly challenge
  const ch = currentChallenge();
  const prog = ch.progress(S.entries, caught);
  cards.push(`
    <div class="bcard chal">
      <div class="bkick">Weekly challenge</div>
      <div class="btitle">${esc(ch.title)}</div>
      <div class="bsub">${esc(ch.desc)}</div>
      <div class="bbar"><i style="width:${Math.min(100, prog / ch.goal * 100)}%"></i></div>
      <div class="bmeta">${prog} / ${ch.goal}${prog >= ch.goal ? '  ·  DONE' : `  ·  ${ch.daysLeft} days left`}</div>
    </div>`);

  // 2. pinned to-find
  if (S.pinned) {
    const [mk, md] = S.pinned.split('|');
    const row = (CATALOGUE[mk] || []).find(r => r[0] === md);
    const done = caught.has(S.pinned);
    const r = row ? RARITY_MAP[row[4]] : null;
    cards.push(`
      <div class="bcard pin">
        <div class="bkick">Pinned to find</div>
        <div class="btitle">${esc(fullName(mk, md))}</div>
        <div class="bsub">${r ? `${esc(r.label)} · ${esc(r.blurb)}` : ''}</div>
        <div class="bmeta" style="color:${done ? 'var(--ok)' : 'var(--dim2)'}">
          ${done ? '✓ FOUND IT' : 'STILL HUNTING'}</div>
      </div>`);
  } else {
    cards.push(`
      <div class="bcard pin">
        <div class="bkick">Pinned to find</div>
        <div class="btitle">Nothing pinned</div>
        <div class="bsub">Open Browse, pick a car and pin it. It'll live here until you find it.</div>
      </div>`);
  }

  // 3. closest catalogue milestone
  const marks = [10, 50, 150, 400, 800, 1500, CATALOGUE_COUNT];
  const target = marks.find(m => caught.size < m) || CATALOGUE_COUNT;
  cards.push(`
    <div class="bcard ach">
      <div class="bkick">Next milestone</div>
      <div class="btitle">${target.toLocaleString()} models found</div>
      <div class="bsub">Every different catalogued car you photograph counts once.</div>
      <div class="bbar"><i style="width:${Math.min(100, caught.size / target * 100)}%"></i></div>
      <div class="bmeta">${caught.size} / ${target.toLocaleString()}</div>
    </div>`);

  $('#boardTrack').innerHTML = cards.join('');
  $('#boardDots').innerHTML = cards.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('');
}

$('#boardTrack').addEventListener('scroll', () => {
  const t = $('#boardTrack');
  const i = Math.round(t.scrollLeft / t.clientWidth);
  $$('#boardDots i').forEach((d, j) => d.classList.toggle('on', j === i));
}, { passive: true });

/* ═══════ MY DEX ═══════ */

function dexVisible() {
  const q = S.dexFilter.q.trim().toLowerCase();
  return S.entries.filter(e => {
    if (S.dexFilter.tier && e.rarity !== S.dexFilter.tier) return false;
    if (S.dexFilter.type && !(e.types || []).includes(S.dexFilter.type)) return false;
    if (q) {
      const hay = `${e.make} ${e.model} ${e.year || ''} ${e.plate || ''} ${e.notes || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => b.no - a.no);
}

function renderDex() {
  const rows = dexVisible();
  $('#dexCount').textContent = `${S.entries.length}`;
  $('#dexEmpty').hidden = rows.length > 0;
  $('#dexGrid').innerHTML = rows.map((e, i) => cardHTML(e, i)).join('');

  const tiers = {};
  for (const e of S.entries) tiers[e.rarity] = (tiers[e.rarity] || 0) + 1;
  $('#dexChips').innerHTML = RARITY_ORDER.filter(t => tiers[t]).map(t => {
    const r = RARITY_MAP[t], on = S.dexFilter.tier === t;
    return `<button class="chip" data-tier="${t}"
      style="${on ? `background:${r.colour};border-color:${r.colour};color:#0d1015`
                  : `color:${r.colour}`}">${esc(r.label)} <span class="n">${tiers[t]}</span></button>`;
  }).join('');
}

function cardHTML(e, i) {
  const r = RARITY_MAP[e.rarity] || RARITY_MAP.common;
  const pid = e.photos && e.photos[0];
  const url = pid ? S.urls.get(pid) : null;
  const n = (e.sightings || []).length;
  return `
  <article class="card" data-open="${e.id}" style="animation-delay:${Math.min(i * 20, 300)}ms">
    ${url ? `<img class="shot" src="${url}" alt="" loading="lazy" decoding="async">`
          : `<div class="noshot">🚗</div>`}
    <span class="tier" style="color:${r.colour}">${esc(r.label)}</span>
    ${n > 1 ? `<span class="cnt">×${n}</span>` : ''}
    <div class="meta">
      <div class="no">#${String(e.no).padStart(3, '0')}</div>
      <div class="nm">${esc(e.model || e.make || 'Unknown')}</div>
      <div class="mk">${esc(subMake(e))}${e.year ? (subMake(e) ? ' · ' : '') + e.year : ''}</div>
      <div class="tags">${(e.types || []).slice(0, 2).map(t => {
        const ty = TYPE_MAP[t]; if (!ty) return '';
        return `<span class="tag" style="color:${readable(ty.colour)};background:${hexA(ty.colour, .17)}">${esc(ty.label)}</span>`;
      }).join('')}</div>
    </div>
  </article>`;
}

$('#dexGrid').addEventListener('click', e => {
  const c = e.target.closest('[data-open]'); if (c) openView(c.dataset.open);
});
$('#dexChips').addEventListener('click', e => {
  const c = e.target.closest('[data-tier]'); if (!c) return;
  S.dexFilter.tier = S.dexFilter.tier === c.dataset.tier ? null : c.dataset.tier;
  renderDex(); haptic(6);
});
$('#dexSearch').addEventListener('input', e => { S.dexFilter.q = e.target.value; renderDex(); });

/* ═══════ GARAGE ═══════ */

function renderGarage() {
  const favN = S.entries.filter(e => e.fav).length;
  const counts = { dream: S.garage.dream.length, fav: favN, tofind: S.garage.tofind.length };
  $('#garageCount').textContent = `${counts.dream + counts.fav + counts.tofind}`;
  $('#garageSeg').innerHTML = GARAGE_LISTS.map(l =>
    `<button class="segbtn ${S.garageList === l.id ? 'on' : ''}" data-list="${l.id}">
       ${l.icon} ${esc(l.label)} <span class="sn">${counts[l.id]}</span></button>`).join('');

  const list = GARAGE_LISTS.find(l => l.id === S.garageList);
  $('#garageBlurb').textContent = list.blurb;

  let html = '';
  if (S.garageList === 'fav') {
    const favs = S.entries.filter(e => e.fav).sort((a, b) => b.no - a.no);
    html = favs.map((e, i) => cardHTML(e, i)).join('');
    setEmpty(favs.length, '★', 'No favourites yet', 'Open a catch and tap Favourite.');
  } else {
    const keys = S.garage[S.garageList];
    const caught = caughtKeys();
    html = keys.map((k, i) => {
      const [mk, md] = k.split('|');
      const row = (CATALOGUE[mk] || []).find(r => r[0] === md);
      if (!row) return '';
      const r = RARITY_MAP[row[4]] || RARITY_MAP.common;
      const got = caught.has(k);
      const isPin = S.pinned === k;
      return `
      <article class="card" data-cat="${esc(k)}" style="animation-delay:${Math.min(i * 20, 300)}ms">
        <div class="noshot">${got ? '✅' : '🚗'}</div>
        <span class="tier" style="color:${r.colour}">${esc(r.label)}</span>
        ${isPin ? `<span class="cnt">📌</span>` : ''}
        <div class="meta">
          <div class="no">${row[1]}–${row[2]}</div>
          <div class="nm">${esc(md)}</div>
          <div class="mk">${esc(mk)}</div>
        </div>
      </article>`;
    }).join('');
    setEmpty(keys.length, list.icon, `No ${list.label.toLowerCase()} yet`,
      S.garageList === 'dream'
        ? 'Find a car in Browse and add it to your dream list.'
        : 'Pick something in Browse to hunt down. Pin one and it shows on your home screen.');
  }
  $('#garageGrid').innerHTML = html;
}

function setEmpty(n, icon, title, text) {
  $('#garageEmpty').hidden = n > 0;
  $('#garageEmptyIcon').textContent = icon;
  $('#garageEmptyTitle').textContent = title;
  $('#garageEmptyText').textContent = text;
}

$('#garageSeg').addEventListener('click', e => {
  const b = e.target.closest('[data-list]'); if (!b) return;
  S.garageList = b.dataset.list; renderGarage(); haptic(6);
});
$('#garageGrid').addEventListener('click', e => {
  const c = e.target.closest('[data-cat]');
  if (c) { openCat(c.dataset.cat); return; }
  const o = e.target.closest('[data-open]');
  if (o) openView(o.dataset.open);
});

/* ═══════ BROWSE ═══════ */

let browseRows = null;
function allCatRows() {
  if (browseRows) return browseRows;
  browseRows = [];
  for (const mk of CATALOGUE_MAKES)
    for (const r of CATALOGUE[mk])
      browseRows.push({ key: `${mk}|${r[0]}`, make: mk, model: r[0], y0: r[1], y1: r[2], type: r[3], rarity: r[4] });
  browseRows.sort((a, b) => a.make.localeCompare(b.make) || a.model.localeCompare(b.model));
  return browseRows;
}

function renderBrowse() {
  const caught = caughtKeys();
  const q = norm(S.browseFilter.q);
  let rows = allCatRows();
  if (S.browseFilter.tier) rows = rows.filter(r => r.rarity === S.browseFilter.tier);
  if (S.browseFilter.show === 'caught')  rows = rows.filter(r => caught.has(r.key));
  if (S.browseFilter.show === 'missing') rows = rows.filter(r => !caught.has(r.key));
  if (q) rows = rows.filter(r => norm(`${r.make} ${r.model}`).includes(q));
  // show what you've actually found first — otherwise your progress is
  // buried alphabetically past the render cap and Browse looks empty.
  if (!q && !S.browseFilter.show) {
    rows = rows.slice().sort((a, b) => (caught.has(b.key) ? 1 : 0) - (caught.has(a.key) ? 1 : 0));
  }

  $('#browseCount').textContent = `${caught.size}/${CATALOGUE_COUNT}`;
  const SHOW = [['', 'All'], ['caught', 'Caught'], ['missing', 'Missing']];
  $('#browseChips').innerHTML = SHOW.map(([v, l]) => {
    const on = (S.browseFilter.show || '') === v;
    return `<button class="chip" data-bshow="${v}"
      style="${on ? 'background:var(--txt);border-color:var(--txt);color:#0d1015' : ''}">${l}</button>`;
  }).join('') + RARITY_ORDER.map(t => {
    const r = RARITY_MAP[t], on = S.browseFilter.tier === t;
    return `<button class="chip" data-btier="${t}"
      style="${on ? `background:${r.colour};border-color:${r.colour};color:#0d1015`
                  : `color:${r.colour}`}">${esc(r.label)}</button>`;
  }).join('');

  const CAP = 150;
  $('#browseList').innerHTML = rows.slice(0, CAP).map(r => {
    const ra = RARITY_MAP[r.rarity] || RARITY_MAP.common;
    const got = caught.has(r.key);
    return `
    <div class="brow ${got ? 'caught' : ''}" data-cat="${esc(r.key)}">
      <span class="bdot" style="background:${ra.colour}"></span>
      <div class="binfo">
        <div class="bname">${esc(r.model)}</div>
        <div class="bmk">${esc(r.make)} · ${r.y0}–${r.y1}</div>
      </div>
      ${got ? '<span class="bcheck">✓</span>' : ''}
      <span class="btier" style="color:${ra.colour};background:${hexA(ra.colour, .15)}">${esc(ra.label)}</span>
    </div>`;
  }).join('') + (rows.length > CAP
    ? `<p class="browsemore">+${(rows.length - CAP).toLocaleString()} more — narrow it down with search or a tier</p>`
    : (rows.length ? '' : `<p class="browsemore">Nothing matches.</p>`));
}

$('#browseSearch').addEventListener('input', e => { S.browseFilter.q = e.target.value; renderBrowse(); });
$('#browseChips').addEventListener('click', e => {
  const sh = e.target.closest('[data-bshow]');
  if (sh) {
    S.browseFilter.show = sh.dataset.bshow || null;
    renderBrowse(); $('#browseScroll').scrollTo(0, 0); haptic(6); return;
  }
  const c = e.target.closest('[data-btier]'); if (!c) return;
  S.browseFilter.tier = S.browseFilter.tier === c.dataset.btier ? null : c.dataset.btier;
  renderBrowse(); $('#browseScroll').scrollTo(0, 0); haptic(6);
});
$('#browseList').addEventListener('click', e => {
  const c = e.target.closest('[data-cat]'); if (c) openCat(c.dataset.cat);
});

/* ═══════ CATALOGUE DETAIL ═══════ */

let catKey = null;
function openCat(key) {
  catKey = key;
  const [mk, md] = key.split('|');
  const row = (CATALOGUE[mk] || []).find(r => r[0] === md);
  if (!row) return;
  const r = RARITY_MAP[row[4]] || RARITY_MAP.common;
  const ty = TYPE_MAP[row[3]];
  const caught = caughtKeys().has(key);
  const inDream = S.garage.dream.includes(key);
  const inFind  = S.garage.tofind.includes(key);
  const pinned  = S.pinned === key;

  $('#catBody').innerHTML = `
    <div class="vtitle">
      <div class="vno">TIER ${r.tier} · ${esc(r.label.toUpperCase())}</div>
      <h2>${esc(md)}</h2>
      <div class="vsub">${esc(mk)} · ${row[1]}–${row[2]}</div>
      <div class="vbadges">
        <span class="vbadge" style="color:#0d1015;background:${r.colour}">${esc(r.label)}</span>
        ${ty ? `<span class="vbadge" style="color:${readable(ty.colour)};background:${hexA(ty.colour, .18)}">${esc(ty.label)}</span>` : ''}
        ${caught ? `<span class="vbadge" style="color:#0d1015;background:var(--ok)">✓ Caught</span>` : ''}
      </div>
    </div>
    <div class="vgrid">
      <div class="vcell"><div class="k">Tier</div><div class="v" style="color:${r.colour}">${r.tier} · ${esc(r.label)}</div></div>
      <div class="vcell"><div class="k">Worth</div><div class="v" style="color:var(--gold)">${r.xp} XP</div></div>
      <div class="vcell wide"><div class="k">What that means</div><div class="v" style="font-size:13px;font-weight:600">${esc(r.blurb)}</div></div>
    </div>
    <div class="vsection">
      <button class="btn ${inDream ? 'ghost' : ''} block" id="catDream">
        ${inDream ? '✓ In Dream Cars' : '✨ Add to Dream Cars'}</button>
      <button class="btn ${inFind ? 'ghost' : ''} block" id="catFind">
        ${inFind ? '✓ On the To Find list' : '🎯 Add to To Find'}</button>
      <button class="btn ${pinned ? '' : 'ghost'} block" id="catPin">
        ${pinned ? '📌 Pinned to home screen' : '📌 Pin to home screen'}</button>
    </div>
    <div class="sheetpad"></div>`;

  $('#catDream').onclick = () => toggleList('dream', key);
  $('#catFind').onclick  = () => toggleList('tofind', key);
  $('#catPin').onclick   = async () => {
    S.pinned = (S.pinned === key) ? null : key;
    await DB.setMeta('pinned', S.pinned);
    toast(S.pinned ? 'Pinned to home screen' : 'Unpinned');
    haptic(8); openCat(key);
  };
  openSheet('#catSheet');
}

async function toggleList(list, key) {
  const arr = S.garage[list];
  const i = arr.indexOf(key);
  if (i >= 0) arr.splice(i, 1); else arr.push(key);
  await DB.setMeta(`garage-${list}`, arr);
  haptic(8);
  toast(i >= 0 ? 'Removed' : 'Added to garage');
  openCat(key);
}

$('#catClose').addEventListener('click', () => { closeSheet('#catSheet'); if (S.screen === 'garage') renderGarage(); });

/* ═══════ FORM ═══════ */

function buildForm() {
  const makes = [...new Set(CATALOGUE_MAKES)].sort((a, b) => a.localeCompare(b));
  $('#dlMakes').innerHTML = makes.map(m => `<option value="${esc(m)}">`).join('');

  $('#swatches').innerHTML = COLOURS.map(c =>
    `<button type="button" class="sw" data-colour="${c.id}" style="background:${c.hex}" aria-label="${esc(c.label)}"></button>`).join('');
  $('#typegrid').innerHTML = TYPES.map(t =>
    `<button type="button" class="tbtn" data-type="${t.id}" data-c="${t.colour}">${esc(t.label)}</button>`).join('');
  $('#tiergrid').innerHTML = RARITIES.map(r =>
    `<button type="button" class="tbtn2" data-r="${r.id}" data-c="${r.colour}" style="color:${r.colour}">
       <span class="pip"></span><span class="tn">${r.tier}</span> ${esc(r.label)}</button>`).join('');
  $('#statlist').innerHTML = STATS.map(s => `
    <div class="statrow">
      <span class="sn">${esc(s.label)}</span>
      <input type="range" min="0" max="10" step="1" data-stat="${s.id}" value="5">
      <span class="sv" data-sv="${s.id}">5</span>
    </div>`).join('');

  $('#swatches').addEventListener('click', e => {
    const b = e.target.closest('.sw'); if (!b) return;
    S.draft.colour = S.draft.colour === b.dataset.colour ? null : b.dataset.colour;
    syncColour(); haptic(6);
  });
  $('#typegrid').addEventListener('click', e => {
    const b = e.target.closest('.tbtn'); if (!b) return;
    const v = b.dataset.type, i = S.draft.types.indexOf(v);
    if (i >= 0) S.draft.types.splice(i, 1);
    else { if (S.draft.types.length >= 3) { toast('Three types max'); return; } S.draft.types.push(v); }
    S.draft._touched = true; syncTypes(); haptic(6);
  });
  $('#tiergrid').addEventListener('click', e => {
    const b = e.target.closest('.tbtn2'); if (!b) return;
    S.draft.rarity = b.dataset.r; S.draft._touched = true; syncTier(); haptic(6);
  });
  $('#statlist').addEventListener('input', e => {
    const i = e.target.closest('input[type=range]'); if (!i) return;
    S.draft.stats[i.dataset.stat] = Number(i.value);
    $(`[data-sv="${i.dataset.stat}"]`).textContent = i.value;
  });

  $('#fMake').addEventListener('input', e => { S.draft.make = e.target.value; refreshModels(e.target.value); autoFill(); });
  $('#fModel').addEventListener('input', e => { S.draft.model = e.target.value; autoFill(); });
  $('#fYear').addEventListener('input', e => { S.draft.year = e.target.value; });
  $('#fPlate').addEventListener('input', e => { S.draft.plate = e.target.value.toUpperCase(); e.target.value = S.draft.plate; });
  $('#fNotes').addEventListener('input', e => { S.draft.notes = e.target.value; });
}

function refreshModels(make) {
  const list = (CATALOGUE[make] || []).map(r => r[0]);
  $('#dlModels').innerHTML = list.map(m => `<option value="${esc(m)}">`).join('');
}
function syncColour() {
  $$('#swatches .sw').forEach(b => b.classList.toggle('on', b.dataset.colour === S.draft.colour));
}
function syncTypes() {
  $$('#typegrid .tbtn').forEach(b => {
    const on = S.draft.types.includes(b.dataset.type);
    b.classList.toggle('on', on);
    b.style.background = on ? b.dataset.c : '';
    b.style.borderColor = on ? b.dataset.c : '';
    b.style.color = on ? (isLight(b.dataset.c) ? '#0d1015' : '#fff') : '';
  });
}
function syncTier() {
  $$('#tiergrid .tbtn2').forEach(b => {
    const on = b.dataset.r === S.draft.rarity;
    b.classList.toggle('on', on);
    b.style.background = on ? b.dataset.c : '';
    b.style.borderColor = on ? b.dataset.c : '';
    b.style.color = on ? (isLight(b.dataset.c) ? '#0d1015' : '#fff') : b.dataset.c;
  });
  const r = RARITY_MAP[S.draft.rarity];
  $('#tierHint').textContent = r ? `Tier ${r.tier} · ${r.blurb} · +${r.xp} XP` : '';
}
function syncStats() {
  STATS.forEach(s => {
    const v = S.draft.stats[s.id] ?? 5;
    const i = $(`input[data-stat="${s.id}"]`); if (i) i.value = v;
    const o = $(`[data-sv="${s.id}"]`); if (o) o.textContent = v;
  });
}

let lastGuess = '';
function autoFill() {
  const key = `${S.draft.make}|${S.draft.model}`;
  if (key === lastGuess) return;
  lastGuess = key;
  const g = guessMeta(S.draft.make, S.draft.model, S.draft.year);
  const note = $('#matchNote');
  if (g.cat) {
    const r = RARITY_MAP[g.cat.rarity];
    note.hidden = false;
    note.innerHTML = `Matched <strong>${esc(g.cat.make)} ${esc(g.cat.model)}</strong>
      (${g.cat.y0}–${g.cat.y1}) · Tier ${r.tier} ${esc(r.label)}`;
    if (!S.draft.year && !S.editing) {
      const mid = Math.round((g.cat.y0 + g.cat.y1) / 2);
      $('#fYear').value = mid; S.draft.year = String(mid);
    }
  } else note.hidden = true;

  if (S.editing || S.draft._touched) return;
  if (g.types.length) { S.draft.types = g.types.slice(0, 3); syncTypes(); }
  if (g.cat) { S.draft.rarity = g.cat.rarity; syncTier(); }
}

function blankDraft() {
  return {
    id: uid(), no: null, make: '', model: '', year: '', plate: '',
    colour: null, types: [], rarity: 'common',
    stats: { presence: 5, style: 5, sound: 5, condition: 5 },
    notes: '', fav: false, photos: [], sightings: [], created: Date.now()
  };
}

async function openEdit(entry) {
  S.editing = entry || null;
  S.draft = entry ? JSON.parse(JSON.stringify(entry)) : blankDraft();
  S.pending = [];
  lastGuess = '';
  $('#editTitle').textContent = entry ? `Edit #${String(entry.no).padStart(3, '0')}` : 'New spot';
  $('#btnDelete').hidden = !entry;
  $('#fMake').value = S.draft.make;
  $('#fModel').value = S.draft.model;
  $('#fYear').value = S.draft.year || '';
  $('#fPlate').value = S.draft.plate || '';
  $('#fNotes').value = S.draft.notes || '';
  $('#fPlace').value = '';
  $('#fPlace').closest('.field').hidden = !!entry;
  $('#matchNote').hidden = true;
  refreshModels(S.draft.make);
  syncColour(); syncTypes(); syncTier(); syncStats();

  if (entry && entry.photos && entry.photos.length) {
    const rows = await DB.getPhotos(entry.photos);
    S.pending = rows.filter(Boolean).map(r => ({
      id: r.id, existing: true,
      url: S.urls.get(r.id) || URL.createObjectURL(r.thumb || r.blob)
    }));
    S.pending.forEach(p => { if (!S.urls.has(p.id)) S.urls.set(p.id, p.url); });
  }
  renderStrip();
  openSheet('#editSheet');
}

function renderStrip() {
  $('#photostrip').innerHTML = S.pending.map((p, i) =>
    `<div class="pthumb"><img src="${p.url}" alt=""><button class="x" data-del="${i}">×</button></div>`).join('');
}
$('#photostrip').addEventListener('click', e => {
  const d = e.target.closest('[data-del]'); if (!d) return;
  S.pending.splice(Number(d.dataset.del), 1); renderStrip(); haptic(8);
});

$('#btnCapture').addEventListener('click', async () => {
  haptic(12); await openEdit(null); setTimeout(() => $('#fileCam').click(), 260);
});
$('#btnImport').addEventListener('click', async () => {
  haptic(12); await openEdit(null); setTimeout(() => $('#fileLib').click(), 260);
});
$('#addCam').addEventListener('click', () => $('#fileCam').click());
$('#addLib').addEventListener('click', () => $('#fileLib').click());
$('#fileCam').addEventListener('change', e => handleFiles(e.target.files, e.target));
$('#fileLib').addEventListener('change', e => handleFiles(e.target.files, e.target));

async function handleFiles(files, input) {
  const list = [...files].filter(f => f.type.startsWith('image/'));
  if (!list.length) { input.value = ''; return; }
  toast(list.length > 1 ? `Processing ${list.length} photos…` : 'Processing photo…');
  for (const f of list) {
    if (S.pending.length >= 8) { toast('8 photos max'); break; }
    try {
      const { full, thumb } = await DB.processImage(f, 'normal');
      const id = uid(), url = URL.createObjectURL(thumb);
      S.pending.push({ id, blob: full, thumb, url, existing: false });
      S.urls.set(id, url);
    } catch { toast('Could not read that image'); }
  }
  renderStrip(); hideToast(); input.value = '';
}

$('#editCancel').addEventListener('click', () => {
  const dirty = S.pending.some(p => !p.existing) || $('#fMake').value || $('#fModel').value;
  if (!S.editing && dirty && !confirm('Discard this spot?')) return;
  closeSheet('#editSheet');
});

$('#editSave').addEventListener('click', save);

async function save() {
  const make = $('#fMake').value.trim(), model = $('#fModel').value.trim();
  if (!make && !model) { toast('Give it at least a make or model'); $('#fMake').focus(); return; }
  const d = S.draft;
  d.make = make; d.model = model;
  d.year = $('#fYear').value.trim();
  d.plate = $('#fPlate').value.trim().toUpperCase();
  d.notes = $('#fNotes').value.trim();
  if (!d.types.length) {
    const hit = catLookup(make, model);
    if (hit) d.types = [hit.type];
  }

  for (const p of S.pending) if (!p.existing) await DB.putPhoto(p.id, p.blob, p.thumb);
  const kept = S.pending.map(p => p.id);
  if (S.editing) {
    for (const old of (S.editing.photos || []))
      if (!kept.includes(old)) { await DB.deletePhoto(old); S.urls.delete(old); }
  }
  d.photos = kept;

  let isNew = false;
  if (S.editing) d.updated = Date.now();
  else {
    isNew = true;
    d.no = await DB.nextNo();
    d.sightings = [{ at: Date.now(), place: $('#fPlace').value.trim() }];
  }
  delete d._touched;

  await DB.putEntry(d);
  S.entries = await DB.allEntries();
  await hydrate();
  closeSheet('#editSheet');
  refreshCurrent();
  if (isNew) { haptic([14, 60, 22]); showUnlock(d); }
  else { toast('Saved'); if (S.sheetStack?.includes('#viewSheet')) openView(d.id); }
}

$('#btnDelete').addEventListener('click', async () => {
  if (!S.editing) return;
  if (!confirm(`Delete #${String(S.editing.no).padStart(3, '0')}? This cannot be undone.`)) return;
  await DB.deleteEntry(S.editing.id);
  S.entries = await DB.allEntries();
  closeSheet('#editSheet'); closeSheet('#viewSheet');
  refreshCurrent(); toast('Deleted');
});

function refreshCurrent() {
  if (S.screen === 'home') renderHome();
  if (S.screen === 'dex') renderDex();
  if (S.screen === 'garage') renderGarage();
  if (S.screen === 'browse') renderBrowse();
}

/* ═══════ UNLOCK ═══════ */

function showUnlock(e) {
  const r = RARITY_MAP[e.rarity] || RARITY_MAP.common;
  const pid = e.photos && e.photos[0];
  const url = pid ? S.urls.get(pid) : null;
  $('#uKick').textContent = r.tier >= 6 ? 'INCREDIBLE FIND' : 'NEW CATCH';
  $('#uShot').innerHTML = url ? `<img src="${url}" alt="">` : `<div class="noshot">🚗</div>`;
  $('#uNo').textContent = `#${String(e.no).padStart(3, '0')}`;
  $('#uName').textContent = fullName(e.make, e.model);
  $('#uTier').textContent = `TIER ${r.tier} · ${r.label}`;
  $('#uTier').style.color = r.colour;
  $('#uXp').textContent = `+${r.xp} XP`;
  const u = $('#unlock');
  u.hidden = false; u.classList.remove('out');
  const dismiss = () => {
    u.classList.add('out');
    setTimeout(() => { u.hidden = true; u.classList.remove('out'); }, 300);
    u.removeEventListener('click', dismiss); clearTimeout(t);
  };
  u.addEventListener('click', dismiss);
  const t = setTimeout(() => { if (!u.hidden) dismiss(); }, 3200);
}

/* ═══════ DETAIL ═══════ */

let viewId = null;
async function openView(id) {
  const e = S.entries.find(x => x.id === id); if (!e) return;
  viewId = id;
  $('#viewNo').textContent = `#${String(e.no).padStart(3, '0')}`;
  const rows = await DB.getPhotos(e.photos || []);
  const urls = rows.filter(Boolean).map(r => {
    const k = r.id + ':full';
    if (!S.urls.has(k)) S.urls.set(k, URL.createObjectURL(r.blob));
    return S.urls.get(k);
  });
  const r = RARITY_MAP[e.rarity] || RARITY_MAP.common;
  const col = COLOUR_MAP[e.colour];
  const sights = (e.sightings || []).slice().sort((a, b) => b.at - a.at);

  $('#viewBody').innerHTML = `
    <div class="vhero">
      ${urls.length ? `<div class="track">${urls.map(u => `<img src="${u}" alt="">`).join('')}</div>`
                    : `<div class="noshot">🚗</div>`}
    </div>
    <div class="vtitle">
      <div class="vno">CATCH #${String(e.no).padStart(3, '0')} · SEEN ${sights.length}×</div>
      <h2>${esc(e.model || e.make || 'Unknown')}</h2>
      <div class="vsub">${esc([subMake(e), e.year].filter(Boolean).join(' · ')) || '—'}</div>
      <div class="vbadges">
        <span class="vbadge" style="color:${isLight(r.colour) ? '#0d1015' : '#fff'};background:${r.colour}">T${r.tier} ${esc(r.label)}</span>
        ${(e.types || []).map(t => {
          const ty = TYPE_MAP[t]; if (!ty) return '';
          return `<span class="vbadge" style="color:${readable(ty.colour)};background:${hexA(ty.colour, .18)}">${esc(ty.label)}</span>`;
        }).join('')}
      </div>
    </div>
    <div class="vgrid">
      ${col ? `<div class="vcell"><div class="k">Colour</div><div class="v">${esc(col.label)}</div></div>` : ''}
      ${e.plate ? `<div class="vcell"><div class="k">Plate</div><div class="v" style="font-family:ui-monospace,monospace">${esc(e.plate)}</div></div>` : ''}
      <div class="vcell"><div class="k">First seen</div><div class="v">${fmtDate(sights.length ? sights[sights.length - 1].at : e.created)}</div></div>
      <div class="vcell"><div class="k">XP</div><div class="v" style="color:var(--gold)">${r.xp * sights.length}</div></div>
    </div>
    <div class="vsection">
      <h3>Vibe check</h3>
      ${STATS.map(s => {
        const v = (e.stats && e.stats[s.id]) ?? 5;
        return `<div class="vstat"><span class="sn">${esc(s.label)}</span>
          <div class="bar"><i style="width:${v * 10}%;background:${statCol(v)}"></i></div>
          <span class="sv">${v}</span></div>`;
      }).join('')}
    </div>
    ${e.notes ? `<div class="vsection"><h3>Notes</h3><div class="vnotes">${esc(e.notes)}</div></div>` : ''}
    <div class="vsection">
      <h3>Sighting log</h3>
      ${sights.map((s, i) => `<div class="sight">
        <span class="sn">${sights.length - i}</span>
        <div><div class="sdate">${fmtDate(s.at)}</div>
        ${s.place ? `<div class="splace">${esc(s.place)}</div>` : ''}</div></div>`).join('')}
      <button class="btn ghost block" id="btnAgain" style="margin-top:10px">Seen it again</button>
      <button class="btn ghost block" id="btnFav">${e.fav ? '★ Remove from favourites' : '☆ Add to favourites'}</button>
    </div>
    <div class="sheetpad"></div>`;

  $('#btnAgain').onclick = async () => {
    const place = prompt('Where this time? (optional)');
    if (place === null) return;
    e.sightings = e.sightings || [];
    e.sightings.push({ at: Date.now(), place: place.trim() });
    await DB.putEntry(e);
    S.entries = await DB.allEntries();
    refreshCurrent(); openView(id);
    toast(`Sighting ${e.sightings.length} logged · +${r.xp} XP`); haptic([10, 40, 14]);
  };
  $('#btnFav').onclick = async () => {
    e.fav = !e.fav;
    await DB.putEntry(e);
    S.entries = await DB.allEntries();
    refreshCurrent(); openView(id);
    toast(e.fav ? 'Added to favourites' : 'Removed'); haptic(8);
  };
  openSheet('#viewSheet');
}

$('#viewClose').addEventListener('click', () => closeSheet('#viewSheet'));
$('#viewEdit').addEventListener('click', () => {
  const e = S.entries.find(x => x.id === viewId); if (e) openEdit(e);
});

/* ═══════ SETTINGS ═══════ */

$('#btnSettings').addEventListener('click', async () => {
  const u = await DB.usage();
  const photos = S.entries.reduce((a, e) => a + (e.photos || []).length, 0);
  $('#usage').innerHTML = `<strong>${photos}</strong> photos · using
    <strong>${(u.used / 1048576).toFixed(1)} MB</strong>`;
  showVersion();
  openSheet('#setSheet');
});
$('#setClose').addEventListener('click', () => closeSheet('#setSheet'));

function showVersion() {
  const el = $('#version'); if (!el) return;
  const sw = navigator.serviceWorker;
  if (!sw || !sw.controller) { el.textContent = 'AutoDex · offline'; return; }
  const ch = new MessageChannel();
  const t = setTimeout(() => ch.port1.close(), 1200);
  ch.port1.onmessage = ev => {
    clearTimeout(t);
    if (ev.data && ev.data.version) el.textContent = `AutoDex · offline · ${ev.data.version}`;
    ch.port1.close();
  };
  try { sw.controller.postMessage({ type: 'VERSION' }, [ch.port2]); } catch {}
}

$('#btnExport').addEventListener('click', async () => {
  if (!S.entries.length) { toast('Nothing to back up'); return; }
  toast('Building backup…');
  try {
    const data = await DB.exportBackup();
    data.autodex = { garage: S.garage, pinned: S.pinned };
    download(new Blob([JSON.stringify(data)], { type: 'application/json' }),
             `autodex-${stamp()}.json`);
    hideToast(); toast('Backup saved');
  } catch { toast('Backup failed'); }
});

$('#btnRestore').addEventListener('click', () => $('#fileRestore').click());
$('#fileRestore').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  let data; try { data = JSON.parse(await f.text()); } catch { toast('Could not read that file'); return; }
  const mode = S.entries.length
    ? (confirm('Merge into your dex? (Cancel = replace everything)') ? 'merge' : 'replace')
    : 'replace';
  toast('Restoring…');
  try {
    const res = await DB.importBackup(data, mode);
    if (data.autodex) {
      S.garage = data.autodex.garage || S.garage;
      S.pinned = data.autodex.pinned || S.pinned;
      await DB.setMeta('garage-dream', S.garage.dream);
      await DB.setMeta('garage-tofind', S.garage.tofind);
      await DB.setMeta('pinned', S.pinned);
    }
    S.entries = await DB.allEntries();
    await hydrate(); refreshCurrent(); hideToast();
    toast(`Restored ${res.added} entries`);
  } catch (err) { toast(err.message || 'Restore failed'); }
});

$('#btnWipe').addEventListener('click', async () => {
  if (!confirm('Delete every catch and photo?')) return;
  if (!confirm('Really sure? Export a backup first if unsure.')) return;
  for (const u of S.urls.values()) URL.revokeObjectURL(u);
  S.urls.clear();
  await DB.wipe();
  S.entries = []; S.garage = { dream: [], tofind: [] }; S.pinned = null;
  closeSheet('#setSheet'); refreshCurrent(); toast('Everything deleted');
});

/* ═══════ SHEETS ═══════ */

S.sheetStack = [];
function openSheet(sel) {
  const el = $(sel);
  $('#scrim').hidden = false;
  el.hidden = false; el.classList.remove('closing');
  el.querySelector('.sheetbody').scrollTop = 0;
  if (!S.sheetStack.includes(sel)) S.sheetStack.push(sel);
  el.style.zIndex = 60 + S.sheetStack.indexOf(sel);
  document.body.style.overflow = 'hidden';
}
function closeSheet(sel) {
  const el = $(sel);
  if (el.hidden) return;
  el.classList.add('closing');
  setTimeout(() => {
    el.hidden = true; el.classList.remove('closing'); el.style.zIndex = '';
    S.sheetStack = S.sheetStack.filter(s => s !== sel);
    if (!S.sheetStack.length) { $('#scrim').hidden = true; document.body.style.overflow = ''; }
  }, 210);
}
$('#scrim').addEventListener('click', () => {
  const top = S.sheetStack[S.sheetStack.length - 1];
  if (top === '#editSheet') { $('#editCancel').click(); return; }
  if (top) closeSheet(top);
});

/* ═══════ HELPERS ═══════ */

function uid() { return crypto.randomUUID ? crypto.randomUUID() : 'x' + Date.now() + Math.random().toString(36).slice(2); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function isLight(hex) {
  if (!hex || !hex.startsWith('#')) return false;
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 150;
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function readable(hex) {
  let n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = () => 0.299 * r + 0.587 * g + 0.114 * b;
  let i = 0;
  while (lum() < 130 && i++ < 24) {
    r = Math.min(255, Math.round(r + (255 - r) * .16));
    g = Math.min(255, Math.round(g + (255 - g) * .16));
    b = Math.min(255, Math.round(b + (255 - b) * .16));
  }
  return `rgb(${r},${g},${b})`;
}
function statCol(v) { return v >= 8 ? '#3ddc84' : v >= 5 ? '#f5c542' : v >= 3 ? '#f97316' : '#e01836'; }
function fullName(make, model) {
  const mk = String(make || '').trim(), md = String(model || '').trim();
  if (!mk) return md; if (!md) return mk;
  return md.toLowerCase().startsWith(mk.toLowerCase() + ' ') || md.toLowerCase() === mk.toLowerCase()
    ? md : `${mk} ${md}`;
}
function subMake(e) {
  const mk = String(e.make || '').trim(), md = String(e.model || '').trim();
  if (!md || !mk) return '';
  return md.toLowerCase().startsWith(mk.toLowerCase() + ' ') || md.toLowerCase() === mk.toLowerCase() ? '' : mk;
}
function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function stamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
}
function haptic(p) { if (navigator.vibrate) try { navigator.vibrate(p); } catch {} }

let toastT = null;
function toast(msg, ms = 2100) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false; t.classList.remove('out');
  clearTimeout(toastT); toastT = setTimeout(hideToast, ms);
}
function hideToast() {
  const t = $('#toast'); if (t.hidden) return;
  t.classList.add('out');
  setTimeout(() => { t.hidden = true; t.classList.remove('out'); }, 220);
}

/* back button closes sheets / returns home */
window.addEventListener('popstate', () => {
  const top = S.sheetStack[S.sheetStack.length - 1];
  if (top) closeSheet(top);
  else if (S.screen !== 'home') go('home');
  history.pushState({ n: 1 }, '');
});
history.pushState({ n: 1 }, '');
