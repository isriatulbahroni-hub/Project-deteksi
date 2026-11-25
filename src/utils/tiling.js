/**
 * Mode tajam untuk video potret: frame dipotong jadi dua bagian (atas dan bawah) yang saling
 * tumpang tindih, masing-masing dideteksi sendiri, lalu digabung dengan hasil frame penuh.
 * Model hanya menerima input lanskap 640x384, jadi tanpa ini video potret diperkecil banyak
 * dan orang yang jauh/kecil terlewat. Murni logika tanpa DOM supaya mudah diuji.
 */

import { calculateIoU } from './postprocessing.js';

/**
 * Rencana potongan untuk frame `width` x `height`. Null bila frame tidak cukup "tinggi"
 * (lanskap atau hampir persegi): cukup satu kali deteksi biasa.
 */
export function planTiles(width, height, { minAspect = 1.25, tileFraction = 0.7 } = {}) {
  if (!width || !height || height / width < minAspect) return null;
  const tileHeight = Math.round(height * tileFraction);
  return [
    { x: 0, y: 0, width, height: tileHeight },
    { x: 0, y: height - tileHeight, width, height: tileHeight },
  ];
}

/**
 * Geser deteksi dari koordinat potongan ke koordinat frame penuh, dan tandai (`cut`) kotak yang
 * menempel pada tepi dalam potongan karena kemungkinan besar orangnya terpotong di situ.
 */
export function placeTileDetections(dets, crop, frameHeight, margin = 0.02) {
  const m = crop.height * margin;
  return dets.map((d) => ({
    ...d,
    cut: (crop.y > 0 && d.y <= m) || (crop.y + crop.height < frameHeight && d.y + d.height >= crop.height - m),
    x: d.x + crop.x,
    y: d.y + crop.y,
  }));
}

// Bagian luas `candidate` yang tertutup oleh `other` (0..1).
function coverage(candidate, other) {
  const x1 = Math.max(candidate.x, other.x);
  const y1 = Math.max(candidate.y, other.y);
  const x2 = Math.min(candidate.x + candidate.width, other.x + other.width);
  const y2 = Math.min(candidate.y + candidate.height, other.y + other.height);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const area = candidate.width * candidate.height;
  return area > 0 ? inter / area : 0;
}

/**
 * Gabungkan daftar deteksi dari beberapa lintasan (daftar pertama = frame penuh, diprioritaskan).
 * Kotak dari lintasan berikutnya dibuang bila kelas sama dan (a) IoU-nya tinggi dengan kotak yang
 * sudah ada, atau (b) ia terpotong di tepi potongan dan sebagian besar sudah tercakup kotak lain.
 */
export function mergeDetections(lists, { iou = 0.45, contain = 0.8 } = {}) {
  const kept = [...(lists[0] ?? [])];
  for (let i = 1; i < lists.length; i++) {
    for (const d of lists[i]) {
      const duplicate = kept.some((k) =>
        k.classId === d.classId && (calculateIoU(k, d) > iou || (d.cut && coverage(d, k) > contain)));
      if (!duplicate) kept.push(d);
    }
  }
  return kept.sort((a, b) => b.confidence - a.confidence);
}
