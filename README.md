# PMO Assistant (Demo)

Final project untuk MBCL — versi demo dari **PMO Assistant**: aplikasi rekap update
biweekly untuk tim PMO Specialist per stream/application/initiative. Tanpa login — semua
orang buka link yang sama untuk input update atau lihat dashboard.

> **Catatan:** Ini adalah versi demo dengan **data dummy sepenuhnya fiktif** (perusahaan,
> nama orang, dan initiative di bawah ini tidak merujuk ke entitas nyata mana pun) —
> dibuat untuk keperluan final project, bukan aplikasi production.

## Fitur

- **Input update** — pilih Stream → Application → Project/Initiative (atau tambah baru
  langsung dari form, tanpa perlu ubah kode), lalu isi 5 kategori: Key Highlight,
  Progress Last 2 Weeks, Plan Next 2 Weeks, Risk/Issue, Unlocking Needed, plus status
  RAG (Green/Amber/Red).
- **Dashboard** — semua initiative dikelompokkan per Stream → Application, tampil update
  terbaru tiap initiative. Bisa difilter by RAG status atau dicari by nama/PIC.
- **Portfolio health summary** — strip angka di atas dashboard (total initiative,
  Green/Amber/Red, dan yang belum update >21 hari) supaya kondisi portfolio kelihatan
  sekali lihat, tanpa harus scroll — pola yang umum dipakai tool portfolio management
  (Monday.com, Smartsheet, dsb).
- **Indikator update basi ("stale")** — initiative yang belum di-update lebih dari 21 hari
  (lebih dari satu siklus biweekly) ditandai otomatis di dashboard, supaya PIC yang belum
  lapor ketahuan tanpa perlu dicek satu-satu.
- **Trend RAG** — panah ▲/▼ di sebelah badge RAG kalau statusnya berubah dari update
  sebelumnya (▲ memburuk, ▼ membaik), jadi kelihatan arah initiative, bukan cuma titik
  statusnya sekarang.
- **Riwayat update per initiative** — tombol "Riwayat" di tiap card untuk buka update-update
  periode sebelumnya (data historisnya sudah tersimpan di database, sebelumnya cuma yang
  terbaru yang ditampilkan).
- **Risk & Issue Register (`/risks`)** — daftar semua initiative berstatus Amber/Red atau
  yang punya catatan Risk/Issue, dikumpulkan jadi satu halaman untuk memudahkan follow-up
  unlocking — tanpa perlu buka tiap stream satu-satu di dashboard.
- **Export ke Excel** — tombol "Export Excel" di dashboard untuk unduh kondisi portfolio
  (sesuai filter yang sedang aktif) sebagai `.xlsx`, siap dipakai bahan susun deck biweekly
  manual.
- **Stream fleksibel** — daftar Stream bisa ditambah, diganti nama, diurutkan ulang, atau
  diarsipkan langsung dari dashboard (tombol "Kelola Stream") — tidak hardcode di kode,
  jadi kalau nama/jumlah stream berubah, tidak perlu deploy ulang.
- **Upload Excel tracker** — di panel "Kelola Stream", upload file `.xlsx` tracker (sheet
  "Project Tracker") kapan saja untuk sinkronkan Stream/Application/Initiative beserta
  status RAG & Phase-nya, tanpa input manual satu-satu. Aman diulang tiap tracker-nya
  di-update — parsing terjadi di browser, file tidak pernah disimpan di server.
- **Timeline (`/timeline`)** — tampilan Gantt bulanan per initiative (Jan-Des), tiap sel
  bulan diklik langsung untuk ganti status (kosong → Dev/UAT → Prep Go Live/Go Live →
  Hypercare → Delay).
- **Data dummy siap pakai** — dua tombol di panel "Kelola Stream" untuk mengisi contoh
  data (`npm run seed` / tombol di UI): satu untuk struktur Stream/Application/Initiative
  awal, satu lagi untuk mensimulasikan import narasi update dari deck biweekly.

**Belum ada (sengaja ditunda):** auto-generate ke deck PowerPoint, dan notifikasi
follow-up otomatis (email/Slack) untuk risk/action item — halaman Risk Register dan
export Excel di atas jadi langkah awal ke arah situ, tapi kirim notifikasinya sendiri
masih manual. Isi deck biweekly juga tetap manual: lihat dashboard atau hasil export,
lalu copy kontennya.

