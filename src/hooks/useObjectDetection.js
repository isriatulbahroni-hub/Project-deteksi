/**
 * Custom hook for object detection + tracking using ONNX Runtime
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { loadModel, releaseModel, runInference, warmupModel } from '../utils/modelLoader';
import { preprocessImage } from '../utils/preprocessing';
import { processOutput, scaleDetections } from '../utils/postprocessing';
import { createTracker } from '../utils/tracker';
import { createCounter, DEFAULT_LINE } from '../utils/counter';
import { createLineSet } from '../utils/lines';
import { createZoneTracker, rectPolygon } from '../utils/zones';
import { planTiles, placeTileDetections, mergeDetections } from '../utils/tiling';
import { createHeatmap } from '../utils/heatmap';
import { createDwell } from '../utils/dwell';
import { loadJson, saveJson } from '../utils/storage';
import { MODEL_CONFIG, MODELS, COCO_CLASSES } from '../utils/constants';
import { TARGETS, TILING_AUTO_MS, MIN_TILE_FPS, MAX_EXTRA } from '../utils/presets';

const inputShape = (cfg) => [1, 3, cfg.inputHeight, cfg.inputWidth];

const EMPTY_STATS = { current: 0, in: 0, out: 0, peak: 0, unique: 0, dwellSec: 0, lines: [], zones: [] };

const CONFIG_KEY = 'deteksi:config:v1';

// --- Pengaturan yang disimpan di perangkat (garis, zona, objek, sensitivitas, mode tajam) ---
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi, fallback) => (isNum(v) ? Math.min(hi, Math.max(lo, v)) : fallback);
const validLine = (l) => !!l && isNum(l.id) && (l.orientation === 'h' || l.orientation === 'v') && isNum(l.pos);
const validZone = (z) => !!z && isNum(z.id) && [z.x, z.y, z.w, z.h].every(isNum);
const cleanLine = (l) => ({
  id: l.id,
  name: String(l.name ?? `Garis ${l.id}`),
  orientation: l.orientation,
  pos: clamp(l.pos, 0.05, 0.95, 0.5),
  flip: !!l.flip,
});
const cleanZone = (z) => {
  const x = clamp(z.x, 0, 0.9, 0.1);
  const y = clamp(z.y, 0, 0.9, 0.1);
  return {
    id: z.id,
    name: String(z.name ?? `Zona ${z.id}`),
    x,
    y,
    w: clamp(z.w, 0.05, 1 - x, 0.5),
    h: clamp(z.h, 0.05, 1 - y, 0.5),
  };
};

function readConfig() {
  const c = loadJson(CONFIG_KEY, {}) ?? {};
  const line = validLine({ id: 0, ...c.line })
    ? { orientation: c.line.orientation, pos: clamp(c.line.pos, 0.05, 0.95, 0.5), flip: !!c.line.flip }
    : DEFAULT_LINE;
  const extraLines = (Array.isArray(c.extraLines) ? c.extraLines : []).filter(validLine).slice(0, MAX_EXTRA).map(cleanLine);
  const zones = (Array.isArray(c.zones) ? c.zones : []).filter(validZone).slice(0, MAX_EXTRA).map(cleanZone);
  return {
    line,
    extraLines,
    zones,
    target: TARGETS[c.target] ? c.target : 'person',
    threshold: clamp(c.threshold, 0.1, 0.8, MODEL_CONFIG.confidenceThreshold),
    tilingMode: ['auto', 'on', 'off'].includes(c.tilingMode) ? c.tilingMode : 'auto',
    nextId: 1 + Math.max(0, ...extraLines.map((l) => l.id), ...zones.map((z) => z.id)),
  };
}

function uniqueName(prefix, list, start) {
  const used = new Set(list.map((item) => item.name));
  let n = start;
  while (used.has(`${prefix} ${n}`)) n++;
  return `${prefix} ${n}`;
}

const toPolygons = (zones) => zones.map((z) => ({ id: z.id, points: rectPolygon(z.x, z.y, z.w, z.h) }));

async function loadLabels(path) {
  if (!path) return COCO_CLASSES;
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  return res.json();
}

/** Load a tier, compile its GPU shaders, and measure its average inference time on this device. */
async function loadTier(tier) {
  const cfg = MODELS[tier];
  const [{ session, provider }, labels] = await Promise.all([loadModel(cfg.path), loadLabels(cfg.labelsPath)]);
  await warmupModel(session, inputShape(cfg)); // first run compiles shaders; not representative
  const zeros = new Float32Array(3 * cfg.inputWidth * cfg.inputHeight);
  const t0 = performance.now();
  for (let i = 0; i < 3; i++) await runInference(session, zeros, inputShape(cfg));
  return { session, provider, cfg, tier, labels, ms: (performance.now() - t0) / 3 };
}

