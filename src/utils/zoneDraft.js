/**
 * Keadaan sementara saat menggambar zona poligon: daftar titik (koordinat video 0..1) dan titik
 * yang sedang dipilih. Semua fungsi murni (mengembalikan objek baru) supaya mudah diuji.
 */

import { clamp01, polygonArea } from './geometry.js';

/** Zona minimal punya 3 titik dan luas yang masuk akal (bukan garis lurus). */
export const MIN_POINTS = 3;
export const MIN_AREA = 0.002;

const clampPoint = ([x, y]) => [clamp01(x), clamp01(y)];

export const emptyDraft = (points = []) => ({ points, selected: -1 });

/** Tambah titik di akhir dan pilih titik itu (supaya bisa langsung digeser). */
export function addPoint(draft, point) {
  return { ...draft, points: [...draft.points, clampPoint(point)], selected: draft.points.length };
}

export function movePoint(draft, index, point) {
  if (index < 0 || index >= draft.points.length) return draft;
  return { ...draft, points: draft.points.map((p, i) => (i === index ? clampPoint(point) : p)) };
}

export function selectPoint(draft, index) {
  return index >= 0 && index < draft.points.length ? { ...draft, selected: index } : { ...draft, selected: -1 };
}

/** Hapus titik terpilih; bila tidak ada yang dipilih, hapus titik terakhir. */
export function removeSelected(draft) {
  const n = draft.points.length;
  if (n === 0) return draft;
  const index = draft.selected >= 0 && draft.selected < n ? draft.selected : n - 1;
  return { ...draft, points: draft.points.filter((_, i) => i !== index), selected: -1 };
}

export const canFinish = (draft) => draft.points.length >= MIN_POINTS && polygonArea(draft.points) >= MIN_AREA;

/**
 * Titik terdekat yang masih dalam jangkauan sentuh, atau -1.
 * @param {number[]} point - [x, y] 0..1
 * @param {number} radiusPx - jangkauan dalam piksel layar
 * @param {{w:number,h:number}} display - ukuran gambar video di layar (px), untuk mengubah 0..1 ke piksel
 */
export function findHandle(points, point, radiusPx, { w, h }) {
  let best = -1;
  let bestDist = radiusPx;
  points.forEach((p, i) => {
    const d = Math.hypot((p[0] - point[0]) * w, (p[1] - point[1]) * h);
    if (d <= bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best;
}
