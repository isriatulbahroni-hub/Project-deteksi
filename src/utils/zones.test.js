import test from 'node:test';
import assert from 'node:assert/strict';
import { createZoneTracker, pointInPolygon, rectPolygon } from './zones.js';

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
