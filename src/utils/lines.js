/**
 * Beberapa garis hitung tambahan. Tiap garis punya penghitung sendiri (memakai createCounter),
 * jadi satu orang yang melewati dua garis dihitung masuk/keluar di masing-masing garis.
 * Garis utama tetap ditangani createCounter di useObjectDetection.
 */

import { createCounter } from './counter.js';

export function createLineSet() {
  const counters = new Map(); // id garis -> counter
  const get = (id) => {
    if (!counters.has(id)) counters.set(id, createCounter());
    return counters.get(id);
  };

  function update(people, dims, lines) {
    const ids = new Set(lines.map((l) => l.id));
    for (const id of [...counters.keys()]) if (!ids.has(id)) counters.delete(id);
    for (const line of lines) get(line.id).update(people, dims, line);
  }

  const snapshot = (lines) => lines.map((l) => {
    const s = get(l.id).snapshot();
    return { id: l.id, in: s.in, out: s.out };
  });

  const newSession = () => counters.forEach((c) => c.newSession());
  const reset = () => counters.forEach((c) => c.reset());

  return { update, snapshot, newSession, reset };
}
