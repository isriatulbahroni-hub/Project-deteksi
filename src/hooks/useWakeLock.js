/**
 * Menjaga layar tetap menyala selama `active` (mis. saat deteksi berjalan), bila didukung browser.
 * Kunci dilepas otomatis oleh browser saat tab disembunyikan, jadi diminta lagi saat tab terlihat.
 */

import { useEffect } from 'react';

export function useWakeLock(active) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return undefined;

    let lock = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) lock.release().catch(() => {});
      } catch {
        // Ditolak (mis. mode hemat baterai): aplikasi tetap jalan seperti biasa
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
