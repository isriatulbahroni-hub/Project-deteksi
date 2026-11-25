import test from 'node:test';
import assert from 'node:assert/strict';
import { assign } from './assignment.js';

test('memilih total biaya terkecil, bukan pilihan rakus per baris', () => {
  // Rakus: baris 0 ambil kolom 0 (1) lalu baris 1 terpaksa kolom 1 (10) = 11. Optimal: 2 + 1 = 3.
  assert.deepEqual(assign([[1, 2], [1, 10]]), [1, 0]);
});

test('baris lebih banyak dari kolom: baris dengan biaya terkecil yang kebagian', () => {
  assert.deepEqual(assign([[1], [0.5], [2]]), [-1, 0, -1]);
});

test('kolom lebih banyak dari baris', () => {
  assert.deepEqual(assign([[5, 1, 9]]), [1]);
});

test('matriks kosong', () => {
  assert.deepEqual(assign([]), []);
  assert.deepEqual(assign([[], []]), [-1, -1]);
});
