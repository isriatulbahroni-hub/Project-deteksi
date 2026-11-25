/**
 * Penghitung orang: garis virtual masuk/keluar, puncak keramaian, dan total orang unik.
 * Garis 'h' = horizontal (atas → bawah dihitung masuk), 'v' = vertikal (kiri → kanan dihitung masuk).
 * `flip` membalik arah. Memakai titik tengah kotak dan zona mati (deadzone) di sekitar garis
 * supaya orang yang berdiri di garis tidak terhitung berulang kali.
 */

export const DEFAULT_LINE = { orientation: 'h', pos: 0.5, flip: false };

export function createCounter({ deadzone = 0.02 } = {}) {
  const lastSide = new Map(); // id -> -1 | 1 (sisi terakhir yang pasti)
  const seen = new Set();
  let inCount = 0;
  let outCount = 0;
  let peak = 0;
  let uniqueBase = 0; // orang unik dari sesi deteksi sebelumnya (ID tracker mulai dari 1 lagi)

  function update(people, { width, height }, line = DEFAULT_LINE) {
    const horizontal = line.orientation === 'h';
    const dim = horizontal ? height : width;
    const lineAt = line.pos * dim;
    const margin = deadzone * dim;

    for (const p of people) {
      seen.add(p.id);
      const c = horizontal ? p.y + p.height / 2 : p.x + p.width / 2;
      const offset = c - lineAt;
      if (Math.abs(offset) < margin) continue; // terlalu dekat garis: belum pasti
      const side = offset < 0 ? -1 : 1;
      const prev = lastSide.get(p.id);
      if (prev !== undefined && prev !== side) {
        const forward = side === 1; // melewati garis ke arah atas→bawah / kiri→kanan
        if (forward !== line.flip) inCount++;
        else outCount++;
      }
      lastSide.set(p.id, side);
    }

    if (lastSide.size > 500) lastSide.clear();
    peak = Math.max(peak, people.length);
  }

  const snapshot = () => ({ in: inCount, out: outCount, peak, unique: uniqueBase + seen.size });

  // Dipanggil saat deteksi dimulai ulang: tracker baru memakai ID baru, hitungan tetap berjalan.
  function newSession() {
    uniqueBase += seen.size;
    seen.clear();
    lastSide.clear();
  }

  function reset() {
    lastSide.clear();
    seen.clear();
    inCount = outCount = peak = uniqueBase = 0;
  }

  return { update, snapshot, reset, newSession };
}
