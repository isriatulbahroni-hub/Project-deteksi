/**
 * Geometri kecil untuk menggambar zona dengan sentuhan: konversi koordinat layar ke koordinat
 * video (dengan memperhitungkan letterbox `object-fit: contain`), luas poligon, dan pembatasan 0..1.
 * Murni logika tanpa DOM supaya mudah diuji.
 */

export const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * Persegi tempat gambar video sebenarnya tampil di dalam kotak elemen saat `object-fit: contain`
 * (sisa ruang di kiri/kanan atau atas/bawah adalah pita hitam).
 * @returns {{x:number,y:number,w:number,h:number}} dalam satuan yang sama dengan boxW/boxH
 */
export function containRect(boxW, boxH, contentW, contentH) {
  if (!(boxW > 0 && boxH > 0 && contentW > 0 && contentH > 0)) return { x: 0, y: 0, w: 0, h: 0 };
  const scale = Math.min(boxW / contentW, boxH / contentH);
  const w = contentW * scale;
  const h = contentH * scale;
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
}

/**
 * Ubah titik sentuh (clientX/clientY) menjadi koordinat video 0..1.
 * @param {{left:number,top:number,width:number,height:number}} rect - getBoundingClientRect() kanvas
 * @param {number} contentW - lebar asli video (videoWidth)
 * @param {number} contentH - tinggi asli video (videoHeight)
 * @returns {{x:number,y:number,inside:boolean,dispW:number,dispH:number}} dispW/dispH = ukuran
 *   gambar video di layar (px CSS); `inside` = titik jatuh di atas gambar, bukan di pita hitam
 */
export function clientToNormalized(clientX, clientY, rect, contentW, contentH) {
  const c = containRect(rect.width, rect.height, contentW, contentH);
  if (!(c.w > 0 && c.h > 0)) return { x: 0, y: 0, inside: false, dispW: 0, dispH: 0 };
  const x = (clientX - rect.left - c.x) / c.w;
  const y = (clientY - rect.top - c.y) / c.h;
  return { x, y, inside: x >= 0 && x <= 1 && y >= 0 && y <= 1, dispW: c.w, dispH: c.h };
}

/** Luas poligon (rumus shoelace) dalam satuan koordinat 0..1 (maksimum 1). */
export function polygonArea(points) {
  let sum = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    sum += points[j][0] * points[i][1] - points[i][0] * points[j][1];
  }
  return Math.abs(sum) / 2;
}
