/**
 * Bounding Box Canvas Component
 * Overlays detection boxes on video feed
 */

import { useEffect, useRef } from 'react';
import { COLORS } from '../utils/constants';
import { labelFor } from '../utils/presets';
import { clientToNormalized, containRect } from '../utils/geometry';
import { findHandle } from '../utils/zoneDraft';
import './BoundingBoxCanvas.css';

const LINE_COLORS = ['#FFD60A', '#FB7185', '#A78BFA', '#34D399', '#F97316'];
const HANDLE_HIT_PX = 28; // jangkauan sentuh titik zona (px layar), cukup lebar untuk jari

export default function BoundingBoxCanvas({
  videoRef,
  getTracks,
  getHeatmap,
  showHeatmap,
  isDetecting,
  line,
  extraLines = [],
  zones = [],
  zoneStats = [],
  draft = null, // mode "Gambar zona": { points, selected, editingId } atau null
  onDraftAdd,
  onDraftMove,
  onDraftSelect
}) {
  const canvasRef = useRef(null);
  const overlayRef = useRef({ line, extraLines, zones, zoneStats, draft });
  const dragRef = useRef(-1); // indeks titik yang sedang diseret, -1 = tidak ada

  // Perbarui ref di effect (bukan saat render) agar loop gambar tidak perlu di-restart
  useEffect(() => {
    overlayRef.current = { line, extraLines, zones, zoneStats, draft };
  }, [line, extraLines, zones, zoneStats, draft]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video) return;

    // Match canvas size to video size
    const resizeCanvas = () => {
      canvas.width = video.videoWidth || video.width;
      canvas.height = video.videoHeight || video.height;
    };

    resizeCanvas();
    video.addEventListener('loadedmetadata', resizeCanvas);

    return () => {
      video.removeEventListener('loadedmetadata', resizeCanvas);
    };
  }, [videoRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Gambar ulang tiap frame layar: kotak diekstrapolasi ke waktu sekarang agar halus.
    // Garis dan zona selalu tampil supaya posisinya bisa diatur sebelum deteksi dimulai.
    // Peta panas (bila dinyalakan) digambar paling bawah dan tetap tampil setelah deteksi berhenti.
    let raf;
    const draw = () => {
      const o = overlayRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (showHeatmap && getHeatmap) drawHeatmap(ctx, getHeatmap());
      // Zona yang sedang diubah bentuknya diganti oleh gambar draf-nya
      o.zones
        .filter((zone) => zone.id !== o.draft?.editingId)
        .forEach((zone) => drawZone(ctx, zone, o.zoneStats.find((s) => s.id === zone.id)));
      drawLine(ctx, o.line, LINE_COLORS[0]);
      o.extraLines.forEach((l, i) => drawLine(ctx, l, LINE_COLORS[(i + 1) % LINE_COLORS.length]));
      if (isDetecting) getTracks(performance.now()).forEach((detection) => drawBox(ctx, detection));
      if (o.draft) drawDraft(ctx, o.draft);
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [getTracks, getHeatmap, showHeatmap, isDetecting]);

  // Sentuhan -> koordinat video 0..1. Memakai videoWidth/videoHeight karena video (dan kanvas)
  // ditampilkan dengan object-fit: contain, jadi ada pita hitam yang bukan bagian gambar.
  const toVideoPoint = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const video = videoRef.current;
    const cw = video?.videoWidth || canvas.width;
    const ch = video?.videoHeight || canvas.height;
    return clientToNormalized(e.clientX, e.clientY, canvas.getBoundingClientRect(), cw, ch);
  };

  // Ketuk = taruh titik baru; ketuk/seret di dekat titik yang ada = pilih dan geser titik itu.
  const handlePointerDown = (e) => {
    const d = overlayRef.current.draft;
    const g = toVideoPoint(e);
    if (!d || !g || !(g.dispW > 0)) return;
    let index = findHandle(d.points, [g.x, g.y], HANDLE_HIT_PX, { w: g.dispW, h: g.dispH });
    if (index >= 0) {
      onDraftSelect?.(index);
    } else if (g.inside) {
      index = d.points.length;
      onDraftAdd?.([g.x, g.y]);
    } else {
      return; // ketukan di pita hitam di luar gambar diabaikan
    }
    dragRef.current = index;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (dragRef.current < 0) return;
    const g = toVideoPoint(e);
    if (g && g.dispW > 0) onDraftMove?.(dragRef.current, [g.x, g.y]); // dibatasi 0..1 oleh reducer
  };

  const handlePointerEnd = (e) => {
    dragRef.current = -1;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  return (
    <canvas
      ref={canvasRef}
      className={`bounding-box-canvas${draft ? ' drawing' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    />
  );
}

// Biru (sepi) -> merah (ramai); sel yang hampir kosong tidak digambar.
function drawHeatmap(ctx, { cols, rows, data, max }) {
  if (!max || !rows) return;
  const cw = ctx.canvas.width / cols;
  const ch = ctx.canvas.height / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = data[y * cols + x] / max;
      if (v < 0.05) continue;
      ctx.fillStyle = `hsla(${Math.round(240 * (1 - v))}, 100%, 50%, ${0.15 + 0.45 * v})`;
      ctx.fillRect(x * cw, y * ch, cw + 1, ch + 1);
    }
  }
}

function polygonPath(ctx, points) {
  const { width: w, height: h } = ctx.canvas;
  ctx.beginPath();
  points.forEach(([px, py], i) => (i ? ctx.lineTo(px * w, py * h) : ctx.moveTo(px * w, py * h)));
}

// Zona poligon (koordinat 0..1) dengan nama dan jumlah objek di dalamnya.
function drawZone(ctx, zone, stat) {
  const { width: w } = ctx.canvas;
  ctx.save();
  polygonPath(ctx, zone.points);
  ctx.closePath();
  ctx.fillStyle = 'rgba(56, 189, 248, 0.10)';
  ctx.fill();
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = Math.max(2, w / 300);
  ctx.lineJoin = 'round';
  ctx.setLineDash([w / 50, w / 80]);
  ctx.stroke();
  ctx.setLineDash([]);
  // Label di titik paling atas (kiri bila sama tinggi), dijaga tetap di dalam kanvas
  const anchor = zone.points.reduce((a, b) => (b[1] < a[1] || (b[1] === a[1] && b[0] < a[0]) ? b : a));
  const fontPx = Math.max(14, Math.round(w / 50));
  ctx.font = `bold ${fontPx}px Arial`;
  const text = `${zone.name}: ${stat?.current ?? 0}`;
  const boxW = ctx.measureText(text).width + 8;
  const x = Math.max(0, Math.min(anchor[0] * w, w - boxW));
  const y = Math.max(0, anchor[1] * ctx.canvas.height);
  ctx.fillStyle = '#0284C7';
  ctx.fillRect(x, y, boxW, fontPx + 8);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(text, x + 4, y + fontPx + 1);
  ctx.restore();
}

// Draf zona yang sedang digambar: garis, titik yang bisa diseret, dan petunjuk saat masih kosong.
function drawDraft(ctx, { points, selected }) {
  const { width: w, height: h } = ctx.canvas;
  const rect = ctx.canvas.getBoundingClientRect();
  const shown = containRect(rect.width, rect.height, w, h);
  const k = shown.w > 0 ? w / shown.w : 1; // piksel kanvas per piksel layar, agar ukuran titik tetap nyaman disentuh
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (points.length >= 2) {
    polygonPath(ctx, points);
    if (points.length >= 3) {
      ctx.closePath();
      ctx.fillStyle = 'rgba(250, 204, 21, 0.18)';
      ctx.fill();
    }
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 3 * k;
    ctx.stroke();
  }
  points.forEach(([px, py], i) => {
    const on = i === selected;
    ctx.beginPath();
    ctx.arc(px * w, py * h, (on ? 14 : 11) * k, 0, Math.PI * 2);
    ctx.fillStyle = on ? '#F97316' : '#FACC15';
    ctx.fill();
    ctx.lineWidth = 2.5 * k;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
  });
  if (points.length === 0) {
    const text = 'Ketuk video untuk menaruh titik zona';
    ctx.font = `bold ${Math.round(16 * k)}px Arial`;
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(w / 2 - tw / 2 - 10 * k, h / 2 - 20 * k, tw + 20 * k, 36 * k);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(text, w / 2 - tw / 2, h / 2 + 5 * k);
  }
  ctx.restore();
}

function drawLine(ctx, line, color = '#FFD60A') {
  if (!line) return;
  const { width: w, height: h } = ctx.canvas;
  const horizontal = line.orientation === 'h';
  const at = line.pos * (horizontal ? h : w);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, w / 200);
  ctx.setLineDash([w / 40, w / 60]);
  ctx.beginPath();
  if (horizontal) { ctx.moveTo(0, at); ctx.lineTo(w, at); } else { ctx.moveTo(at, 0); ctx.lineTo(at, h); }
  ctx.stroke();
  // Panah kecil menunjuk arah "masuk"
  const forward = !line.flip;
  const s = Math.max(14, w / 40);
  const cx = horizontal ? w / 2 : at;
  const cy = horizontal ? at : h / 2;
  const d = forward ? 1 : -1;
  ctx.setLineDash([]);
  ctx.fillStyle = color;
  ctx.beginPath();
  if (horizontal) { ctx.moveTo(cx - s, cy + d * s * 0.2); ctx.lineTo(cx + s, cy + d * s * 0.2); ctx.lineTo(cx, cy + d * s * 1.6); }
  else { ctx.moveTo(cx + d * s * 0.2, cy - s); ctx.lineTo(cx + d * s * 0.2, cy + s); ctx.lineTo(cx + d * s * 1.6, cy); }
  ctx.closePath();
  ctx.fill();
  // Nama garis (hanya garis tambahan yang punya nama)
  if (line.name) {
    ctx.font = `bold ${Math.max(14, Math.round(w / 50))}px Arial`;
    if (horizontal) ctx.fillText(line.name, 8, at - 8);
    else ctx.fillText(line.name, at + 8, Math.max(18, h / 12));
  }
  ctx.restore();
}

function drawBox(ctx, { id, x, y, width, height, className }) {
  // Color per track (first 20 palette entries are the bright ones), so each object keeps its color
  const color = COLORS[id % 20];

  // Draw bounding box
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, ctx.canvas.width / 300);
  ctx.strokeRect(x, y, width, height);

  // Draw label background
  const label = `${labelFor(className)} #${id}`;
  const fontPx = Math.max(16, Math.round(ctx.canvas.width / 45));
  ctx.font = `bold ${fontPx}px Arial`;
  const textHeight = fontPx + 4;
  const padding = 4;
  ctx.fillStyle = color;
  ctx.fillRect(x, y - textHeight - padding, ctx.measureText(label).width + padding * 2, textHeight + padding);

  // Draw label text
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(label, x + padding, y - padding);
}
