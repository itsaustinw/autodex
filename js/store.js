/* ═══════════════════════════════════════════
   CARDEX — storage layer
   IndexedDB: entries (metadata) + photos (blobs, kept separate
   so the grid can load fast without pulling megabytes of JPEG).
   ═══════════════════════════════════════════ */

const DB_NAME = 'cardex';
const DB_VER = 1;
let _db = null;

export function open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains('entries')) {
        const s = db.createObjectStore('entries', { keyPath: 'id' });
        s.createIndex('created', 'created');
        s.createIndex('make', 'make');
      }
      if (!db.objectStoreNames.contains('photos')) {
        db.createObjectStore('photos', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'k' });
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(stores, mode = 'readonly') {
  return open().then(db => db.transaction(stores, mode));
}

function done(t) {
  return new Promise((res, rej) => {
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}

function reqp(r) {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

/* ───────── entries ───────── */

export async function allEntries() {
  const t = await tx(['entries']);
  const rows = await reqp(t.objectStore('entries').getAll());
  return rows.sort((a, b) => a.no - b.no);
}

export async function getEntry(id) {
  const t = await tx(['entries']);
  return reqp(t.objectStore('entries').get(id));
}

export async function putEntry(entry) {
  const t = await tx(['entries'], 'readwrite');
  t.objectStore('entries').put(entry);
  await done(t);
  return entry;
}

export async function deleteEntry(id) {
  const e = await getEntry(id);
  const t = await tx(['entries', 'photos'], 'readwrite');
  t.objectStore('entries').delete(id);
  if (e && e.photos) for (const pid of e.photos) t.objectStore('photos').delete(pid);
  await done(t);
}

export async function nextNo() {
  const rows = await allEntries();
  return rows.reduce((m, r) => Math.max(m, r.no || 0), 0) + 1;
}

/* ───────── photos ───────── */

export async function putPhoto(id, blob, thumb) {
  const t = await tx(['photos'], 'readwrite');
  t.objectStore('photos').put({ id, blob, thumb });
  await done(t);
  return id;
}

export async function getPhoto(id) {
  const t = await tx(['photos']);
  return reqp(t.objectStore('photos').get(id));
}

export async function getPhotos(ids) {
  if (!ids || !ids.length) return [];
  const t = await tx(['photos']);
  const s = t.objectStore('photos');
  return Promise.all(ids.map(id => reqp(s.get(id))));
}

export async function deletePhoto(id) {
  const t = await tx(['photos'], 'readwrite');
  t.objectStore('photos').delete(id);
  await done(t);
}

export async function allPhotos() {
  const t = await tx(['photos']);
  return reqp(t.objectStore('photos').getAll());
}

/* ───────── meta / prefs ───────── */

export async function getMeta(k, fallback = null) {
  const t = await tx(['meta']);
  const row = await reqp(t.objectStore('meta').get(k));
  return row ? row.v : fallback;
}

export async function setMeta(k, v) {
  const t = await tx(['meta'], 'readwrite');
  t.objectStore('meta').put({ k, v });
  await done(t);
}

/* ───────── wipe ───────── */

export async function wipe() {
  const t = await tx(['entries', 'photos', 'meta'], 'readwrite');
  t.objectStore('entries').clear();
  t.objectStore('photos').clear();
  t.objectStore('meta').clear();
  await done(t);
}

/* ═══════ image processing ═══════
   Resize + re-encode on device. Phone photos are 3–8 MB;
   these land around 120–400 KB with no visible loss on a phone screen. */

const MAXES = { normal: 1400, hi: 2000 };
const QUALITY = { normal: 0.76, hi: 0.86 };
const THUMB = 420;

function loadBitmap(file) {
  if (window.createImageBitmap) {
    // imageOrientation fixes EXIF-rotated phone photos
    return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => loadViaImg(file));
  }
  return loadViaImg(file);
}

function loadViaImg(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); rej(e); };
    img.src = url;
  });
}

function drawTo(src, max, quality) {
  const sw = src.width, sh = src.height;
  const scale = Math.min(1, max / Math.max(sw, sh));
  const w = Math.round(sw * scale), h = Math.round(sh * scale);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { alpha: false });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  return new Promise(res => {
    if (c.toBlob) c.toBlob(b => res(b), 'image/jpeg', quality);
    else res(dataURLtoBlob(c.toDataURL('image/jpeg', quality)));
  });
}

function dataURLtoBlob(u) {
  const [head, b64] = u.split(',');
  const mime = head.match(/:(.*?);/)[1];
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export async function processImage(file, mode = 'normal') {
  const bmp = await loadBitmap(file);
  const full = await drawTo(bmp, MAXES[mode] || MAXES.normal, QUALITY[mode] || QUALITY.normal);
  const thumb = await drawTo(bmp, THUMB, 0.7);
  if (bmp.close) bmp.close();
  return { full, thumb };
}

/* ═══════ storage usage ═══════ */

export async function usage() {
  if (navigator.storage && navigator.storage.estimate) {
    const e = await navigator.storage.estimate();
    return { used: e.usage || 0, quota: e.quota || 0 };
  }
  return { used: 0, quota: 0 };
}

export async function persist() {
  if (navigator.storage && navigator.storage.persist) {
    try { return await navigator.storage.persist(); } catch { return false; }
  }
  return false;
}

/* ═══════ backup / restore ═══════ */

function blobToDataURL(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

async function dataURLtoBlobAsync(u) {
  const r = await fetch(u);
  return r.blob();
}

export async function exportBackup(onProgress) {
  const entries = await allEntries();
  const photos = await allPhotos();
  const out = { format: 'cardex-backup', version: 1, exported: new Date().toISOString(), entries, photos: [] };
  let i = 0;
  for (const p of photos) {
    out.photos.push({
      id: p.id,
      blob: await blobToDataURL(p.blob),
      thumb: p.thumb ? await blobToDataURL(p.thumb) : null
    });
    if (onProgress) onProgress(++i, photos.length);
  }
  return out;
}

export async function importBackup(data, mode = 'merge') {
  if (!data || data.format !== 'cardex-backup') throw new Error('That is not a CARDEX backup file.');
  if (mode === 'replace') await wipe();

  const existing = await allEntries();
  const byId = new Map(existing.map(e => [e.id, e]));
  let maxNo = existing.reduce((m, e) => Math.max(m, e.no || 0), 0);
  let added = 0, skipped = 0;

  for (const p of (data.photos || [])) {
    const blob = await dataURLtoBlobAsync(p.blob);
    const thumb = p.thumb ? await dataURLtoBlobAsync(p.thumb) : null;
    await putPhoto(p.id, blob, thumb);
  }
  for (const e of (data.entries || [])) {
    if (byId.has(e.id)) { skipped++; continue; }
    const copy = { ...e };
    if (mode === 'merge') copy.no = ++maxNo;
    await putEntry(copy);
    added++;
  }
  return { added, skipped };
}
