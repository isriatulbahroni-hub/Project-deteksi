/**
 * Riwayat keramaian: grafik batang per menit (1 jam terakhir) atau per jam (24 jam), plus ekspor CSV.
 */

import { useEffect, useState } from 'react';
import { MINUTE, formatClock, formatTime, series, toCsv } from '../utils/analytics';

const RANGES = {
  hour: { label: '1 jam', spanMs: 60 * MINUTE, stepMs: MINUTE },
  day: { label: '24 jam', spanMs: 24 * 60 * MINUTE, stepMs: 60 * MINUTE },
};
const W = 300;
const H = 80;

function downloadCsv(history) {
  // BOM agar Excel membaca UTF-8 dengan benar
  const blob = new Blob(['\uFEFF' + toCsv(history.buckets())], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `riwayat-orang-${formatTime(Date.now()).slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Dashboard({ history, onClear }) {
  const [range, setRange] = useState('hour');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  const { spanMs, stepMs } = RANGES[range];
  const buckets = history.buckets();
  const data = series(buckets, Math.max(now, history.lastTime()), { spanMs, stepMs });
  const peak = Math.max(0, ...data.map((d) => d.max));
  const totalIn = data.reduce((sum, d) => sum + d.in, 0);
  const totalOut = data.reduce((sum, d) => sum + d.out, 0);
  const scale = Math.max(1, peak);
  const bw = W / data.length;

  return (
    <details className="settings">
      <summary>📊 Riwayat</summary>

      <div className="row">
        {Object.entries(RANGES).map(([key, r]) => (
          <button key={key} className={`btn btn-small${range === key ? ' btn-on' : ''}`}
                  aria-pressed={range === key} onClick={() => setRange(key)}>
            {r.label}
          </button>
        ))}
      </div>

      {buckets.length === 0 ? (
        <p className="hint">Belum ada riwayat. Tekan Mulai; data dicatat per menit dan disimpan di perangkat ini.</p>
      ) : (
        <>
          <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
               aria-label="Grafik jumlah orang terlihat">
            {data.map((d, i) => {
              const h = (d.max / scale) * (H - 4);
              return (
                <rect key={d.t} x={i * bw + 0.5} y={H - h} width={Math.max(1, bw - 1)} height={h}>
                  <title>{`${formatClock(d.t)}: puncak ${d.max} orang`}</title>
                </rect>
              );
            })}
          </svg>
          <div className="chart-axis">
            <span>{formatClock(data[0].t)}</span>
            <span>{formatClock(data[data.length - 1].t)}</span>
          </div>
          <p className="chart-summary">Puncak {peak} · Masuk {totalIn} · Keluar {totalOut}</p>
        </>
      )}

      <div className="row">
        <button className="btn btn-small" disabled={buckets.length === 0} onClick={() => downloadCsv(history)}>
          ⬇️ Ekspor CSV
        </button>
        <button className="btn btn-small" disabled={buckets.length === 0}
                onClick={() => window.confirm('Hapus semua riwayat?') && onClear()}>
          🗑️ Hapus riwayat
        </button>
      </div>
    </details>
  );
}
