# Project Deteksi

Penghitung orang real-time yang berjalan **langsung di browser HP**. Video tidak pernah diunggah; semua diproses di perangkat (YOLO26 + WebGPU + ONNX Runtime Web).

## Fitur
- Deteksi dan pelacakan orang dengan ID per orang (ByteTrack sederhana)
- Hitungan **orang terlihat**, **masuk**, **keluar**, **puncak**, dan **total unik**
- Garis hitung virtual (horizontal/vertikal, posisi dan arah bisa diatur)
- Kamera belakang HP, ganti kamera, dan uji dengan file video
- Model Cepat/Akurat, dipilih otomatis sesuai kecepatan perangkat

## Menjalankan
```bash
npm install
npm run dev      # model ONNX diunduh otomatis saat pertama kali
npm test         # tes tracker dan penghitung
npm run build
```
Akses kamera di HP membutuhkan **HTTPS** (Vercel otomatis menyediakannya) atau `localhost`.

## Deploy
Hubungkan repo ke Vercel (framework Vite). `vercel.json` sudah mengatur header yang dibutuhkan WASM multi-thread.

## Catatan
- Model masih berorientasi lanskap (640×384); video potret di-letterbox sehingga resolusi efektifnya lebih rendah.
- Kerumunan yang sangat padat atau saling menutupi akan mengurangi akurasi.

## Atribusi dan perubahan dari upstream
Dibangun di atas [CodeRafay/realtime-object-detection](https://github.com/CodeRafay/realtime-object-detection) (Apache-2.0, © Rafay Adeel). Model ONNX diunduh dari repo tersebut pada commit `5f005c0` oleh `scripts/fetch-models.mjs`. Lisensi: Apache-2.0 (lihat `LICENSE`).

File upstream yang **diubah**: `src/App.jsx`, `src/App.css`, `src/index.css`, `src/main.jsx`, `src/components/BoundingBoxCanvas.jsx`, `src/components/CameraView.jsx`, `src/components/CameraView.css`, `src/hooks/useCamera.js` (default kamera belakang), `src/hooks/useObjectDetection.js` (hanya orang, statistik, garis hitung), `src/utils/constants.js` (tier "more" dihapus), `package.json`, `index.html`. File **baru**: `src/utils/counter.js`, `src/utils/counter.test.js`, `scripts/fetch-models.mjs`. Komponen Controls dan FPSMonitor serta integrasi Vercel Analytics dihapus.
