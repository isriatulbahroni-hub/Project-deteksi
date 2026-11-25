import test from 'node:test';
import assert from 'node:assert/strict';
import { planTiles, placeTileDetections, mergeDetections } from './tiling.js';

const det = (x, y, w, h, conf = 0.9, classId = 0) =>
  ({ x, y, width: w, height: h, confidence: conf, classId, className: 'person' });

test('video lanskap tidak dipotong, video potret dipotong dua dengan tumpang tindih', () => {
  assert.equal(planTiles(1280, 720), null);
  assert.equal(planTiles(720, 720), null);
  const tiles = planTiles(720, 1280);
  assert.equal(tiles.length, 2);
  assert.equal(tiles[0].y, 0);
  assert.equal(tiles[1].y + tiles[1].height, 1280);
  assert.ok(tiles[0].y + tiles[0].height > tiles[1].y, 'ada tumpang tindih');
});

test('deteksi digeser ke koordinat frame dan kotak di tepi potongan ditandai terpotong', () => {
  const [top, bottom] = planTiles(720, 1280);
  const edge = det(100, top.height - 100, 80, 100); // menempel pada tepi bawah potongan atas
  const inner = det(100, 200, 80, 100);
  const [a, b] = placeTileDetections([edge, inner], top, 1280);
  assert.equal(a.cut, true);
  assert.equal(b.cut, false);
  const [c] = placeTileDetections([det(100, 50, 80, 100)], bottom, 1280);
  assert.equal(c.y, 50 + bottom.y);
});

test('deteksi ganda dari dua potongan digabung menjadi satu', () => {
  const merged = mergeDetections([[], [det(100, 500, 80, 200)], [det(102, 502, 80, 200, 0.8)]]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].confidence, 0.9);
});

test('kotak terpotong dibuang bila sudah tercakup deteksi frame penuh', () => {
  const full = det(100, 300, 200, 700);
  const cut = { ...det(100, 300, 200, 300, 0.95), cut: true };
  const merged = mergeDetections([[full], [cut]]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].height, 700);
});

test('orang yang berbeda tidak digabung', () => {
  const merged = mergeDetections([[det(0, 0, 80, 200)], [det(400, 600, 80, 200)]]);
  assert.equal(merged.length, 2);
});
