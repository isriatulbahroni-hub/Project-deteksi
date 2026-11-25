import test from 'node:test';
import assert from 'node:assert/strict';
import { createCounter } from './counter.js';

const dims = { width: 640, height: 480 };
const person = (id, cy) => ({ id, x: 100, y: cy - 50, width: 60, height: 100 });

test('orang yang melewati garis dihitung sekali', () => {
  const c = createCounter();
  for (const cy of [100, 150, 200, 300, 400]) c.update([person(1, cy)], dims);
  assert.deepEqual(c.snapshot(), { in: 1, out: 0, peak: 1, unique: 1 });
});

test('arah sebaliknya dihitung keluar, flip membalik arah', () => {
  const c = createCounter();
  for (const cy of [400, 300, 200, 100]) c.update([person(1, cy)], dims);
  assert.equal(c.snapshot().out, 1);

  const f = createCounter();
  const line = { orientation: 'h', pos: 0.5, flip: true };
  for (const cy of [100, 200, 300, 400]) f.update([person(1, cy)], dims, line);
  assert.equal(f.snapshot().out, 1);
});

test('berdiri di zona garis tidak terhitung, reset mengosongkan', () => {
  const c = createCounter();
  for (const cy of [100, 235, 245, 232, 100]) c.update([person(1, cy)], dims);
  assert.equal(c.snapshot().in + c.snapshot().out, 0);
  c.reset();
  assert.deepEqual(c.snapshot(), { in: 0, out: 0, peak: 0, unique: 0 });
});

test('garis vertikal dan puncak keramaian', () => {
  const c = createCounter();
  const line = { orientation: 'v', pos: 0.5, flip: false };
  const at = (id, cx) => ({ id, x: cx - 30, y: 100, width: 60, height: 100 });
  c.update([at(1, 100), at(2, 500), at(3, 120)], dims, line);
  c.update([at(1, 500), at(2, 100), at(3, 130)], dims, line);
  assert.deepEqual(c.snapshot(), { in: 1, out: 1, peak: 3, unique: 3 });
});
