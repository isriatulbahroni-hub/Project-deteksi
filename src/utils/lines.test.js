import test from 'node:test';
import assert from 'node:assert/strict';
import { createLineSet } from './lines.js';

const dims = { width: 640, height: 480 };
const person = (id, cy) => ({ id, x: 100, y: cy - 50, width: 60, height: 100 });
const lines = [
  { id: 1, orientation: 'h', pos: 0.3, flip: false },
  { id: 2, orientation: 'h', pos: 0.7, flip: false },
];

test('tiap garis menghitung sendiri-sendiri', () => {
  const set = createLineSet();
  for (const cy of [50, 100, 200, 300, 400, 450]) set.update([person(1, cy)], dims, lines);
  assert.deepEqual(set.snapshot(lines), [
    { id: 1, in: 1, out: 0 },
    { id: 2, in: 1, out: 0 },
  ]);
});

test('garis yang dihapus dibuang, garis baru mulai dari nol', () => {
  const set = createLineSet();
  for (const cy of [50, 100, 200, 300, 400, 450]) set.update([person(1, cy)], dims, lines);
  set.update([], dims, [lines[0]]);
  assert.deepEqual(set.snapshot(lines), [
    { id: 1, in: 1, out: 0 },
    { id: 2, in: 0, out: 0 },
  ]);
  set.reset();
  assert.equal(set.snapshot(lines)[0].in, 0);
});
