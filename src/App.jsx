/**
 * Project Deteksi: penghitung orang real-time di browser (khusus tampilan HP).
 */

import { useEffect, useRef, useState } from 'react';
import { useCamera } from './hooks/useCamera';
import { useObjectDetection } from './hooks/useObjectDetection';
import { useAnalytics } from './hooks/useAnalytics';
import { useWakeLock } from './hooks/useWakeLock';
import { useZoneDraw } from './hooks/useZoneDraw';
import { formatDuration } from './utils/analytics';
import { QUICK_PICKS, displayName } from './utils/openVocab';
import { OPEN_MODELS } from './utils/openVocabClient';
import { MAX_EXTRA, PRESETS, TARGETS } from './utils/presets';
import CameraView from './components/CameraView';
import Dashboard from './components/Dashboard';
import LinesZonesPanel from './components/LinesZonesPanel';
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
    fps, getTracks, getHeatmap, stats, line, setLine, resetStats,
    extraLines, addLine, updateLine, removeLine,
    zones, addZone, updateZone, removeZone,
    target, setTarget, tilingMode, setTilingMode, tilingOn, tilingSuspended, applyPreset,
    customQuery, setCustomQuery, openModel, setOpenModel, openStatus, activeThreshold, setActiveThreshold,
    tier, executionProvider, initializeModel, startDetection, stopDetection,
  } = useObjectDetection();

  const draw = useZoneDraw({ zones, addZone, updateZone });

  const analytics = useAnalytics(stats, isDetecting);
  const { settings, updateSettings } = analytics;

  useWakeLock(isDetecting); // layar tetap menyala selama deteksi berjalan

  const [videoFileUrl, setVideoFileUrl] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [tgStatus, setTgStatus] = useState('');
  const fileInputRef = useRef(null);

  const isCustom = target === 'custom';
  const noun = isCustom ? displayName(customQuery) || TARGETS.custom.noun : TARGETS[target].noun;
  const [queryDraft, setQueryDraft] = useState(customQuery);

  const submitQuery = (text) => {
    const q = text ?? queryDraft;
    if (!q.trim()) return;
    setQueryDraft(q);
    setCustomQuery(q);
  };

  const openStatusText = {
    idle: 'Ketik nama objek lalu tekan Hitung.',
    loading: `Mengunduh model deteksi bebas… ${openStatus.percent}% (pertama kali saja, lalu tersimpan)`,
    ready: 'Model deteksi bebas siap.',
    error: `Model gagal dimuat: ${openStatus.error}`,
  }[openStatus.state];

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

  // Mulai menggambar/mengubah zona, lalu bawa video ke tengah layar supaya mudah disentuh
  const startDrawing = (id) => {
    if (id === undefined) draw.startNew();
    else draw.startEdit(id);
    videoRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const handlePreset = (key) => {
    const preset = PRESETS[key];
    draw.cancel(); // preset mengganti semua zona, jadi draf yang sedang digambar dibatalkan
    applyPreset(preset);
    setShowHeatmap(preset.heatmap);
  };

  const setLimit = (n) => updateSettings({ limit: Math.min(999, Math.max(0, Math.round(Number(n)) || 0)) });

  const handleTestTelegram = async () => {
    setTgStatus('Mengirim…');
    const r = await analytics.testTelegram();
    setTgStatus(r.ok ? '✅ Terkirim' : `⚠️ ${r.error}`);
  };

  const error = cameraError || modelError;
  const lineStat = (id) => stats.lines.find((s) => s.id === id) ?? { in: 0, out: 0 };
  const zoneStat = (id) => stats.zones.find((s) => s.id === id) ?? { current: 0, peak: 0, avgSec: 0 };

  return (
    <div className="app">
      <header className="app-header">
        <h1>{TARGETS[target].icon} Penghitung {noun} AI</h1>
        <span className="chip">
          {isModelLoading
            ? 'Memuat model…'
            : model
              ? isCustom
                ? `Bebas · ${OPEN_MODELS[openModel].label}${isDetecting ? ` · ${fps} FPS` : ''}`
                : `${TIER_LABEL[tier] ?? tier} · ${executionProvider}${tilingOn ? ' · Tajam' : ''}${isDetecting ? ` · ${fps} FPS` : ''}`
              : 'Model belum siap'}
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
        extraLines={extraLines}
        zones={zones}
        zoneStats={stats.zones}
        draft={draw.draft}
        onDraftAdd={draw.add}
        onDraftMove={draw.move}
        onDraftSelect={draw.select}
      />

      <section className="open-search" aria-label="Hitung apa saja">
        <div className="open-search-row">
          <input type="text" value={queryDraft} placeholder="Hitung apa saja: pupuk, karung, botol…"
                 maxLength={40} autoComplete="off" enterKeyHint="search"
                 onChange={(e) => setQueryDraft(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && submitQuery()} />
          <button className="btn btn-primary" onClick={() => submitQuery()} disabled={!queryDraft.trim()}>🔍 Hitung</button>
        </div>
        <div className="chips">
          {QUICK_PICKS.map((q) => (
            <button key={q} className={`btn btn-small${isCustom && customQuery === q ? ' btn-on' : ''}`}
                    onClick={() => submitQuery(q)}>{q}</button>
          ))}
        </div>
        {(isCustom || openStatus.state !== 'idle') && <p className="hint">{openStatusText}</p>}
      </section>

      {draw.drawing && (
        <section className="draw-bar" role="group" aria-label="Gambar zona">
          <p className="hint">
            ✏️ {draw.draft.editingId !== null ? 'Ubah bentuk zona' : 'Gambar zona'}: ketuk video untuk menaruh titik,
            seret titik untuk menggeser. Titik: {draw.draft.points.length} (minimal 3)
          </p>
          <div className="draw-bar-actions">
            <button className="btn btn-primary" onClick={draw.finish} disabled={!draw.canFinish}>✔ Selesai</button>
            <button className="btn" onClick={draw.removePoint} disabled={draw.draft.points.length === 0}>⌫ Hapus titik</button>
            <button className="btn" onClick={draw.cancel}>✕ Batal</button>
          </div>
        </section>
      )}

      {analytics.over && (
        <div className="alert-banner" role="alert">
          ⚠️ Melebihi batas: {analytics.value} / {settings.limit}
        </div>
      )}

      <section className="stats">
        <Stat big label={`${noun} terlihat`} value={stats.current} />
        <Stat label="Masuk" value={stats.in} />
        <Stat label="Keluar" value={stats.out} />
        <Stat label="Di dalam (masuk − keluar)" value={Math.max(0, stats.in - stats.out)} />
        <Stat label="Puncak" value={stats.peak} />
        <Stat label="Total unik" value={stats.unique} />
        <Stat label="Lama terlihat (rata-rata)" value={formatDuration(stats.dwellSec)} />
        {extraLines.map((l) => (
          <Stat key={l.id} label={`${l.name} (masuk / keluar)`} value={`${lineStat(l.id).in} / ${lineStat(l.id).out}`} />
        ))}
        {zones.map((z) => (
          <Stat key={z.id} label={`${z.name} (sekarang · puncak)`} value={`${zoneStat(z.id).current} · ${zoneStat(z.id).peak}`} />
        ))}
        {zones.map((z) => (
          <Stat key={`d${z.id}`} label={`${z.name} (rata-rata di dalam)`} value={formatDuration(zoneStat(z.id).avgSec)} />
        ))}
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
        {Object.entries(PRESETS).map(([key, preset]) => (
          <button key={key} className="btn btn-small" onClick={() => handlePreset(key)}>{preset.label}</button>
        ))}
      </section>

      <section className="toggles">
        <button className={`btn btn-small${showHeatmap ? ' btn-on' : ''}`} aria-pressed={showHeatmap}
                onClick={() => setShowHeatmap((v) => !v)}>
          🔥 Peta panas {showHeatmap ? 'hidup' : 'mati'}
        </button>
        <button className="btn btn-small" disabled={draw.drawing || zones.length >= MAX_EXTRA}
                onClick={() => startDrawing()}>
          📍 Gambar zona
        </button>
      </section>

      <Dashboard history={analytics.history} onClear={analytics.clearHistory} />

      <details className="settings">
        <summary>⚙️ Pengaturan</summary>

        <label className="field">
          <span>Objek yang dihitung</span>
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            {Object.entries(TARGETS).map(([key, t]) => (
              <option key={key} value={key}>{t.icon} {t.noun}</option>
            ))}
          </select>
        </label>

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

        <LinesZonesPanel
          extraLines={extraLines} zones={zones}
          onAddLine={addLine} onUpdateLine={updateLine} onRemoveLine={removeLine}
          onDrawZone={() => startDrawing()} onEditZone={startDrawing} onRemoveZone={removeZone}
          drawing={draw.drawing}
        />

        <label className="field">
          <span>Sensitivitas deteksi: {Math.round(activeThreshold * 100)}%</span>
          <input type="range" min="5" max="80" value={Math.round(activeThreshold * 100)}
                 onChange={(e) => setActiveThreshold(Number(e.target.value) / 100)} />
        </label>

        <label className="field">
          <span>Model deteksi bebas</span>
          <select value={openModel} onChange={(e) => { stopDetection(); setOpenModel(e.target.value); }}>
            {Object.entries(OPEN_MODELS).map(([key, m]) => (
              <option key={key} value={key}>{m.label}</option>
            ))}
          </select>
          <p className="hint">
            Dipakai saat kamu mengetik nama objek. Cepat ≈ 150 MB, Akurat ≈ 155 MB tapi jauh lebih lambat per gambar.
            Diunduh sekali, lalu tersimpan di perangkat. Skor model bebas lebih rendah, jadi sensitivitas bawaannya 15%.
          </p>
        </label>

        <label className="field">
          <span>Kualitas model</span>
          <select value={tier ?? 'fast'} disabled={isModelLoading}
                  onChange={(e) => { stopDetection(); initializeModel(e.target.value); }}>
            <option value="fast">Cepat (lebih ringan)</option>
            <option value="accurate">Akurat (lebih berat)</option>
          </select>
        </label>

        <label className="field">
          <span>Mode tajam (video potret){tilingOn ? ' — aktif' : ''}</span>
          <select value={tilingMode} onChange={(e) => setTilingMode(e.target.value)}>
            <option value="auto">Otomatis (sesuai kecepatan HP)</option>
            <option value="on">Selalu tajam (lebih berat)</option>
            <option value="off">Standar</option>
          </select>
          <p className="hint">
            Memotong video potret jadi bagian-bagian agar orang yang jauh/kecil lebih mudah terdeteksi.
            Memakai 3× komputasi.{tilingSuspended ? ' Dimatikan sementara karena FPS terlalu rendah.' : ''}
          </p>
        </label>

        <div className="row">
          <button className="btn btn-small" onClick={() => fileInputRef.current?.click()}>🎞️ Uji dengan video</button>
          {videoFileUrl && <button className="btn btn-small" onClick={handleUseCamera}>📷 Kembali ke kamera</button>}
          <input ref={fileInputRef} type="file" accept="video/*" hidden
                 onChange={(e) => { handleVideoFile(e.target.files?.[0]); e.target.value = ''; }} />
        </div>

        <h3 className="settings-title">🚨 Peringatan kapasitas</h3>

        <div className="field">
          <span>Batas jumlah: {settings.limit > 0 ? settings.limit : 'mati (0)'}</span>
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
            <option value="current">{noun} terlihat di kamera</option>
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
