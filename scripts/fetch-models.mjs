// Mengunduh model ONNX (YOLO26, Apache-2.0) dari repo upstream pada commit tertentu.
// Dijalankan otomatis sebelum `npm run dev` dan `npm run build`. File yang sudah ada dilewati.
import { existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';

const SHA = '5f005c04d448fcb987874db92c2843bab2476818';
const BASE = `https://raw.githubusercontent.com/CodeRafay/realtime-object-detection/${SHA}/public/models`;
const FILES = ['model-fast.onnx', 'model-accurate.onnx'];
const DIR = new URL('../public/models/', import.meta.url);

mkdirSync(DIR, { recursive: true });
for (const name of FILES) {
  const target = new URL(name, DIR);
  if (existsSync(target) && statSync(target).size > 1_000_000) {
    console.log(`✓ ${name} sudah ada`);
    continue;
  }
  console.log(`↓ mengunduh ${name} ...`);
  const res = await fetch(`${BASE}/${name}`);
  if (!res.ok) throw new Error(`Gagal mengunduh ${name}: HTTP ${res.status}`);
  writeFileSync(target, Buffer.from(await res.arrayBuffer()));
}
