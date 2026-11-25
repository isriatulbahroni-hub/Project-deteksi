/**
 * Penghubung ke worker deteksi bebas. Satu permintaan deteksi dalam satu waktu.
 */
import { mapResults, cleanDetections } from './openVocab.js';

/** Model yang tersedia. `side` = sisi terpanjang gambar yang dikirim ke model (piksel). */
export const OPEN_MODELS = {
  fast: { label: 'Cepat', id: 'Xenova/owlvit-base-patch32', side: 640 },
  accurate: { label: 'Akurat (lebih berat)', id: 'Xenova/owlv2-base-patch16-ensemble', side: 960 },
};

export function createOpenVocab() {
  const worker = new Worker(new URL('../workers/openvocab.worker.js', import.meta.url), { type: 'module' });
  const pending = new Map(); // id -> { resolve, reject }
  let nextId = 1;
  let readyWaiter = null;
  let onProgress = null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'progress') onProgress?.(m);
    else if (m.type === 'ready') readyWaiter?.resolve(m);
    else if (m.type === 'result') {
      pending.get(m.id)?.resolve(m.results);
      pending.delete(m.id);
    }
    else if (m.type === 'error') {
      if (m.id !== undefined && pending.has(m.id)) {
        pending.get(m.id).reject(new Error(m.message));
        pending.delete(m.id);
      } else readyWaiter?.reject(new Error(m.message));
    }
  };
  worker.onerror = (e) => readyWaiter?.reject(new Error(e.message || 'Worker gagal'));

  return {
    /** Muat model (unduh pertama kali bisa lama). `progress` dipanggil dengan { file, progress }. */
    load(modelKey, progress) {
      onProgress = progress ?? null;
      return new Promise((resolve, reject) => {
        readyWaiter = { resolve, reject };
        worker.postMessage({ type: 'init', model: OPEN_MODELS[modelKey].id });
      });
    },

    /** Cari objek di satu frame video; hasil dalam piksel video, siap masuk ke pelacak. */
    async detect(video, { prompt, label, threshold, modelKey }) {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh || !prompt) return [];
      const side = OPEN_MODELS[modelKey]?.side ?? 640;
      const k = Math.min(1, side / Math.max(vw, vh));
      const w = Math.round(vw * k);
      const h = Math.round(vh * k);
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(video, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      const id = nextId++;
      const results = await new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        const buffer = data.buffer.slice(0); // salinan, supaya aman dipindahkan ke worker
        worker.postMessage({ type: 'detect', id, width: w, height: h, buffer, prompt, threshold }, [buffer]);
      });
      const dets = mapResults(results, { scale: vw / w, label, threshold });
      return cleanDetections(dets, { frameArea: vw * vh });
    },

    dispose() {
      worker.terminate();
      pending.clear();
    },
  };
}
