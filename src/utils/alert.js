/**
 * Peringatan kapasitas: menyala bila nilai melewati batas cukup lama (`holdMs`, supaya lonjakan
 * satu frame tidak memicu), lalu menunggu `cooldownMs` sebelum menyala lagi.
 */

export function createAlertGate({ holdMs = 3000, cooldownMs = 60_000 } = {}) {
  let overSince = null;
  let lastFire = -Infinity;

  /** @returns {boolean} true bila peringatan harus dikirim sekarang. `limit` <= 0 berarti mati. */
  function check(value, limit, now) {
    if (!(limit > 0) || value <= limit) {
      overSince = null;
      return false;
    }
    if (overSince === null) overSince = now;
    if (now - overSince < holdMs) return false;
    if (now - lastFire < cooldownMs) return false;
    lastFire = now;
    return true;
  }

  function reset() {
    overSince = null;
    lastFire = -Infinity;
  }

  return { check, reset };
}

/** Nilai yang dibandingkan dengan batas: orang terlihat di kamera, atau perkiraan di dalam (masuk - keluar). */
export function metricValue(stats, metric) {
  return metric === 'inside' ? Math.max(0, stats.in - stats.out) : stats.current;
}
