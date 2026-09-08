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
- **Action Item Tracker (`/actions`)** — catat action item dengan owner, due date, dan
  source (mis. "Meeting 5 Sep"), lepas dari catatan pribadi tiap orang. Item yang lewat
  due date otomatis ditandai overdue, baik di halaman ini maupun sebagai badge di
  dashboard dan portfolio health summary.
- **Document Readiness Checklist (`/documents`)** — matrix per initiative × jenis dokumen
  (default: Project Charter, PRD, RNI — bisa ditambah/diganti lewat "Kelola Dokumen", sama
  seperti Stream) dengan status Belum mulai/In Progress/Selesai/N-A yang tinggal diklik.
  Dashboard menampilkan ringkasannya sebagai badge "dokumen selesai / total" per initiative.
- **Stream fleksibel** — daftar Stream bisa ditambah, diganti nama, diurutkan ulang, atau
  diarsipkan langsung dari dashboard (tombol "Kelola Stream") — tidak hardcode di kode,
  jadi kalau nama/jumlah stream berubah, tidak perlu deploy ulang.
- **Upload Excel tracker** — di panel "Kelola Stream", upload file `.xlsx` tracker kapan saja
  untuk sinkronkan Stream/Application/Initiative beserta status RAG & Phase-nya, tanpa input
  manual satu-satu. Sheet-nya dipilih dari dropdown setelah file terbaca (bukan nama yang
  di-hardcode) — otomatis ditebak duluan kalau ada sheet bernama mengandung "all project",
  tapi bisa diganti manual, karena nama sheet tracker biasanya berubah tiap cycle (mis. beda
  nomor minggu/tahun) sementara struktur kolomnya relatif stabil. Kolom sendiri dideteksi
  dari teks header (Stream, Application, Project/Initiative Name, Owner/TPO, Delivery Lead,
  Timeline Status, Actual Phase), bukan posisi tetap, jadi tahan kalau kolom di tracker
  digeser/ditambah. Aman diulang tiap tracker-nya di-update — parsing terjadi di browser,
  file tidak pernah disimpan di server.
- **Timeline (`/timeline`)** — tampilan Gantt bulanan per initiative (Jan-Des), tiap sel
  bulan diklik langsung untuk ganti status (kosong → Dev/UAT → Prep Go Live/Go Live →
  Hypercare → Delay).
- **Data dummy siap pakai** — dua tombol di panel "Kelola Stream" untuk mengisi contoh
  data (`npm run seed` / tombol di UI): satu untuk struktur Stream/Application/Initiative
  awal, satu lagi untuk mensimulasikan import narasi update dari deck biweekly.

**Belum ada (sengaja ditunda):** ekstraksi otomatis dari meeting notes (perlu integrasi
LLM — lihat catatan di bawah), auto-generate bi-weekly report/deck PowerPoint, notifikasi
follow-up otomatis (email/Slack), dan cross-source reconciliation (bandingkan Excel
tracker vs update manual vs hasil ekstraksi notes untuk flag data yang tidak konsisten).
Untuk sekarang, action item & dokumen tetap diinput manual (bukan dari paste notes
mentah), dan isi deck biweekly tetap manual: lihat dashboard atau hasil export, lalu copy
kontennya.

> **Soal AI/LLM:** beberapa fitur di atas (baca meeting notes secara natural, generate
> narasi report "What happened → So what → What's next") butuh model bahasa, bukan cuma
> parsing kolom seperti Excel import. Belum diimplementasikan karena perlu keputusan
> provider (Anthropic/Claude berbayar tapi murah di volume kecil, vs provider dengan
> free-tier seperti Google Gemini/Groq dengan kualitas berbeda) dan API key milik sendiri
> — app ini publik tanpa login, jadi endpoint yang manggil LLM juga perlu rate limit dasar
> supaya tidak disalahgunakan.

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
   tabel (`streams`, `applications`, `initiatives`, `updates`, `timeline_entries`,
   `action_items`, `document_types`, `document_checklist`) dibuat otomatis saat request
   API pertama kali jalan.

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
action_items     (id, initiative_id, description, owner, due_date, status, source, created_at)
document_types   (id, name, sort_order, archived)
document_checklist (id, initiative_id, document_type_id, status, link, updated_at)
```

Setiap `initiative` bisa punya banyak `updates` (satu per periode biweekly) — dashboard
menampilkan yang terbaru per initiative, histori tetap tersimpan di database.
`initiatives.current_rag`/`current_phase` itu status dari tracker Excel (di-refresh tiap
upload), berbeda dari `updates.rag` yang melekat ke satu laporan naratif biweekly —
keduanya ditampilkan terpisah di dashboard. `timeline_entries` menyimpan status Gantt
bulanan per initiative, diisi langsung dari halaman `/timeline` (klik untuk siklus
status), bukan diturunkan dari data lain. `action_items` menyimpan follow-up dengan due
date/owner/source, ditandai overdue kalau `due_date` sudah lewat dan `status` bukan
`done`. `document_types` (default: Project Charter, PRD, RNI) sama fleksibelnya dengan
`streams` — bisa ditambah/diganti nama/diarsipkan dari `/documents` tanpa ubah kode;
`document_checklist` menyimpan status tiap kombinasi initiative × document type (kalau
belum ada baris, dianggap "Belum mulai").
