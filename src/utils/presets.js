/**
 * Pilihan objek yang dihitung, skenario siap pakai, label bahasa Indonesia, dan ambang mode tajam.
 * Kelas mengikuti label COCO yang dipakai model.
 */

import { rectPolygon } from './zones.js';

export const TARGETS = {
  person: { icon: '👥', noun: 'Orang', classes: new Set(['person']) },
  vehicle: { icon: '🚗', noun: 'Kendaraan', classes: new Set(['bicycle', 'motorcycle', 'car', 'bus', 'truck']) },
  custom: { icon: '🔍', noun: 'Objek bebas', classes: new Set() }, // diisi dari kata yang diketik pengguna
  animal: {
    icon: '🐾',
    noun: 'Hewan',
    classes: new Set(['bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe']),
  },
};

const CLASS_NAMES_ID = {
  person: 'Orang', bicycle: 'Sepeda', motorcycle: 'Motor', car: 'Mobil', bus: 'Bus', truck: 'Truk',
  bird: 'Burung', cat: 'Kucing', dog: 'Anjing', horse: 'Kuda', sheep: 'Domba', cow: 'Sapi',
  elephant: 'Gajah', bear: 'Beruang', zebra: 'Zebra', giraffe: 'Jerapah',
};

export const labelFor = (className) => CLASS_NAMES_ID[className] ?? className;

/** Skenario siap pakai: hanya kombinasi pengaturan (objek, garis, zona poligon, sensitivitas, peta panas). */
export const PRESETS = {
  gate: {
    label: '🚪 Pintu masuk',
    target: 'person',
    threshold: 0.25,
    heatmap: false,
    line: { orientation: 'h', pos: 0.5, flip: false },
    extraLines: [],
    zones: [],
  },
  queue: {
    label: '🧍 Antrean',
    target: 'person',
    threshold: 0.25,
    heatmap: false,
    line: { orientation: 'h', pos: 0.5, flip: false },
    extraLines: [],
    zones: [{ name: 'Area antrean', points: rectPolygon(0.1, 0.2, 0.8, 0.7) }],
  },
  crowd: {
    label: '🏟️ Area ramai',
    target: 'person',
    threshold: 0.2,
    heatmap: true,
    line: { orientation: 'h', pos: 0.5, flip: false },
    extraLines: [],
    zones: [{ name: 'Seluruh area', points: rectPolygon(0.02, 0.02, 0.96, 0.96) }],
  },
  traffic: {
    label: '🚗 Lalu lintas',
    target: 'vehicle',
    threshold: 0.3,
    heatmap: false,
    line: { orientation: 'h', pos: 0.6, flip: false },
    extraLines: [],
    zones: [],
  },
};

/** Mode tajam otomatis menyala bila satu kali deteksi di perangkat ini lebih cepat dari ini (ms). */
export const TILING_AUTO_MS = 22;
/** Bila FPS di bawah ini selama 3 detik berturut-turut, mode tajam dimatikan sementara. */
export const MIN_TILE_FPS = 7;
/** Jumlah maksimum garis tambahan dan zona. */
export const MAX_EXTRA = 4;