## Stack

- **Next.js (App Router)** — frontend dan API (route handlers) dalam satu project, deploy
  sekali ke Vercel.
- **Postgres (Neon, via Vercel Storage)** — database bersama supaya semua orang lihat data
  yang sama, tersimpan permanen. Diakses lewat `@neondatabase/serverless`.
- Dashboard melakukan polling ke API setiap ~8 detik supaya update dari orang lain muncul
  near-real-time tanpa perlu WebSocket.

## Menjalankan di lokal

1. Install dependencies:

   ```bash
   npm install
   ```

2. Siapkan database Postgres (paling gampang: buat gratis di [neon.com](https://neon.com)
   atau lewat tab Storage di dashboard Vercel). Salin connection string-nya.

3. Salin `.env.local.example` menjadi `.env.local`, lalu isi `DATABASE_URL` dengan
   connection string tadi:

   ```bash
   cp .env.local.example .env.local
   ```

4. (Opsional, sekali saja) Isi Stream/Application/Initiative awal dari data dummy,
   supaya form input dan dashboard tidak kosong:

   ```bash
   npm run seed
   ```

   Sumbernya ada di `scripts/seed-data.json` (data fiktif). Aman dijalankan berkali-kali
   — data yang sudah ada tidak akan terduplikasi, hanya di-refresh.

5. Jalankan aplikasi:

   ```bash
   npm run dev
   ```

   Buka [http://localhost:3000](http://localhost:3000) untuk dashboard, atau
   [http://localhost:3000/input](http://localhost:3000/input) untuk input update. Semua
   tabel (`streams`, `applications`, `initiatives`, `updates`, `timeline_entries`) dibuat
   otomatis saat request API pertama kali jalan.

## Deploy ke Vercel

1. Push project ini ke repository GitHub (sudah dilakukan jika kamu memakai branch ini).
2. Buka [vercel.com/new](https://vercel.com/new) dan import repository-nya.
3. Sebelum deploy pertama (atau setelahnya, di tab **Storage** pada project Vercel),
   tambahkan database:
   - Klik **Storage** → **Create Database** → pilih **Postgres (Neon)**.
   - Ikuti langkah setup, lalu hubungkan (**Connect**) database itu ke project-mu.
   - Vercel otomatis menambahkan environment variable koneksi database (mis.
     `DATABASE_URL`) ke project.
4. Klik **Deploy**.
5. Setelah deploy selesai, buka dashboard-nya lalu klik tombol **"Muat contoh data
   awal"** dan **"Isi update dari deck PMO Biweekly"** di panel "Kelola Stream" untuk
   mengisi data dummy — supaya tidak perlu jalankan command dari terminal.
6. Bagikan URL yang diberikan Vercel (misalnya `https://nama-project.vercel.app`).

Kalau nama environment variable dari integrasi Vercel-mu berbeda (misalnya
`POSTGRES_URL` alih-alih `DATABASE_URL`), aplikasi ini sudah otomatis mencoba
keduanya — tidak perlu ubah kode, cukup pastikan salah satunya ada di **Settings →
Environment Variables**.

## Model data

```
streams          (id, name, sort_order, archived)
applications     (id, stream_id, name)
initiatives      (id, application_id, name, pic, current_rag, current_phase, archived)
updates          (id, initiative_id, period_label, rag,
                   key_highlight, progress_last_2wk, plan_next_2wk,
                   risk_issue, unlocking_needed, created_at)
timeline_entries (id, initiative_id, year, month, status)
```

Setiap `initiative` bisa punya banyak `updates` (satu per periode biweekly) — dashboard
menampilkan yang terbaru per initiative, histori tetap tersimpan di database.
`initiatives.current_rag`/`current_phase` itu status dari tracker Excel (di-refresh tiap
upload), berbeda dari `updates.rag` yang melekat ke satu laporan naratif biweekly —
keduanya ditampilkan terpisah di dashboard. `timeline_entries` menyimpan status Gantt
bulanan per initiative, diisi langsung dari halaman `/timeline` (klik untuk siklus
status), bukan diturunkan dari data lain.
