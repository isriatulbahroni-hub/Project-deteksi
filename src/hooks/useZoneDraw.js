/**
 * Mode "Gambar zona": menyimpan draf titik sementara; zona baru baru dibuat saat Selesai.
 * Draf: { points: [[x, y], ...] (0..1), selected, editingId } atau null bila mode mati.
 */

import { useCallback, useState } from 'react';
import { addPoint, canFinish, emptyDraft, movePoint, removeSelected, selectPoint } from '../utils/zoneDraft';

export function useZoneDraw({ zones, addZone, updateZone }) {
  const [draft, setDraft] = useState(null);

  // Mulai menggambar zona baru
  const startNew = useCallback(() => setDraft({ ...emptyDraft(), editingId: null }), []);

  // Ubah bentuk zona yang sudah ada: titik-titiknya dimuat sebagai draf
  const startEdit = useCallback((id) => {
    const zone = zones.find((z) => z.id === id);
    if (zone) setDraft({ ...emptyDraft(zone.points.map((p) => [...p])), editingId: id });
  }, [zones]);

  const add = useCallback((point) => setDraft((d) => (d ? addPoint(d, point) : d)), []);
  const move = useCallback((index, point) => setDraft((d) => (d ? movePoint(d, index, point) : d)), []);
  const select = useCallback((index) => setDraft((d) => (d ? selectPoint(d, index) : d)), []);
  const removePoint = useCallback(() => setDraft((d) => (d ? removeSelected(d) : d)), []);
  const cancel = useCallback(() => setDraft(null), []);

  const finish = useCallback(() => {
    if (!draft || !canFinish(draft)) return false;
    if (draft.editingId !== null) updateZone(draft.editingId, { points: draft.points });
    else addZone(draft.points);
    setDraft(null);
    return true;
  }, [draft, addZone, updateZone]);

  return {
    draft,
    drawing: draft !== null,
    canFinish: draft !== null && canFinish(draft),
    startNew, startEdit, add, move, select, removePoint, cancel, finish,
  };
}
