/**
 * Project Deteksi: penghitung orang real-time di browser (khusus tampilan HP).
 */

import { useEffect, useRef, useState } from 'react';
import { useCamera } from './hooks/useCamera';
import { useObjectDetection } from './hooks/useObjectDetection';
import CameraView from './components/CameraView';
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
    fps, getTracks, stats, line, setLine, resetStats, threshold, setThreshold,
    tier, executionProvider, initializeModel, startDetection, stopDetection,
  } = useObjectDetection();

  const [videoFileUrl, setVideoFileUrl] = useState(null);
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
        isDetecting={isDetecting}
        line={line}
      />

      <section className="stats">
        <Stat big label="Orang terlihat" value={stats.current} />
        <Stat label="Masuk" value={stats.in} />
        <Stat label="Keluar" value={stats.out} />
        <Stat label="Puncak" value={stats.peak} />
        <Stat label="Total unik" value={stats.unique} />
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
      </details>

      {error && <div className="error-message">⚠️ {error}</div>}

      <footer className="app-footer">
        Semua proses berjalan di perangkat Anda; video tidak diunggah ke server.
      </footer>
    </div>
  );
}

export default App;
