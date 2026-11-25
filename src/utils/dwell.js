/**
 * Lama terlihat: berapa lama tiap orang bertahan di kamera (dari ID tracker).
 * Orang dianggap pergi bila tidak terlihat > `gapMs`; yang terlihat < `minMs` diabaikan (sekilas/noise).
 */

export function createDwell({ gapMs = 3000, minMs = 1000 } = {}) {
  const active = new Map(); // id -> { first, last } (ms)
  let count = 0;
  let total = 0;
  let longest = 0;

  function finish(rec) {
    const d = rec.last - rec.first;
    if (d < minMs) return;
    count++;
    total += d;
    if (d > longest) longest = d;
  }

  function update(people, now) {
    for (const p of people) {
      const r = active.get(p.id);
      if (r) r.last = now;
      else active.set(p.id, { first: now, last: now });
    }
    for (const [id, r] of active) {
      if (now - r.last > gapMs) {
        finish(r);
        active.delete(id);
      }
    }
  }

  // Tracker baru memakai ID baru: selesaikan semua yang masih aktif.
  function newSession() {
    for (const r of active.values()) finish(r);
    active.clear();
  }

  function snapshot() {
    let c = count;
    let t = total;
    let l = longest;
    for (const r of active.values()) {
      const d = r.last - r.first;
      if (d < minMs) continue;
      c++;
      t += d;
      if (d > l) l = d;
    }
    return { count: c, avgSec: c ? t / c / 1000 : 0, maxSec: l / 1000 };
  }

  function reset() {
    active.clear();
    count = total = longest = 0;
  }

  return { update, newSession, snapshot, reset };
}
