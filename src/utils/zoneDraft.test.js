import test from 'node:test';
import assert from 'node:assert/strict';
import { clientToNormalized, containRect, polygonArea } from './geometry.js';
import { addPoint, canFinish, emptyDraft, findHandle, movePoint, removeSelected, selectPoint } from './zoneDraft.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('containRect: video lebar di kotak tinggi diberi pita atas-bawah', () => {
  // kotak 400x800, video 1600x900 -> lebar penuh 400, tinggi 225, sisa 575 dibagi dua
  const r = containRect(400, 800, 1600, 900);
  assert.deepEqual([r.x, r.w, r.h], [0, 400, 225]);
  close(r.y, 287.5);
});

test('containRect: video potret di kotak lebar diberi pita kiri-kanan', () => {
  const r = containRect(800, 400, 900, 1600); // skala = 400/1600 = 0.25 -> 225x400
  assert.deepEqual([r.y, r.w, r.h], [0, 225, 400]);
  close(r.x, 287.5);
});

test('clientToNormalized memperhitungkan posisi kotak di halaman dan letterbox', () => {
  const rect = { left: 10, top: 100, width: 400, height: 800 };
  // video 1600x900 tampil di y 287.5..512.5 (relatif kotak)
  const centre = clientToNormalized(10 + 200, 100 + 400, rect, 1600, 900);
  close(centre.x, 0.5);
  close(centre.y, 0.5);
  assert.equal(centre.inside, true);
  close(centre.dispW, 400);
  close(centre.dispH, 225);
  const topLeft = clientToNormalized(10, 100 + 287.5, rect, 1600, 900);
  close(topLeft.x, 0);
  close(topLeft.y, 0);
  // di pita hitam di atas gambar: y negatif dan bukan "inside"
  const bar = clientToNormalized(10 + 200, 100 + 100, rect, 1600, 900);
  assert.equal(bar.inside, false);
  assert.ok(bar.y < 0);
});

test('clientToNormalized aman bila ukuran video belum diketahui', () => {
  const g = clientToNormalized(5, 5, { left: 0, top: 0, width: 100, height: 100 }, 0, 0);
  assert.equal(g.inside, false);
  assert.equal(g.dispW, 0);
});

test('polygonArea: persegi 0.5x0.5 = 0.25, garis lurus = 0', () => {
  close(polygonArea([[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]]), 0.25);
  close(polygonArea([[0.1, 0.1], [0.5, 0.5], [0.9, 0.9]]), 0);
});

test('menambah titik memilih titik baru dan membatasi ke 0..1', () => {
  let d = emptyDraft();
  d = addPoint(d, [0.2, 0.3]);
  d = addPoint(d, [1.4, -0.2]);
  assert.deepEqual(d.points, [[0.2, 0.3], [1, 0]]);
  assert.equal(d.selected, 1);
});

test('menggeser titik hanya mengubah titik itu dan tetap di dalam 0..1', () => {
  let d = emptyDraft([[0.1, 0.1], [0.9, 0.1], [0.5, 0.9]]);
  d = movePoint(d, 2, [0.6, 1.5]);
  assert.deepEqual(d.points, [[0.1, 0.1], [0.9, 0.1], [0.6, 1]]);
  assert.equal(movePoint(d, 7, [0, 0]), d, 'indeks di luar jangkauan diabaikan');
});

test('hapus titik: yang dipilih, atau yang terakhir bila tidak ada yang dipilih', () => {
  let d = emptyDraft([[0.1, 0.1], [0.9, 0.1], [0.5, 0.9]]);
  d = removeSelected(selectPoint(d, 0));
  assert.deepEqual(d.points, [[0.9, 0.1], [0.5, 0.9]]);
  assert.equal(d.selected, -1);
  d = removeSelected(d);
  assert.deepEqual(d.points, [[0.9, 0.1]]);
  assert.deepEqual(removeSelected(emptyDraft()).points, []);
});

test('Selesai butuh minimal 3 titik dan luas yang wajar', () => {
  assert.equal(canFinish(emptyDraft([[0.1, 0.1], [0.9, 0.9]])), false);
  assert.equal(canFinish(emptyDraft([[0.1, 0.1], [0.5, 0.5], [0.9, 0.9]])), false, 'segaris');
  assert.equal(canFinish(emptyDraft([[0.1, 0.1], [0.9, 0.1], [0.5, 0.9]])), true);
});

test('findHandle memakai jarak dalam piksel layar dan memilih yang terdekat', () => {
  const pts = [[0.5, 0.5], [0.52, 0.5]];
  const display = { w: 400, h: 200 };
  // 0.01 * 400 = 4 px dari titik 0 dan 8 px dari titik 1
  assert.equal(findHandle(pts, [0.51 - 0.005, 0.5], 28, display), 0);
  assert.equal(findHandle(pts, [0.9, 0.9], 28, display), -1);
  // jarak vertikal memakai tinggi: 0.2 * 200 = 40 px > 28 px
  assert.equal(findHandle(pts, [0.5, 0.7], 28, display), -1);
});
