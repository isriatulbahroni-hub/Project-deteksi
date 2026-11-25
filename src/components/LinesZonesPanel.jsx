/**
 * Pengaturan garis hitung tambahan dan zona area (persegi panjang), beserta tombol tambah/hapus.
 */

import { MAX_EXTRA } from '../utils/presets';

const pct = (v) => Math.round(v * 100);

function ZoneSlider({ label, value, min, max, onChange }) {
  return (
    <label className="field">
      <span>{label}: {value}%</span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value) / 100)} />
    </label>
  );
}

export default function LinesZonesPanel({
  extraLines, zones,
  onAddLine, onUpdateLine, onRemoveLine,
  onAddZone, onUpdateZone, onRemoveZone,
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
            <span>{z.name}</span>
            <button className="btn btn-small" aria-label={`Hapus ${z.name}`} onClick={() => onRemoveZone(z.id)}>🗑️</button>
          </div>
          <ZoneSlider label="Kiri" value={pct(z.x)} min={0} max={95} onChange={(v) => onUpdateZone(z.id, { x: v })} />
          <ZoneSlider label="Atas" value={pct(z.y)} min={0} max={95} onChange={(v) => onUpdateZone(z.id, { y: v })} />
          <ZoneSlider label="Lebar" value={pct(z.w)} min={5} max={100} onChange={(v) => onUpdateZone(z.id, { w: v })} />
          <ZoneSlider label="Tinggi" value={pct(z.h)} min={5} max={100} onChange={(v) => onUpdateZone(z.id, { h: v })} />
        </div>
      ))}
      <div className="row">
        <button className="btn btn-small" disabled={zones.length >= MAX_EXTRA} onClick={onAddZone}>
          + Tambah zona
        </button>
      </div>
      <p className="hint">
        Zona menghitung objek yang kakinya berada di dalam area, plus puncak dan lama berada di dalam.
      </p>
    </>
  );
}