/** Satu lintasan deteksi pada seluruh frame atau satu potongan (`crop`), hasil dalam piksel frame. */
async function detectPass(video, crop, { session, cfg, labels }) {
  const { tensor, scale, offsetX, offsetY } = preprocessImage(video, cfg.inputWidth, cfg.inputHeight, crop);
  const output = await runInference(session, tensor, inputShape(cfg));
  const raw = processOutput(
    output,
    MODEL_CONFIG.lowConfidenceThreshold,
    MODEL_CONFIG.iouThreshold,
    labels,
    MODEL_CONFIG.maxDetections
  );
  const w = crop ? crop.width : video.videoWidth;
  const h = crop ? crop.height : video.videoHeight;
  return scaleDetections(raw, scale, offsetX, offsetY, w, h);
}

export function useObjectDetection() {
  const [initial] = useState(readConfig);
  const [model, setModel] = useState(null); // { session, provider, cfg, tier, labels, ms }
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [fps, setFps] = useState(0);
  const [detectionCount, setDetectionCount] = useState(0);
  const [threshold, setThresholdState] = useState(initial.threshold);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [line, setLineState] = useState(initial.line);
  const [extraLines, setExtraLines] = useState(initial.extraLines);
  const [zones, setZones] = useState(initial.zones);
  const [target, setTargetState] = useState(initial.target);
  const [tilingMode, setTilingModeState] = useState(initial.tilingMode);
  const [tilingSuspended, setTilingSuspended] = useState(false); // mode tajam dimatikan karena FPS rendah

  // Incremented on every start/stop; a loop iteration exits if its id is stale.
  const loopIdRef = useRef(0);
  const trackerRef = useRef(null);
  const modelRef = useRef(null); // current model, so the previous one can be released exactly once
  const thresholdRef = useRef(initial.threshold); // read by the running loop without restarting it
  const counterRef = useRef(createCounter());
  const lineSetRef = useRef(createLineSet()); // garis hitung tambahan
  const zoneTrackerRef = useRef(createZoneTracker());
  const heatmapRef = useRef(createHeatmap()); // peta panas posisi kaki, dibaca kanvas tiap frame
  const dwellRef = useRef(createDwell()); // lama tiap orang terlihat
  const lineRef = useRef(initial.line); // garis masuk/keluar utama, dibaca loop tanpa restart
  const extraLinesRef = useRef(initial.extraLines);
  const zonesRef = useRef(initial.zones);
  const targetRef = useRef(TARGETS[initial.target].classes); // kelas objek yang dihitung
  const nextIdRef = useRef(initial.nextId);
  const tilingActiveRef = useRef(false);

  // Mode tajam: otomatis menyala di perangkat yang cukup cepat, atau dipaksa pengguna.
  const tilingOn = !tilingSuspended && (tilingMode === 'on' || (tilingMode === 'auto' && !!model && model.ms < TILING_AUTO_MS));
  useEffect(() => {
    tilingActiveRef.current = tilingOn;
  }, [tilingOn]);

  // Simpan pengaturan di perangkat supaya tidak hilang saat halaman dibuka lagi
  useEffect(() => {
    saveJson(CONFIG_KEY, { line, extraLines, zones, target, threshold, tilingMode });
  }, [line, extraLines, zones, target, threshold, tilingMode]);

  const setLine = useCallback((patch) => {
    lineRef.current = { ...lineRef.current, ...patch };
    setLineState(lineRef.current);
  }, []);

  const commitExtraLines = useCallback((next) => {
    extraLinesRef.current = next;
    setExtraLines(next);
  }, []);

  const commitZones = useCallback((next) => {
    zonesRef.current = next;
    setZones(next);
  }, []);

  const addLine = useCallback(() => {
    const list = extraLinesRef.current;
    if (list.length >= MAX_EXTRA) return;
    commitExtraLines([
      ...list,
      { id: nextIdRef.current++, name: uniqueName('Garis', list, list.length + 2), orientation: 'v', pos: 0.5, flip: false },
    ]);
  }, [commitExtraLines]);

  const updateLine = useCallback((id, patch) => {
    commitExtraLines(extraLinesRef.current.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, [commitExtraLines]);

  const removeLine = useCallback((id) => {
    commitExtraLines(extraLinesRef.current.filter((l) => l.id !== id));
  }, [commitExtraLines]);

  const addZone = useCallback(() => {
    const list = zonesRef.current;
    if (list.length >= MAX_EXTRA) return;
    commitZones([
      ...list,
      { id: nextIdRef.current++, name: uniqueName('Zona', list, list.length + 1), x: 0.15, y: 0.25, w: 0.7, h: 0.6 },
    ]);
  }, [commitZones]);

  const updateZone = useCallback((id, patch) => {
    commitZones(zonesRef.current.map((z) => {
      if (z.id !== id) return z;
      const n = { ...z, ...patch };
      n.w = Math.min(1, Math.max(0.05, n.w));
      n.h = Math.min(1, Math.max(0.05, n.h));
      n.x = Math.min(1 - n.w, Math.max(0, n.x));
      n.y = Math.min(1 - n.h, Math.max(0, n.y));
      return n;
    }));
  }, [commitZones]);

  const removeZone = useCallback((id) => {
    commitZones(zonesRef.current.filter((z) => z.id !== id));
  }, [commitZones]);

  const resetStats = useCallback(() => {
    counterRef.current.reset();
    lineSetRef.current.reset();
    zoneTrackerRef.current.reset();
    heatmapRef.current.reset();
    dwellRef.current.reset();
    setStats(EMPTY_STATS);
  }, []);

  const setThreshold = useCallback((value) => {
    thresholdRef.current = value;
    setThresholdState(value);
  }, []);

  // Ganti objek yang dihitung (orang / kendaraan / hewan); hitungan lama tidak relevan lagi
  const setTarget = useCallback((key) => {
    if (!TARGETS[key]) return;
    targetRef.current = TARGETS[key].classes;
    setTargetState(key);
    resetStats();
  }, [resetStats]);

  const setTilingMode = useCallback((mode) => {
    setTilingModeState(mode);
    setTilingSuspended(false);
  }, []);

  // Terapkan skenario siap pakai (objek, garis, zona, sensitivitas); hitungan dimulai dari nol
  const applyPreset = useCallback((preset) => {
    lineRef.current = { ...preset.line };
    setLineState(lineRef.current);
    commitExtraLines(preset.extraLines.map((l, i) => ({ name: `Garis ${i + 2}`, ...l, id: nextIdRef.current++ })));
    commitZones(preset.zones.map((z) => ({ ...z, id: nextIdRef.current++ })));
    targetRef.current = TARGETS[preset.target].classes;
    setTargetState(preset.target);
    thresholdRef.current = preset.threshold;
    setThresholdState(preset.threshold);
    resetStats();
  }, [commitExtraLines, commitZones, resetStats]);

  // Boxes extrapolated to `now`; the canvas calls this every display frame (no React re-render).
  // Hanya objek yang dipilih yang ditampilkan dan dihitung.
  const getTracks = useCallback(
    (now) => (trackerRef.current?.predict(now) ?? []).filter((t) => targetRef.current.has(t.className)),
    []
  );

  // Grid peta panas saat ini ({ cols, rows, data, max }); dipanggil kanvas tiap frame.
  const getHeatmap = useCallback(() => heatmapRef.current.grid(), []);

  /**
   * Load a model tier. Without a tier: load Fast, and switch to Accurate if this device runs Fast
   * quickly enough that Accurate will still be real-time.
   */
  const initializeModel = useCallback(async (tier) => {
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await loadTier(tier ?? 'fast');
      let chosen = loaded;
      if (!tier && loaded.ms < MODEL_CONFIG.autoUpgradeMs) {
        chosen = await loadTier('accurate');
        releaseModel(loaded.session);
      }
      console.log(`✓ Using ${chosen.cfg.label} model (${chosen.ms.toFixed(0)} ms/frame on ${chosen.provider})`);
      const old = modelRef.current;
      modelRef.current = chosen;
      setModel(chosen);
      setTilingSuspended(false);
      if (old) releaseModel(old.session); // queued after any frame still inferring on it
    } catch (err) {
      console.error('Failed to initialize model:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Run detection on a single frame (returns untracked, scaled detections).
  // Video potret dengan mode tajam: frame penuh + dua potongan, lalu digabung.
  const detectObjects = useCallback(async (videoElement) => {
    if (!model || !videoElement?.videoWidth || !videoElement.videoHeight) return [];

    try {
      const full = await detectPass(videoElement, null, model);
      const tiles = tilingActiveRef.current ? planTiles(videoElement.videoWidth, videoElement.videoHeight) : null;
      if (!tiles) return full;

      const lists = [full];
      for (const crop of tiles) {
        const dets = await detectPass(videoElement, crop, model);
        lists.push(placeTileDetections(dets, crop, videoElement.videoHeight));
      }
      return mergeDetections(lists, { iou: MODEL_CONFIG.iouThreshold });
    } catch (err) {
      console.error('Detection error:', err);
      return [];
    }
  }, [model]);

  const startDetection = useCallback((videoElement) => {
    if (!model || !videoElement) return;

    const loopId = ++loopIdRef.current;
    const tracker = createTracker();
    counterRef.current.newSession();
    lineSetRef.current.newSession();
    zoneTrackerRef.current.newSession();
    dwellRef.current.newSession();
    trackerRef.current = tracker;
    setTilingSuspended(false);
    let frames = 0;
    let lowFpsSeconds = 0;
    let lastTime = performance.now();
    // requestVideoFrameCallback fires once per new video frame, so no frame is processed twice.
    const nextFrame = videoElement.requestVideoFrameCallback
      ? (cb) => videoElement.requestVideoFrameCallback(cb)
      : (cb) => requestAnimationFrame(cb);

    setIsRunning(true);

    const detectLoop = async () => {
      if (loopIdRef.current !== loopId) return;

      const dets = await detectObjects(videoElement);
      if (loopIdRef.current !== loopId) return; // stopped while inferring
      const now = performance.now();
      const visible = tracker.update(dets, now, thresholdRef.current);
      const people = visible.filter((t) => targetRef.current.has(t.className));
      const dims = { width: videoElement.videoWidth, height: videoElement.videoHeight };
      const counter = counterRef.current;
      const before = counter.snapshot();
      counter.update(people, dims, lineRef.current);
      lineSetRef.current.update(people, dims, extraLinesRef.current);
      zoneTrackerRef.current.update(people, dims, toPolygons(zonesRef.current), now);
      heatmapRef.current.add(people, dims);
      dwellRef.current.update(people, now);
      const after = counter.snapshot();
      const crossed = after.in !== before.in || after.out !== before.out;

      frames++;
      if (crossed || now - lastTime >= 1000) {
        setStats({
          current: people.length,
          ...after,
          dwellSec: dwellRef.current.snapshot().avgSec,
          lines: lineSetRef.current.snapshot(extraLinesRef.current),
          zones: zoneTrackerRef.current.snapshot(toPolygons(zonesRef.current), now),
        });
      }
      if (now - lastTime >= 1000) {
        const fpsNow = Math.round((frames * 1000) / (now - lastTime));
        setFps(fpsNow);
        setDetectionCount(people.length);
        // Mode tajam memakai 3x inferensi: matikan sementara bila perangkat tidak sanggup
        if (tilingActiveRef.current && fpsNow < MIN_TILE_FPS) {
          if (++lowFpsSeconds >= 3) {
            setTilingSuspended(true);
            lowFpsSeconds = 0;
          }
        } else {
          lowFpsSeconds = 0;
        }
        frames = 0;
        lastTime = now;
      }

      nextFrame(detectLoop);
    };

    detectLoop();
  }, [model, detectObjects]);

  const stopDetection = useCallback(() => {
    loopIdRef.current++;
    trackerRef.current = null;
    setIsRunning(false);
    setDetectionCount(0);
    setFps(0);
    setStats((s) => ({ ...s, current: 0 }));
  }, []);

  // Stop the loop on unmount
  useEffect(() => () => { loopIdRef.current++; }, []);

  return {
    model,
    isLoading,
    error,
    isRunning,
    fps,
    detectionCount,
    getTracks,
    getHeatmap,
    stats,
    line,
    setLine,
    extraLines,
    addLine,
    updateLine,
    removeLine,
    zones,
    addZone,
    updateZone,
    removeZone,
    target,
    setTarget,
    tilingMode,
    setTilingMode,
    tilingOn,
    tilingSuspended,
    applyPreset,
    resetStats,
    threshold,
    setThreshold,
    executionProvider: model?.provider ?? 'wasm',
    tier: model?.tier ?? null,
    initializeModel,
    detectObjects,
    startDetection,
    stopDetection,
  };
}
