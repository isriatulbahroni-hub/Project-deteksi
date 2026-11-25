/**
 * Deteksi bebas (open-vocabulary): pengguna mengetik nama objek, model mencari objek itu.
 * Modul ini hanya berisi fungsi murni (tanpa model) supaya mudah dites.
 *
 * Model teks (CLIP) paham bahasa Inggris, jadi kata Indonesia yang umum diterjemahkan dulu.
 * Kata yang tidak ada di kamus dipakai apa adanya (bahasa Inggris juga boleh).
 */

/** Kamus kecil Indonesia -> Inggris untuk barang yang sering dihitung. */
export const ID_TO_EN = {
  pupuk: 'fertilizer bag',
  'karung pupuk': 'fertilizer bag',
  karung: 'sack',
  sak: 'sack',
  'sak semen': 'cement bag',
  semen: 'cement bag',
  botol: 'bottle',
  kardus: 'cardboard box',
  dus: 'cardboard box',
  kotak: 'box',
  galon: 'water gallon',
  telur: 'egg',
  buah: 'fruit',
  jeruk: 'orange',
  apel: 'apple',
  pisang: 'banana',
  kelapa: 'coconut',
  tomat: 'tomato',
  kayu: 'wooden log',
  balok: 'wooden beam',
  batu: 'stone',
  bata: 'brick',
  'batu bata': 'brick',
  pipa: 'pipe',
  besi: 'steel bar',
  ban: 'tire',
  drum: 'drum barrel',
  kaleng: 'can',
  gelas: 'cup',
  piring: 'plate',
  buku: 'book',
  pulpen: 'pen',
  'hp': 'mobile phone',
  ponsel: 'mobile phone',
  kursi: 'chair',
  meja: 'table',
  orang: 'person',
  motor: 'motorcycle',
  mobil: 'car',
  sepeda: 'bicycle',
  ayam: 'chicken',
  sapi: 'cow',
  kambing: 'goat',
  bibit: 'seedling',
  tanaman: 'plant',
  pot: 'flower pot',
  paku: 'nail',
  baut: 'bolt',
};

/** Contoh cepat yang ditampilkan sebagai tombol. */
export const QUICK_PICKS = ['pupuk', 'karung', 'botol', 'kardus', 'telur', 'kayu', 'sak semen', 'galon'];

/** Bersihkan teks masukan: huruf kecil, spasi rapi, maksimal 40 karakter. */
export function cleanQuery(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

/** Terjemahkan satu nama objek ke bahasa Inggris (kata yang tidak dikenal dipakai apa adanya). */
export function toEnglish(query) {
  const q = cleanQuery(query);
  if (!q) return '';
  if (ID_TO_EN[q]) return ID_TO_EN[q];
  // Frasa panjang: terjemahkan kata per kata bila semuanya dikenal, selain itu pakai apa adanya
  const words = q.split(' ');
  const mapped = words.map((w) => ID_TO_EN[w]);
  return mapped.every(Boolean) ? mapped.join(' ') : q;
}

/** Kalimat yang dikirim ke model teks. Bentuk "a photo of a ..." membuat skor lebih stabil. */
export function buildPrompt(query) {
  const en = toEnglish(query);
  return en ? `a photo of a ${en}` : '';
}

/** Nama yang ditampilkan di layar: huruf pertama kapital, sesuai ketikan pengguna. */
export function displayName(query) {
  const q = cleanQuery(query);
  return q ? q.charAt(0).toUpperCase() + q.slice(1) : '';
}

/**
 * Ubah keluaran model (kotak xmin/ymin/xmax/ymax dalam piksel gambar yang dikirim) menjadi
 * deteksi biasa {x, y, width, height, confidence, classId, className} dalam piksel video.
 * `scale` = lebar video / lebar gambar yang dikirim.
 */
export function mapResults(results, { scale = 1, label, threshold = 0.1, maxDetections = 100 } = {}) {
  const out = [];
  for (const r of results ?? []) {
    const b = r?.box;
    if (!b || !Number.isFinite(r.score) || r.score < threshold) continue;
    const width = (b.xmax - b.xmin) * scale;
    const height = (b.ymax - b.ymin) * scale;
    if (!(width > 1 && height > 1)) continue;
    out.push({
      x: b.xmin * scale,
      y: b.ymin * scale,
      width,
      height,
      confidence: r.score,
      classId: 0,
      className: label,
    });
  }
  out.sort((a, b) => b.confidence - a.confidence);
  return out.slice(0, maxDetections);
}

/**
 * Buang kotak raksasa yang hampir menutupi seluruh frame (sering salah di model bebas) dan
 * kotak yang hampir sama dengan kotak lain yang lebih yakin (NMS sederhana).
 */
export function cleanDetections(dets, { frameArea, maxAreaRatio = 0.85, iou = 0.5 } = {}) {
  const kept = [];
  for (const d of dets) {
    if (frameArea && (d.width * d.height) / frameArea > maxAreaRatio) continue;
    const dup = kept.some((k) => overlap(k, d) > iou);
    if (!dup) kept.push(d);
  }
  return kept;
}

function overlap(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}
