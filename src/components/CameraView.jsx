/**
 * Camera View Component
 * Displays video feed with overlaid detection boxes
 */

import { useEffect } from 'react';
import BoundingBoxCanvas from './BoundingBoxCanvas';
import './CameraView.css';

export default function CameraView({
  videoRef,
  stream,
  isFilePlaying,
  getTracks,
  getHeatmap,
  showHeatmap,
  isDetecting,
  line,
  extraLines,
  zones,
  zoneStats,
  draft,
  onDraftAdd,
  onDraftMove,
  onDraftSelect
}) {
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [videoRef, stream]);

  return (
    <div className="camera-view">
      <div className="video-container">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="video-element"
        />
        <BoundingBoxCanvas
          videoRef={videoRef}
          getTracks={getTracks}
          getHeatmap={getHeatmap}
          showHeatmap={showHeatmap}
          isDetecting={isDetecting}
          line={line}
          extraLines={extraLines}
          zones={zones}
          zoneStats={zoneStats}
          draft={draft}
          onDraftAdd={onDraftAdd}
          onDraftMove={onDraftMove}
          onDraftSelect={onDraftSelect}
        />
      </div>
      {!stream && !isFilePlaying && (
        <div className="no-stream-message">
          <p>📷 Kamera belum aktif</p>
          <p className="hint">Izinkan akses kamera di browser</p>
        </div>
      )}
    </div>
  );
}
