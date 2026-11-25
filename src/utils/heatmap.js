/**
 * Peta panas keramaian: grid kasar yang menumpuk posisi kaki (tengah-bawah kotak) tiap orang.
 * Murni logika; penggambaran ada di BoundingBoxCanvas.
 */

export function createHeatmap({ cols = 32 } = {}) {
  let rows = 0;
  let w = 0;
  let h = 0;
  let data = new Float32Array(0);
  let max = 0;

  function init(width, height) {
    w = width;
    h = height;
    rows = Math.max(1, Math.round((cols * height) / width));
    data = new Float32Array(cols * rows);
    max = 0;
  }

  function add(people, { width, height }) {
    if (!width || !height) return;
    if (width !== w || height !== h) init(width, height);
    for (const p of people) {
      const cx = Math.min(cols - 1, Math.max(0, Math.floor(((p.x + p.width / 2) / width) * cols)));
      const cy = Math.min(rows - 1, Math.max(0, Math.floor(((p.y + p.height) / height) * rows)));
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || x >= cols || y < 0 || y >= rows) continue;
          const i = y * cols + x;
          data[i] += dx === 0 && dy === 0 ? 1 : 0.4; // sel pusat bobot penuh, tetangga lebih ringan
          if (data[i] > max) max = data[i];
        }
      }
    }
  }

  const grid = () => ({ cols, rows, data, max });

  function reset() {
    data.fill(0);
    max = 0;
  }

  return { add, grid, reset };
}
