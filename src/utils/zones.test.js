import test from 'node:test';
import assert from 'node:assert/strict';
import { createZoneTracker, normalizeZone, normalizeZones, pointInPolygon, rectPolygon } from './zones.js';
import { PRESETS } from './presets.js';

const dims = { width: 100, height: 100 };
const person = (id, cx, bottom) => ({ id, x: cx - 5, y: bottom - 20, width: 10, height: 20 });
const zone = { id: 1, points: rectPolygon(0.2, 0.2, 0.4, 0.4) };

test('titik di dalam dan di luar poligon', () => {
  const triangle = [[0, 0], [1, 0], [0, 1]];
  assert.equal(pointInPolygon(0.2, 0.2, triangle), true);
  assert.equal(pointInPolygon(0.8, 0.8, triangle), false);
});

test('zona menghitung yang sedang di dalam, puncak, dan lama berada di dalam', () => {
  const z = createZoneTracker();
  z.update([person(1, 30, 50), person(2, 40, 55)], dims, [zone], 0);
  z.update([person(1, 30, 50), person(2, 90, 90)], dims, [zone], 2000);
  const [s] = z.snapshot([zone], 4000);
  assert.equal(s.current, 1);
  assert.equal(s.peak, 2);
  assert.equal(s.avgSec, 4);
  assert.equal(s.maxSec, 4);
});

test('newSession mengosongkan orang di dalam tapi puncak tetap, reset mengosongkan semuanya', () => {
  const z = createZoneTracker();
  z.update([person(1, 30, 50)], dims, [zone], 0);
  z.newSession();
  assert.deepEqual(z.snapshot([zone], 1000)[0], { id: 1, current: 0, peak: 1, avgSec: 0, maxSec: 0 });
  z.reset();
  assert.equal(z.snapshot([zone], 1000)[0].peak, 0);
});

test('zona lama { x, y, w, h } dimigrasikan menjadi poligon empat titik, id dan nama tetap', () => {
  const z = normalizeZone({ id: 3, name: 'Area antrean', x: 0.1, y: 0.2, w: 0.8, h: 0.7 });
  assert.equal(z.id, 3);
  assert.equal(z.name, 'Area antrean');
  assert.deepEqual(z.points, rectPolygon(0.1, 0.2, 0.8, 0.7));
  assert.equal(pointInPolygon(0.5, 0.5, z.points), true);
  assert.equal(pointInPolygon(0.05, 0.05, z.points), false);
});

test('migrasi zona lama membatasi nilai ke dalam frame seperti sebelumnya', () => {
  const z = normalizeZone({ id: 1, x: 0.5, y: 0.5, w: 0.9, h: 0.9 });
  const xs = z.points.map((p) => p[0]);
  const ys = z.points.map((p) => p[1]);
  assert.equal(Math.max(...xs), 1);
  assert.equal(Math.max(...ys), 1);
  assert.equal(z.name, 'Zona 1');
});

test('zona poligon dipertahankan, titik dibatasi 0..1, titik rusak dibuang', () => {
  const z = normalizeZone({ id: 2, name: 'A', points: [[-0.2, 0.1], [1.5, 0.1], [0.5, 2], ['x', 1], [0.3]] });
  assert.deepEqual(z.points, [[0, 0.1], [1, 0.1], [0.5, 1]]);
});

test('zona tidak valid (tanpa id, kurang dari 3 titik, bentuk asing) ditolak', () => {
  assert.equal(normalizeZone(null), null);
  assert.equal(normalizeZone({ name: 'tanpa id', points: rectPolygon(0, 0, 1, 1) }), null);
  assert.equal(normalizeZone({ id: 1, points: [[0, 0], [1, 1]] }), null);
  assert.equal(normalizeZone({ id: 1, x: 0.1, y: 0.1 }), null);
});

test('normalizeZones mencampur zona lama dan baru, membuang yang rusak, dan membatasi jumlah', () => {
  const list = normalizeZones([
    { id: 1, x: 0, y: 0, w: 0.5, h: 0.5 },
    { id: 2, name: 'Baru', points: rectPolygon(0.2, 0.2, 0.3, 0.3) },
    { id: 'salah' },
    { id: 4, x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
  ], 2);
  assert.deepEqual(list.map((z) => z.id), [1, 2]);
  assert.ok(list.every((z) => Array.isArray(z.points) && z.points.length >= 3));
  assert.deepEqual(normalizeZones(undefined), []);
});

test('semua preset memakai zona poligon yang valid', () => {
  for (const preset of Object.values(PRESETS)) {
    for (const zone of preset.zones) {
      assert.ok(zone.name);
      assert.ok(zone.points.length >= 3);
      assert.ok(zone.points.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1));
    }
  }
});
