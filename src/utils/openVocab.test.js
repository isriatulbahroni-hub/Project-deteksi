import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt, cleanDetections, cleanQuery, displayName, mapResults, toEnglish } from './openVocab.js';

test('cleanQuery merapikan spasi, huruf kecil, dan membatasi panjang', () => {
  assert.equal(cleanQuery('  Karung   PUPUK '), 'karung pupuk');
  assert.equal(cleanQuery(null), '');
  assert.equal(cleanQuery('a'.repeat(100)).length, 40);
});

test('toEnglish menerjemahkan kata dikenal dan membiarkan kata lain', () => {
  assert.equal(toEnglish('pupuk'), 'fertilizer bag');
  assert.equal(toEnglish('Sak Semen'), 'cement bag');
  assert.equal(toEnglish('red bucket'), 'red bucket');
  assert.equal(toEnglish('botol kaleng'), 'bottle can'); // semua kata dikenal
  assert.equal(toEnglish('botol aqua'), 'botol aqua'); // ada kata tak dikenal: apa adanya
  assert.equal(toEnglish(''), '');
});

test('buildPrompt dan displayName', () => {
  assert.equal(buildPrompt('pupuk'), 'a photo of a fertilizer bag');
  assert.equal(buildPrompt('  '), '');
  assert.equal(displayName('karung pupuk'), 'Karung pupuk');
  assert.equal(displayName(''), '');
});

test('mapResults mengubah kotak, menyaring skor rendah, dan mengurutkan', () => {
  const results = [
    { score: 0.2, label: 'x', box: { xmin: 10, ymin: 10, xmax: 50, ymax: 30 } },
    { score: 0.05, label: 'x', box: { xmin: 0, ymin: 0, xmax: 40, ymax: 40 } }, // di bawah ambang
    { score: 0.6, label: 'x', box: { xmin: 100, ymin: 100, xmax: 200, ymax: 220 } },
    { score: 0.9, label: 'x', box: { xmin: 5, ymin: 5, xmax: 5, ymax: 5 } }, // kotak kosong
  ];
  const dets = mapResults(results, { scale: 2, label: 'Pupuk', threshold: 0.1 });
  assert.equal(dets.length, 2);
  assert.equal(dets[0].confidence, 0.6);
  assert.deepEqual(
    { x: dets[0].x, y: dets[0].y, width: dets[0].width, height: dets[0].height, className: dets[0].className },
    { x: 200, y: 200, width: 200, height: 240, className: 'Pupuk' }
  );
  assert.equal(dets[1].width, 80);
});

test('mapResults aman terhadap masukan kosong dan membatasi jumlah', () => {
  assert.deepEqual(mapResults(undefined, { label: 'a' }), []);
  const many = Array.from({ length: 5 }, (_, i) => ({ score: 0.5 + i / 100, box: { xmin: 0, ymin: 0, xmax: 10 + i, ymax: 10 } }));
  assert.equal(mapResults(many, { label: 'a', maxDetections: 3 }).length, 3);
});

test('cleanDetections membuang kotak raksasa dan kotak kembar', () => {
  const frameArea = 1000 * 1000;
  const dets = [
    { x: 0, y: 0, width: 990, height: 990, confidence: 0.9 }, // hampir seluruh frame
    { x: 100, y: 100, width: 100, height: 100, confidence: 0.8 },
    { x: 102, y: 101, width: 100, height: 100, confidence: 0.7 }, // kembar kotak kedua
    { x: 400, y: 400, width: 100, height: 100, confidence: 0.6 },
  ];
  const kept = cleanDetections(dets, { frameArea });
  assert.equal(kept.length, 2);
  assert.deepEqual(kept.map((d) => d.confidence), [0.8, 0.6]);
});
