/**
 * Pengaturan garis hitung tambahan dan zona area (poligon yang digambar dengan sentuhan),
 * beserta tombol tambah/ubah/hapus.
 */

import { MAX_EXTRA } from '../utils/presets';

const pct = (v) => Math.round(v * 100);

export default function LinesZonesPanel({
  extraLines, zones,
  onAddLine, onUpdateLine, onRemoveLine,
  onDrawZone, onEditZone, onRemoveZone,
  drawing = false,
}) {
  return (
    <>
      <h3 className="settings-title">➕ Garis hitung tambahan</h3>
      {extraLines.map((l) => (
        <div className="field" key={l.id}>
          <span>{l.name}: {pct(l.pos)}%</span>
          <div className="row">
            <select value={l.orientation} onChange={(e) => onUpdateLine(l.id, { orientation: e.target.value })}>
              <option value="h">Horizontal</option>
              <option value="v">Vertikal</option>
            </select>
            <button className="btn btn-small" onClick={() => onUpdateLine(l.id, { flip: !l.flip })}>⇄ Balik</button>
            <button className="btn btn-small" aria-label={`Hapus ${l.name}`} onClick={() => onRemoveLine(l.id)}>🗑️</button>
          </div>
          <input type="range" min="5" max="95" value={pct(l.pos)}
                 onChange={(e) => onUpdateLine(l.id, { pos: Number(e.target.value) / 100 })} />
        </div>
      ))}
      <div className="row">
        <button className="btn btn-small" disabled={extraLines.length >= MAX_EXTRA} onClick={onAddLine}>
          + Tambah garis
        </button>
      </div>

      <h3 className="settings-title">📍 Zona area</h3>
      {zones.map((z) => (
        <div className="field" key={z.id}>
          <div className="row">
            <span>{z.name} · {z.points.length} titik</span>
            <button className="btn btn-small" disabled={drawing} onClick={() => onEditZone(z.id)}>✏️ Ubah bentuk</button>
            <button className="btn btn-small" disabled={drawing} aria-label={`Hapus ${z.name}`} onClick={() => onRemoveZone(z.id)}>🗑️</button>
          </div>
        </div>
      ))}
      <div className="row">
        <button className="btn btn-small" disabled={drawing || zones.length >= MAX_EXTRA} onClick={onDrawZone}>
          + Gambar zona
        </button>
      </div>
      <p className="hint">
        Ketuk video untuk menaruh titik (minimal 3), seret titik untuk menggeser. Zona menghitung objek yang
        kakinya berada di dalam area, plus puncak dan lama berada di dalam.
      </p>
    </>
  );
}
