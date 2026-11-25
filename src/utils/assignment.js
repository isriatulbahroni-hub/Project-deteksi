/**
 * Penugasan optimal (algoritma Hungarian / Kuhn-Munkres) untuk matriks biaya persegi panjang.
 * Dipakai tracker supaya pencocokan kotak-ke-jalur dipilih dengan total biaya terkecil,
 * bukan dicomot satu per satu (rakus) yang rawan menukar ID saat orang saling berdekatan.
 *
 * @param {number[][]} cost - cost[i][j] = biaya memasangkan baris i dengan kolom j (harus berhingga)
 * @returns {number[]} untuk tiap baris: indeks kolomnya, atau -1 bila tidak kebagian pasangan
 */
export function assign(cost) {
  const n = cost.length;
  if (n === 0) return [];
  const m = cost[0].length;
  if (m === 0) return new Array(n).fill(-1);

  // Algoritma mensyaratkan baris <= kolom; bila tidak, kerjakan versi transpos lalu balikkan hasilnya.
  const transpose = n > m;
  const a = transpose ? cost[0].map((_, j) => cost.map((row) => row[j])) : cost;
  const rows = a.length;
  const cols = a[0].length;

  const u = new Array(rows + 1).fill(0);
  const v = new Array(cols + 1).fill(0);
  const p = new Array(cols + 1).fill(0); // p[j] = baris (berbasis 1) yang dipasangkan ke kolom j
  const way = new Array(cols + 1).fill(0);

  for (let i = 1; i <= rows; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(cols + 1).fill(Infinity);
    const used = new Array(cols + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= cols; j++) {
        if (used[j]) continue;
        const cur = a[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= cols; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const result = new Array(n).fill(-1);
  for (let j = 1; j <= cols; j++) {
    if (p[j] === 0) continue;
    const aRow = p[j] - 1;
    const aCol = j - 1;
    if (transpose) result[aCol] = aRow;
    else result[aRow] = aCol;
  }
  return result;
}
