import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistory, series, toCsv, formatDuration, MINUTE } from './analytics.js';
import { createHeatmap } from './heatmap.js';
import { createDwell } from './dwell.js';
import { createAlertGate, metricValue } from './alert.js';

const T0 = Date.UTC(2026, 0, 1, 0, 0, 0); // kelipatan menit dan jam

test('riwayat: rata-rata, puncak, dan selisih masuk/keluar per menit', () => {
  const h = createHistory();
  h.record(T0 + 1000, { current: 2, in: 0, out: 0 });
  h.record(T0 + 2000, { current: 4, in: 1, out: 0 });
  h.record(T0 + 3000, { current: 3, in: 3, out: 1 });
  h.record(T0 + MINUTE + 500, { current: 1, in: 3, out: 2 });
  const [a, b] = h.buckets();
  assert.equal(a.max, 4);
  assert.equal(a.sum / a.n, 3);
  assert.equal(a.in, 3);
  assert.equal(a.out, 1);
  assert.equal(b.in, 0);
  assert.equal(b.out, 1);
});

test('riwayat: hitungan yang turun (reset) tidak menghasilkan selisih negatif', () => {
  const h = createHistory();
  h.record(T0, { current: 0, in: 5, out: 0 });
  h.record(T0 + 1000, { current: 0, in: 0, out: 0 });
  h.record(T0 + 2000, { current: 1, in: 2, out: 0 });
  assert.equal(h.buckets()[0].in, 2);
});

test('riwayat: dibatasi maxBuckets, data rusak dari penyimpanan dibuang, clear mengosongkan', () => {
  const h = createHistory({ maxBuckets: 2 });
  for (let i = 0; i < 3; i++) h.record(T0 + i * MINUTE, { current: i, in: 0, out: 0 });
  assert.equal(h.buckets().length, 2);
  assert.equal(h.buckets()[0].t, T0 + MINUTE);

  const loaded = createHistory({ initial: [{ t: T0, sum: 4, n: 2, max: 3, in: 1, out: 0 }, { t: 'x' }, null] });
  assert.equal(loaded.buckets().length, 1);
  loaded.clear();
  assert.equal(loaded.buckets().length, 0);
});

test('series mengisi menit kosong dan membuang data di luar rentang', () => {
  const h = createHistory();
  h.record(T0, { current: 3, in: 0, out: 0 });
  h.record(T0 + 5 * MINUTE, { current: 7, in: 0, out: 0 });
  const s = series(h.buckets(), T0 + 5 * MINUTE, { spanMs: 3 * MINUTE, stepMs: MINUTE });
  assert.deepEqual(s.map((d) => d.max), [0, 0, 7]);
});

test('series menggabungkan menit ke satu langkah: puncak = max, masuk/keluar dijumlah', () => {
  const h = createHistory();
  h.record(T0 + MINUTE, { current: 2, in: 0, out: 0 });
  h.record(T0 + 2 * MINUTE, { current: 5, in: 2, out: 1 });
  const [only] = series(h.buckets(), T0 + 10 * MINUTE, { spanMs: 60 * MINUTE, stepMs: 60 * MINUTE });
  assert.deepEqual([only.max, only.in, only.out], [5, 2, 1]);
});

test('CSV: header dan satu baris per menit', () => {
  const h = createHistory();
  h.record(T0 + 1000, { current: 2, in: 0, out: 0 });
  h.record(T0 + 2000, { current: 4, in: 1, out: 0 });
  h.record(T0 + 3000, { current: 3, in: 3, out: 1 });
  const lines = toCsv(h.buckets()).split('\n');
  assert.equal(lines[0], 'waktu,rata_rata,puncak,masuk,keluar');
  assert.equal(lines.length, 2);
  assert.ok(lines[1].endsWith(',3.0,4,3,1'));
});

test('formatDuration: m:ss, dan strip bila belum ada data', () => {
  assert.equal(formatDuration(0.4), '–');
  assert.equal(formatDuration(45), '0:45');
  assert.equal(formatDuration(125.6), '2:06');
  assert.equal(formatDuration(59.6), '1:00');
});

test('peta panas menumpuk di titik kaki dan bisa direset', () => {
  const hm = createHeatmap({ cols: 10 });
  const dims = { width: 100, height: 100 };
  const p = { id: 1, x: 40, y: 0, width: 20, height: 55 }; // kaki di (50, 55)
  hm.add([p], dims);
  hm.add([p], dims);
  const { cols, rows, data, max } = hm.grid();
  assert.equal(rows, 10);
  assert.equal(data[5 * cols + 5], 2);
  assert.equal(max, 2);
  hm.reset();
  assert.equal(hm.grid().max, 0);
});

test('peta panas: kotak yang keluar bingkai tidak error', () => {
  const hm = createHeatmap({ cols: 10 });
  hm.add([{ id: 1, x: -50, y: 90, width: 20, height: 50 }], { width: 100, height: 100 });
  assert.ok(hm.grid().max > 0);
});

test('lama terlihat: rata-rata yang bertahan, yang sekilas diabaikan', () => {
  const d = createDwell();
  for (const t of [0, 1000, 2000, 3000]) d.update([{ id: 1 }], t);
  d.update([{ id: 2 }], 3000);
  d.update([{ id: 2 }], 3200);
  const s = d.snapshot();
  assert.equal(s.count, 1);
  assert.equal(s.avgSec, 3);
  assert.equal(s.maxSec, 3);
});

test('lama terlihat: orang yang sudah pergi tetap masuk rata-rata, reset mengosongkan', () => {
  const d = createDwell();
  d.update([{ id: 1 }], 0);
  d.update([{ id: 1 }], 4000);
  d.update([], 9000);
  assert.equal(d.snapshot().count, 1);
  assert.equal(d.snapshot().avgSec, 4);
  d.reset();
  assert.equal(d.snapshot().count, 0);
});

test('peringatan: harus melewati batas cukup lama, lalu menunggu cooldown', () => {
  const g = createAlertGate({ holdMs: 3000, cooldownMs: 60000 });
  assert.equal(g.check(11, 10, 0), false);
  assert.equal(g.check(11, 10, 2000), false);
  assert.equal(g.check(11, 10, 3000), true);
  assert.equal(g.check(11, 10, 10000), false);
  assert.equal(g.check(9, 10, 20000), false);
  assert.equal(g.check(12, 10, 61000), false);
  assert.equal(g.check(12, 10, 64000), true);
});

test('peringatan: batas 0 berarti mati, metricValue memilih sumber nilai', () => {
  const g = createAlertGate({ holdMs: 0 });
  assert.equal(g.check(99, 0, 0), false);
  const stats = { current: 4, in: 9, out: 3 };
  assert.equal(metricValue(stats, 'current'), 4);
  assert.equal(metricValue(stats, 'inside'), 6);
  assert.equal(metricValue({ current: 0, in: 1, out: 5 }, 'inside'), 0);
});
