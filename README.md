# AutoDex 🚗

Spot it. Snap it. Collect it.

A car-spotting dex built around a hub home screen, a 3,006-car catalogue and a
ten-tier rarity ladder. Installable web app — iPhone and Android, fully offline,
no accounts, no keys, no running costs.

**This is a separate app from CARDEX.** Both can be installed at once. Your
CARDEX backup imports here (Settings → Restore), but the two don't stay in sync.

---

## The four screens

**Home** — a hub, not a list.
- *Shuffle board*: swipe through the weekly challenge, your pinned to-find car
  and your next catalogue milestone.
- *Take photo* / *Import*.
- Three doors: My Dex, My Garage, Browse.
- Recent captures, then your rank and progress.

**My Dex** — everything you've actually photographed. Search, filter by tier.

**My Garage** — the stuff you care about, in three lists:
- **Dream Cars** — what you'd want in the driveway
- **Favourites** — the best things you've genuinely seen
- **To Find** — your hunt list. Pin one and it sits on your home screen.

**Browse** — all 3,006 catalogued cars. Caught ones sort to the top with a green
tick, so it opens on evidence of progress rather than a wall of unknowns. Filter
by All / Caught / Missing and by tier.

---

## The ten tiers

| # | Tier | XP | What it means |
|---|---|---|---|
| 1 | Common | 10 | Everyday traffic |
| 2 | Uncommon | 20 | Regularly seen, noticeably less common |
| 3 | Rare | 40 | Something you'd genuinely notice |
| 4 | Epic | 75 | A serious spot; phone comes out |
| 5 | Legendary | 130 | Very unusual even among supercars |
| 6 | Mythic | 220 | Hypercar territory |
| 7 | Exotic | 340 | Tiny production numbers |
| 8 | Relic | 480 | Historically significant and exceptionally scarce |
| 9 | Prototype | 650 | Concepts, development cars, one-offs |
| 10 | ??? | 900 | How did you even find that |

Spread across the catalogue: 20% Common tapering to 0.8% at tier 10. Tiers 7–10
are mostly things you'll admire in Browse rather than meet in a car park — that's
what they're for.

---

## Autofill

Type a make and model and the catalogue fills in the body type, tier and a year
estimate, and tells you exactly what it matched. Free, instant, offline, no API
keys. Generation codes are part of the model name — `911 (993)`, `Fiesta (Mk7)`,
`3 Series (E46)` — so the autocomplete is precise.

For identifying a car from a photo, use the Gemini prompt in the CARDEX folder;
it outputs the same field names.

---

## Weekly challenges

Twelve challenges rotate by week number. The week picks the challenge
deterministically, so there's no state to store, nothing expires punitively, and
a missed week simply comes round again.

Examples: *Five in seven*, *Rare hunter*, *Rainbow week*, *Badge variety*,
*Old metal*, *New ground*.

---

## Getting it on your phone

Drag the `autodex` folder onto [app.netlify.com/drop](https://app.netlify.com/drop),
or push it to a GitHub Pages repo. Open the HTTPS URL on your phone, then
Share → **Add to Home Screen** (iPhone) or menu → **Install app** (Android).

Updates are self-healing: bump `VERSION` in `sw.js`, push, and installed phones
pick it up on next launch.

---

## Your data

IndexedDB on the device. Photos are resized and recompressed before saving
(~150–400 KB each). Nothing is uploaded anywhere.

**Export regularly** — Settings → Export full backup writes a single JSON with
every entry, photo, garage list and your pinned car.

---

## Files

```
autodex/
├─ index.html              four screens + sheets
├─ manifest.webmanifest
├─ sw.js                   offline cache, self-healing updates
├─ css/app.css
├─ js/
│  ├─ app.js               navigation, board, dex, garage, browse
│  ├─ data.js              tiers, types, colours, ranks
│  ├─ catalogue.js         3,006 cars (generation-level)
│  ├─ challenges.js        12 rotating weekly challenges
│  └─ store.js             IndexedDB, image compression, backup
└─ icons/
```

---

## Not built yet

Deliberately left out of this first pass, and worth being honest about:

- **Specs** (power, torque, 0–60, weight) — obtainable as static data, just
  needs a data pass over 3,006 cars.
- **Price history graphs** — the year-by-year data behind these is trade-only
  (CAP HPI et al) at £15–25 per lookup. Not realistically available for a free
  offline app. Original RRP plus an approximate current value is the honest
  version.
- **Downforce** — published for perhaps a few dozen hypercars worldwide. Not a
  spec that exists for 99% of cars.
- **Achievements** — the tier and challenge systems are in; the big achievement
  engine hasn't been ported across yet.
- **Photo auto-detect** — no free option exists; needs an API key.
