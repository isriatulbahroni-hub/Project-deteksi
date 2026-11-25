/**
 * Bounding Box Canvas Component
 * Overlays detection boxes on video feed
 */

import { useEffect, useRef } from 'react';
import { COLORS } from '../utils/constants';
import './BoundingBoxCanvas.css';

export default function BoundingBoxCanvas({ 
  videoRef, 
  getTracks,
  isDetecting,
  line
}) {
  const canvasRef = useRef(null);
  const lineRef = useRef(line);

  // Perbarui ref di effect (bukan saat render) agar loop gambar tidak perlu di-restart
  useEffect(() => {
    lineRef.current = line;
  }, [line]);

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
    // Garis masuk/keluar selalu tampil supaya posisinya bisa diatur sebelum deteksi dimulai.
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawLine(ctx, lineRef.current);
      if (isDetecting) getTracks(performance.now()).forEach((detection) => drawBox(ctx, detection));
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [getTracks, isDetecting]);

  return <canvas ref={canvasRef} className="bounding-box-canvas" />;
}

function drawLine(ctx, line) {
  if (!line) return;
  const { width: w, height: h } = ctx.canvas;
  const horizontal = line.orientation === 'h';
  const at = line.pos * (horizontal ? h : w);
  ctx.save();
  ctx.strokeStyle = '#FFD60A';
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
  ctx.fillStyle = '#FFD60A';
  ctx.beginPath();
  if (horizontal) { ctx.moveTo(cx - s, cy + d * s * 0.2); ctx.lineTo(cx + s, cy + d * s * 0.2); ctx.lineTo(cx, cy + d * s * 1.6); }
  else { ctx.moveTo(cx + d * s * 0.2, cy - s); ctx.lineTo(cx + d * s * 0.2, cy + s); ctx.lineTo(cx + d * s * 1.6, cy); }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBox(ctx, { id, x, y, width, height }) {
  // Color per track (first 20 palette entries are the bright ones), so each object keeps its color
  const color = COLORS[id % 20];

  // Draw bounding box
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, ctx.canvas.width / 300);
  ctx.strokeRect(x, y, width, height);

  // Draw label background
  const label = `Orang #${id}`;
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
