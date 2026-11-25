/**
 * Riwayat keramaian (disimpan di perangkat) dan peringatan kapasitas.
 * Dipisah dari useObjectDetection: hanya membaca `stats` yang diperbarui sekitar sekali per detik.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createHistory } from '../utils/analytics';
import { createAlertGate, metricValue } from '../utils/alert';
import { beep, vibrate, sendTelegram } from '../utils/notify';
import { loadJson, saveJson } from '../utils/storage';

const HISTORY_KEY = 'deteksi:history:v1';
const SETTINGS_KEY = 'deteksi:alert:v1';
const DEFAULT_SETTINGS = { limit: 0, metric: 'current', sound: true, token: '', chatId: '' };
const SAVE_EVERY_MS = 10_000;

export function useAnalytics(stats, isRunning) {
  const [history] = useState(() => createHistory({ initial: loadJson(HISTORY_KEY, []) }));
  const [gate] = useState(() => createAlertGate());
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS, ...loadJson(SETTINGS_KEY, {}) }));
  const [, setRevision] = useState(0); // memicu render ulang setelah riwayat dihapus
  const lastSaveRef = useRef(0);

  // Catat satu sampel tiap `stats` diperbarui (hanya saat deteksi berjalan)
  useEffect(() => {
    if (!isRunning) return;
    const now = Date.now();
    history.record(now, stats);
    if (now - lastSaveRef.current > SAVE_EVERY_MS) {
      lastSaveRef.current = now;
      saveJson(HISTORY_KEY, history.buckets());
    }
  }, [stats, isRunning, history]);

  // Simpan saat berhenti, saat halaman ditutup, dan saat komponen dilepas
  useEffect(() => {
    const save = () => saveJson(HISTORY_KEY, history.buckets());
    if (!isRunning) save();
    window.addEventListener('pagehide', save);
    return () => window.removeEventListener('pagehide', save);
  }, [isRunning, history]);

  const value = metricValue(stats, settings.metric);
  const over = settings.limit > 0 && value > settings.limit;

  // Bunyi, getar, dan Telegram saat melewati batas (ditahan beberapa detik + cooldown di `gate`)
  useEffect(() => {
    if (!isRunning) return;
    if (!gate.check(metricValue(stats, settings.metric), settings.limit, performance.now())) return;
    const v = metricValue(stats, settings.metric);
    const label = settings.metric === 'inside' ? 'orang di dalam' : 'orang terlihat';
    if (settings.sound) {
      beep();
      vibrate();
    }
    sendTelegram(settings, `⚠️ Kapasitas terlampaui: ${v} ${label} (batas ${settings.limit}).`);
  }, [stats, isRunning, gate, settings]);

  const updateSettings = useCallback((patch) => {
    const next = { ...settings, ...patch };
    saveJson(SETTINGS_KEY, next);
    setSettings(next);
  }, [settings]);

  const clearHistory = useCallback(() => {
    history.clear();
    saveJson(HISTORY_KEY, []);
    setRevision((r) => r + 1);
  }, [history]);

  const testTelegram = useCallback(
    () => sendTelegram(settings, '✅ Tes notifikasi dari Penghitung Orang AI'),
    [settings]
  );

  return { settings, updateSettings, history, clearHistory, testTelegram, value, over };
}
