/**
 * Project Deteksi: penghitung orang real-time di browser (khusus tampilan HP).
 */

import { useEffect, useRef, useState } from 'react';
import { useCamera } from './hooks/useCamera';
import { useObjectDetection } from './hooks/useObjectDetection';
import { useAnalytics } from './hooks/useAnalytics';
import { formatDuration } from './utils/analytics';
import CameraView from './components/CameraView';
import Dashboard from './components/Dashboard';
import './App.css';

const TIER_LABEL = { fast: 'Cepat', accurate: 'Akurat' };

function Stat({ label, value, big }) {
  return (
    <div className={`stat${big ? ' stat-big' : ''}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function App() {
  const {
    stream, error: cameraError, isInitialized: isCameraInitialized,
    videoRef, startCamera, stopCamera, switchCamera,
  } = useCamera();

  const {
    model, isLoading: isModelLoading, error: modelError, isRunning: isDetecting,
    fps, getTracks, getHeatmap, stats, line, setLine, resetStats, threshold, setThreshold,
    tier, executionProvider, initializeModel, startDetection, stopDetection,
  } = useObjectDetection();

  const analytics = useAnalytics(stats, isDetecting);
  const { settings, updateSettings } = analytics;

  const [videoFileUrl, setVideoFileUrl] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [tgStatus, setTgStatus] = useState('');
  const fileInputRef = useRef(null);

  // Kamera dan model dimuat otomatis, jadi pengguna tinggal menekan "Mulai"
  useEffect(() => {
    startCamera();
    initializeModel();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => videoFileUrl && URL.revokeObjectURL(videoFileUrl), [videoFileUrl]);

  const handleStart = () => videoRef.current && model && startDetection(videoRef.current);

  // Hentikan deteksi saat sumber video berganti, lalu lanjutkan lagi
  const withDetectionPaused = async (switchSource) => {
    const wasDetecting = isDetecting;
    if (wasDetecting) stopDetection();
    await switchSource();
    if (wasDetecting && model) setTimeout(handleStart, 500);
  };

  const handleVideoFile = (file) => file && withDetectionPaused(async () => {
    stopCamera();
    const url = URL.createObjectURL(file);
    const video = videoRef.current;
    video.srcObject = null; // srcObject lebih diutamakan daripada src
    video.src = url;
    video.loop = true;
    setVideoFileUrl(url);
    await video.play().catch(() => {});
  });

  const handleUseCamera = () => withDetectionPaused(async () => {
    const video = videoRef.current;
    video.removeAttribute('src');
    video.load();
    setVideoFileUrl(null);
    await startCamera();
  });

  const handleSwitchCamera = () => withDetectionPaused(switchCamera);

  const setLimit = (n) => updateSettings({ limit: Math.min(999, Math.max(0, Math.round(Number(n)) || 0)) });

  const handleTestTelegram = async () => {
    setTgStatus('Mengirim…');
    const r = await analytics.testTelegram();
    setTgStatus(r.ok ? '✅ Terkirim' : `⚠️ ${r.error}`);
  };

  const error = cameraError || modelError;

  return (
    <div className="app">
      <header className="app-header">
        <h1>👥 Penghitung Orang AI</h1>
        <span className="chip">
          {isModelLoading ? 'Memuat model…' : model ? `${TIER_LABEL[tier] ?? tier} · ${executionProvider}${isDetecting ? ` · ${fps} FPS` : ''}` : 'Model belum siap'}
        </span>
      </header>

      <CameraView
        videoRef={videoRef}
        stream={stream}
        isFilePlaying={!!videoFileUrl}
        getTracks={getTracks}
        getHeatmap={getHeatmap}
        showHeatmap={showHeatmap}
        isDetecting={isDetecting}
        line={line}
      />

      {analytics.over && (
        <div className="alert-banner" role="alert">
          ⚠️ Melebihi batas: {analytics.value} / {settings.limit}
        </div>
      )}

      <section className="stats">
        <Stat big label="Orang terlihat" value={stats.current} />
        <Stat label="Masuk" value={stats.in} />
        <Stat label="Keluar" value={stats.out} />
        <Stat label="Di dalam (masuk − keluar)" value={Math.max(0, stats.in - stats.out)} />
        <Stat label="Puncak" value={stats.peak} />
        <Stat label="Total unik" value={stats.unique} />
        <Stat label="Lama terlihat (rata-rata)" value={formatDuration(stats.dwellSec)} />
      </section>

      <section className="actions">
        {isDetecting ? (
          <button className="btn btn-stop" onClick={stopDetection}>⏹ Berhenti</button>
        ) : (
          <button className="btn btn-primary" onClick={handleStart} disabled={!model || (!isCameraInitialized && !videoFileUrl)}>
            ▶ Mulai
          </button>
        )}
        <button className="btn" onClick={handleSwitchCamera} disabled={!!videoFileUrl}>🔄 Kamera</button>
        <button className="btn" onClick={resetStats}>↺ Reset</button>
      </section>

      <section className="toggles">
        <button className={`btn btn-small${showHeatmap ? ' btn-on' : ''}`} aria-pressed={showHeatmap}
                onClick={() => setShowHeatmap((v) => !v)}>
          🔥 Peta panas {showHeatmap ? 'hidup' : 'mati'}
        </button>
      </section>

      <Dashboard history={analytics.history} onClear={analytics.clearHistory} />

      <details className="settings">
        <summary>⚙️ Pengaturan</summary>

        <label className="field">
          <span>Garis hitung</span>
          <div className="row">
            <select value={line.orientation} onChange={(e) => setLine({ orientation: e.target.value })}>
              <option value="h">Horizontal (atas→bawah = masuk)</option>
              <option value="v">Vertikal (kiri→kanan = masuk)</option>
            </select>
            <button className="btn btn-small" onClick={() => setLine({ flip: !line.flip })}>⇄ Balik arah</button>
          </div>
        </label>

        <label className="field">
          <span>Posisi garis: {Math.round(line.pos * 100)}%</span>
          <input type="range" min="10" max="90" value={Math.round(line.pos * 100)}
                 onChange={(e) => setLine({ pos: Number(e.target.value) / 100 })} />
        </label>

        <label className="field">
          <span>Sensitivitas deteksi: {Math.round(threshold * 100)}%</span>
          <input type="range" min="10" max="80" value={Math.round(threshold * 100)}
                 onChange={(e) => setThreshold(Number(e.target.value) / 100)} />
        </label>

        <label className="field">
          <span>Kualitas model</span>
          <select value={tier ?? 'fast'} disabled={isModelLoading}
                  onChange={(e) => { stopDetection(); initializeModel(e.target.value); }}>
            <option value="fast">Cepat (lebih ringan)</option>
            <option value="accurate">Akurat (lebih berat)</option>
          </select>
        </label>

        <div className="row">
          <button className="btn btn-small" onClick={() => fileInputRef.current?.click()}>🎞️ Uji dengan video</button>
          {videoFileUrl && <button className="btn btn-small" onClick={handleUseCamera}>📷 Kembali ke kamera</button>}
          <input ref={fileInputRef} type="file" accept="video/*" hidden
                 onChange={(e) => { handleVideoFile(e.target.files?.[0]); e.target.value = ''; }} />
        </div>

        <h3 className="settings-title">🚨 Peringatan kapasitas</h3>

        <div className="field">
          <span>Batas orang: {settings.limit > 0 ? settings.limit : 'mati (0)'}</span>
          <div className="row">
            <button className="btn btn-small" onClick={() => setLimit(settings.limit - 1)}>−</button>
            <input type="number" min="0" max="999" inputMode="numeric" value={settings.limit}
                   onChange={(e) => setLimit(e.target.value)} />
            <button className="btn btn-small" onClick={() => setLimit(settings.limit + 1)}>+</button>
          </div>
        </div>

        <label className="field">
          <span>Dihitung dari</span>
          <select value={settings.metric} onChange={(e) => updateSettings({ metric: e.target.value })}>
            <option value="current">Orang terlihat di kamera</option>
            <option value="inside">Di dalam (masuk − keluar)</option>
          </select>
        </label>

        <label className="check">
          <input type="checkbox" checked={settings.sound}
                 onChange={(e) => updateSettings({ sound: e.target.checked })} />
          Bunyi &amp; getar saat melebihi batas
        </label>

        <div className="field">
          <span>Notifikasi Telegram (opsional)</span>
          <input type="password" autoComplete="off" placeholder="Token bot (dari @BotFather)"
                 value={settings.token} onChange={(e) => updateSettings({ token: e.target.value })} />
          <input type="text" autoComplete="off" placeholder="Chat ID"
                 value={settings.chatId} onChange={(e) => updateSettings({ chatId: e.target.value })} />
          <div className="row">
            <button className="btn btn-small" onClick={handleTestTelegram}>📨 Tes kirim</button>
            {tgStatus && <span className="hint">{tgStatus}</span>}
          </div>
          <p className="hint">
            Dikirim langsung dari perangkat ini ke Telegram; token hanya disimpan di perangkat ini.
            Peringatan menyala bila melewati batas &gt; 3 detik, lalu menunggu 1 menit sebelum berikutnya.
          </p>
        </div>
      </details>

      {error && <div className="error-message">⚠️ {error}</div>}

      <footer className="app-footer">
        Semua proses berjalan di perangkat Anda; video tidak diunggah ke server.
      </footer>
    </div>
  );
}

export default App;
