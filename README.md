# Project Deteksi

Penghitung orang real-time yang berjalan **langsung di browser HP**. Video tidak pernah diunggah; semua diproses di perangkat (YOLO26 + WebGPU + ONNX Runtime Web).

## Fitur
- Deteksi dan pelacakan orang dengan ID per orang (ByteTrack sederhana, pencocokan optimal Hungarian)
- Hitungan **orang terlihat**, **masuk**, **keluar**, **di dalam**, **puncak**, **total unik**, dan **lama terlihat**
- **Garis hitung** virtual utama plus hingga 4 garis tambahan (horizontal/vertikal, posisi dan arah bisa diatur)
- **Zona area** (hingga 4): jumlah di dalam, puncak, dan rata-rata lama berada di dalam
- **Skenario siap pakai**: Pintu masuk, Antrean, Area ramai, Lalu lintas
- **Objek yang dihitung** bisa dipilih: orang, kendaraan, atau hewan
- **Mode tajam** untuk video potret: frame dipotong jadi bagian-bagian agar orang jauh/kecil terdeteksi (otomatis sesuai kecepatan HP, dimatikan sementara bila FPS terlalu rendah)
- Peta panas, riwayat per menit/jam dengan ekspor CSV, peringatan kapasitas (bunyi, getar, Telegram)
- Layar tetap menyala saat deteksi berjalan; pengaturan tersimpan di perangkat
- Bisa dibuka offline setelah pernah dimuat sekali (service worker)
- Kamera belakang HP, ganti kamera, dan uji dengan file video
- Model Cepat/Akurat, dipilih otomatis sesuai kecepatan perangkat

## Menjalankan
```bash
npm install
npm run dev      # model ONNX diunduh otomatis saat pertama kali
npm test         # tes tracker, penghitung, garis, zona, dan mode tajam
npm run build
```
Akses kamera di HP membutuhkan **HTTPS** (Vercel otomatis menyediakannya) atau `localhost`.

## Deploy
Hubungkan repo ke Vercel (framework Vite). `vercel.json` sudah mengatur header yang dibutuhkan WASM multi-thread.

## Catatan
- Model berorientasi lanskap (640×384). Tanpa mode tajam, video potret di-letterbox sehingga resolusi efektifnya lebih rendah.
- Mode tajam memakai 3× inferensi per frame, jadi lebih berat di HP yang lambat.
- Kerumunan yang sangat padat atau saling menutupi akan mengurangi akurasi.
- Cache offline model disimpan oleh service worker; naikkan `VERSION` di `public/sw.js` bila isi `/models/` diganti.

## Atribusi dan perubahan dari upstream
Dibangun di atas [CodeRafay/realtime-object-detection](https://github.com/CodeRafay/realtime-object-detection) (Apache-2.0, © Rafay Adeel). Model ONNX diunduh dari repo tersebut pada commit `5f005c0` oleh `scripts/fetch-models.mjs`. Lisensi: Apache-2.0 (lihat `LICENSE`).

File upstream yang **diubah**: `src/App.jsx`, `src/App.css`, `src/index.css`, `src/main.jsx`, `src/components/BoundingBoxCanvas.jsx`, `src/components/CameraView.jsx`, `src/components/CameraView.css`, `src/hooks/useCamera.js` (default kamera belakang), `src/hooks/useObjectDetection.js` (hanya orang, statistik, garis hitung), `src/utils/constants.js` (tier "more" dihapus), `package.json`, `index.html`. File **baru**: `src/utils/counter.js`, `src/utils/counter.test.js`, `scripts/fetch-models.mjs`. Komponen Controls dan FPSMonitor serta integrasi Vercel Analytics dihapus.

Perubahan lanjutan: `src/hooks/useObjectDetection.js` (pilihan objek, mode tajam, garis dan zona tambahan, simpan pengaturan), `src/utils/preprocessing.js` (opsi memotong bagian frame), `src/utils/tracker.js` (pencocokan optimal Hungarian), `src/components/BoundingBoxCanvas.jsx` dan `src/components/CameraView.jsx` (menggambar zona dan garis tambahan), `src/main.jsx` (pendaftaran service worker), `package.json` (daftar tes). File **baru**: `src/utils/assignment.js`, `src/utils/tiling.js`, `src/utils/lines.js`, `src/utils/zones.js`, `src/utils/presets.js` beserta tesnya, `src/hooks/useWakeLock.js`, `src/components/LinesZonesPanel.jsx`, `public/sw.js`.
