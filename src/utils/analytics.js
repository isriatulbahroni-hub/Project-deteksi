/**
 * Riwayat keramaian per menit (rata-rata, puncak, masuk, keluar), deret waktu untuk grafik,
 * dan ekspor CSV. Murni logika tanpa DOM supaya mudah diuji.
 */

export const MINUTE = 60_000;

const pad = (n) => String(n).padStart(2, '0');

const isBucket = (b) =>
  !!b && [b.t, b.sum, b.n, b.max, b.in, b.out].every(Number.isFinite) && b.n > 0;

export function createHistory({ bucketMs = MINUTE, maxBuckets = 1440, initial = [] } = {}) {
  const buckets = Array.isArray(initial) ? initial.filter(isBucket).slice(-maxBuckets) : [];
  let lastIn = null; // hitungan masuk/keluar bersifat kumulatif; yang disimpan hanya selisihnya
  let lastOut = null;

  function record(now, { current = 0, in: inCount = 0, out: outCount = 0 } = {}) {
    let t = Math.floor(now / bucketMs) * bucketMs;
    let b = buckets[buckets.length - 1];
    if (b && t < b.t) t = b.t; // jam perangkat mundur: tetap tulis ke bucket terakhir
    if (!b || b.t !== t) {
      b = { t, sum: 0, n: 0, max: 0, in: 0, out: 0 };
      buckets.push(b);
      if (buckets.length > maxBuckets) buckets.shift();
    }
    // Hitungan yang turun berarti direset: jangan hasilkan selisih negatif.
    if (lastIn !== null && inCount >= lastIn) b.in += inCount - lastIn;
    if (lastOut !== null && outCount >= lastOut) b.out += outCount - lastOut;
    lastIn = inCount;
    lastOut = outCount;
    b.sum += current;
    b.n++;
    if (current > b.max) b.max = current;
  }

  function clear() {
    buckets.length = 0;
    lastIn = lastOut = null;
  }

  return {
    record,
    clear,
    buckets: () => buckets,
    lastTime: () => (buckets.length ? buckets[buckets.length - 1].t : 0),
  };
}

/**
 * Deret waktu tetap (tanpa lubang) untuk grafik: `spanMs` terakhir dibagi per `stepMs`.
 * Tiap langkah: puncak = nilai terbesar, masuk/keluar dijumlahkan.
 */
export function series(buckets, now, { spanMs, stepMs }) {
  const steps = Math.max(1, Math.round(spanMs / stepMs));
  const end = Math.floor(now / stepMs) * stepMs;
  const start = end - (steps - 1) * stepMs;
  const out = Array.from({ length: steps }, (_, i) => ({ t: start + i * stepMs, max: 0, in: 0, out: 0 }));
  for (const b of buckets) {
    const i = Math.floor((b.t - start) / stepMs);
    if (i < 0 || i >= steps) continue;
    const s = out[i];
    s.max = Math.max(s.max, b.max);
    s.in += b.in;
    s.out += b.out;
  }
  return out;
}

export function formatTime(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatClock(t) {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Detik -> "m:ss" (atau "–" bila belum ada data). */
export function formatDuration(sec) {
  if (!(sec >= 1)) return '–';
  const total = Math.round(sec);
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
}

export function toCsv(buckets) {
  const rows = ['waktu,rata_rata,puncak,masuk,keluar'];
  for (const b of buckets) {
    rows.push([formatTime(b.t), (b.sum / b.n).toFixed(1), b.max, b.in, b.out].join(','));
  }
  return rows.join('\n');
}
