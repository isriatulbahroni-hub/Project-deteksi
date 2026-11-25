/**
 * Web Worker deteksi bebas: memuat model open-vocabulary (OWL-ViT / OWLv2) lewat transformers.js
 * dan mencari objek berdasarkan kalimat teks. Berjalan di luar thread utama supaya kamera tetap mulus.
 * Model diunduh dari Hugging Face saat pertama dipakai, lalu disimpan cache browser (offline sesudahnya).
 */
import { pipeline, RawImage, env } from '@huggingface/transformers';

env.allowLocalModels = false;

let detector = null;
let loadedModel = null;

const post = (msg) => self.postMessage(msg);

async function init(model) {
  if (detector && loadedModel === model) return post({ type: 'ready', model });
  detector = null;
  loadedModel = null;
  detector = await pipeline('zero-shot-object-detection', model, {
    dtype: 'q8', // versi terkuantisasi: jauh lebih kecil, cocok untuk HP
    progress_callback: (p) => {
      if (p && p.status === 'progress') post({ type: 'progress', file: p.file, progress: p.progress });
    },
  });
  loadedModel = model;
  post({ type: 'ready', model });
}

async function detect({ id, width, height, buffer, prompt, threshold }) {
  if (!detector) throw new Error('Model belum dimuat');
  const image = new RawImage(new Uint8ClampedArray(buffer), width, height, 4).rgb();
  const results = await detector(image, [prompt], { threshold, topk: 100 });
  post({ type: 'result', id, results });
}

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') await init(msg.model);
    else if (msg.type === 'detect') await detect(msg);
  } catch (err) {
    post({ type: 'error', id: msg.id, message: String(err?.message ?? err) });
  }
};
