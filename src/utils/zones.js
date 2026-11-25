/**
 * Zona area (poligon, koordinat 0..1 relatif terhadap frame): berapa objek sedang berada di dalam,
 * puncaknya, dan berapa lama mereka sudah berada di situ. Titik acuan objek = tengah-bawah kotak
 * (posisi kaki). Murni logika tanpa DOM supaya mudah diuji.
 */

/** Uji titik-dalam-poligon (ray casting). `poly` = [[x, y], ...]. */
export function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const rectPolygon = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

export function createZoneTracker() {
  const entered = new Map(); // id zona -> Map(id orang -> waktu masuk, ms)
  const peaks = new Map();   // id zona -> jumlah terbanyak sekaligus di dalam

  /**
   * @param {Array} people - { id, x, y, width, height } dalam piksel
   * @param {{width:number,height:number}} dims - ukuran frame
   * @param {Array} zones - { id, points } dengan points berkoordinat 0..1
   * @param {number} now - ms
   */
  function update(people, { width, height }, zones, now) {
    const ids = new Set(zones.map((z) => z.id));
    for (const id of [...entered.keys()]) {
      if (!ids.has(id)) {
        entered.delete(id);
        peaks.delete(id);
      }
    }
    for (const zone of zones) {
      const before = entered.get(zone.id) ?? new Map();
      const inside = new Map();
      for (const p of people) {
        const fx = (p.x + p.width / 2) / width;
        const fy = Math.min(0.999, (p.y + p.height) / height);
        if (pointInPolygon(fx, fy, zone.points)) inside.set(p.id, before.get(p.id) ?? now);
      }
      entered.set(zone.id, inside);
      peaks.set(zone.id, Math.max(peaks.get(zone.id) ?? 0, inside.size));
    }
  }

  function snapshot(zones, now) {
    return zones.map((zone) => {
      const inside = entered.get(zone.id) ?? new Map();
      const secs = [...inside.values()].map((t) => Math.max(0, (now - t) / 1000));
      return {
        id: zone.id,
        current: inside.size,
        peak: peaks.get(zone.id) ?? 0,
        avgSec: secs.length ? secs.reduce((a, b) => a + b, 0) / secs.length : 0,
        maxSec: secs.length ? Math.max(...secs) : 0,
      };
    });
  }

  // Deteksi dimulai ulang: ID tracker mulai dari 1 lagi, jadi daftar orang di dalam dikosongkan.
  const newSession = () => entered.forEach((m) => m.clear());

  function reset() {
    entered.clear();
    peaks.clear();
  }

  return { update, snapshot, newSession, reset };
}
