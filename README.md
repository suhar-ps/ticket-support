# TiketPro — Sistem Ticketing Support Perusahaan

Aplikasi web untuk pelaporan dan pelacakan gangguan **aset komputer, kendaraan operasional,
dan fasilitas gedung**, dengan tiga peran: **Pelapor (User)**, **Tim Support**, dan **Supervisor**.

Stack: **React + Vite + Tailwind CSS** (frontend, di-hosting di **Netlify**) dan
**Supabase** (database PostgreSQL + Autentikasi + Row Level Security).

> Kenapa Supabase? Netlify sendiri tidak menyediakan database relasional. Supabase adalah
> layanan Postgres terkelola dengan tingkat gratis yang cukup untuk kebutuhan ini, dan
> terintegrasi mulus dengan frontend yang di-hosting di Netlify — ini kombinasi standar
> untuk kasus seperti ini.

---

## 1. Fitur per Peran

| Peran | Fitur |
|---|---|
| **Pelapor (User)** | Membuat tiket baru, memilih perusahaan & kategori masalah, melihat status tiket miliknya, menambahkan catatan tambahan |
| **Tim Support** | Melihat semua tiket dari semua perusahaan, filter & pencarian, mengubah status, menugaskan ke diri sendiri/rekan, mencatat riwayat perbaikan |
| **Supervisor** | Dashboard laporan (grafik per status/kategori/perusahaan, rata-rata waktu penyelesaian), tabel detail, ekspor CSV — akses baca saja |

**Perusahaan** yang sudah tersedia: PT SAS International, PT Petrindo Semesta, PT Sarana
Instrument, PT Omni Composite Solutions, PT Mika Tunggal, PT Agora.

**Kategori masalah**: Hardware, Software, Network & Infrastructure, Facilities &
Maintenance, Housekeeping & Environment, Security & Access Control.

---

## 2. Struktur Proyek

```
ticketing-app/
├── supabase/
│   └── schema.sql          ← Jalankan sekali di Supabase SQL Editor
├── src/
│   ├── lib/supabaseClient.js
│   ├── context/AuthContext.jsx
│   ├── components/         ← Layout, badge status/prioritas, kartu tiket, dll.
│   ├── pages/               ← Login, Register, Dashboard per role, Detail Tiket
│   └── data/constants.js
├── netlify.toml
├── .env.example
└── package.json
```

---

## 3. Setup Database (Supabase)

1. Buat akun & project baru di [supabase.com](https://supabase.com) (gratis).
2. Di dashboard project, buka **SQL Editor → New query**.
3. Salin seluruh isi file `supabase/schema.sql`, tempel, lalu klik **Run**.
   Ini akan membuat seluruh tabel, data perusahaan & kategori, serta aturan keamanan
   (Row Level Security) yang membatasi akses data sesuai peran.
4. Buka **Authentication → Providers**, pastikan **Email** aktif.
   - Untuk demo/testing cepat, Anda bisa menonaktifkan **"Confirm email"** agar akun baru
     langsung bisa login tanpa perlu klik link verifikasi.
5. Buka **Project Settings → API**, catat dua nilai berikut untuk langkah selanjutnya:
   - **Project URL**
   - **anon public key**

---

## 4. Menjalankan di Komputer Lokal (opsional, untuk uji coba sebelum deploy)

```bash
npm install
cp .env.example .env
# lalu isi .env dengan Project URL & anon key dari Supabase

npm run dev
```

Buka `http://localhost:5173`, klik **Daftar**, buat akun untuk masing-masing peran
(Pelapor, Support, Supervisor) agar bisa mencoba ketiga sisi aplikasi.

---

## 5. Deploy ke Netlify

### Opsi A — Lewat Git (disarankan)

1. Push folder proyek ini ke repository GitHub/GitLab/Bitbucket Anda.
2. Di [app.netlify.com](https://app.netlify.com), klik **Add new site → Import an existing
   project**, pilih repository tersebut.
3. Netlify otomatis mendeteksi pengaturan dari `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Sebelum klik **Deploy**, buka **Add environment variables** dan tambahkan:
   - `VITE_SUPABASE_URL` = Project URL Supabase Anda
   - `VITE_SUPABASE_ANON_KEY` = anon public key Supabase Anda
5. Klik **Deploy site**. Setelah selesai, Anda akan mendapat URL publik (misalnya
   `nama-anda.netlify.app`), dan bisa mengganti domain kustom di **Site settings →
   Domain management**.

### Opsi B — Netlify CLI

```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

Jangan lupa set environment variable di dashboard Netlify (**Site settings → Environment
variables**) sebelum atau setelah deploy, lalu **trigger deploy ulang** agar terbaca.

> Catatan: karena aplikasi ini adalah *Single Page Application*, file `netlify.toml` sudah
> berisi aturan redirect agar refresh halaman (mis. `/tickets/abc123`) tidak menghasilkan 404.

---

## 6. Alur Penggunaan Cepat

1. **Daftar** sebagai Pelapor → pilih perusahaan → buat tiket baru (kategori, jenis aset,
   prioritas, deskripsi).
2. **Daftar akun kedua** sebagai Tim Support → login → tiket akan muncul di Antrian
   Support → ubah status (Baru → Sedang Dikerjakan → Selesai) dan tambahkan catatan
   perbaikan.
3. **Daftar akun ketiga** sebagai Supervisor → login → lihat grafik dan tabel laporan di
   seluruh perusahaan.

---

## 7. Catatan Keamanan untuk Produksi

Untuk mempermudah demo, halaman **Daftar** mengizinkan pengguna memilih perannya sendiri
(User / Support / Supervisor). Untuk penggunaan produksi sebaiknya:

- Set peran default seluruh akun baru menjadi `user` di database (`profiles.role`), lalu
  ubah menjadi `support` / `supervisor` secara manual melalui **Supabase Dashboard → Table
  Editor → profiles**, atau bangun panel admin terpisah.
- Aktifkan **Confirm email** di Supabase agar alamat email pelapor terverifikasi.
- Pertimbangkan menonaktifkan pendaftaran umum dan mengundang pengguna melalui
  **Authentication → Users → Invite user** jika akses harus tertutup untuk karyawan saja.
- Tinjau kembali kebijakan Row Level Security (`supabase/schema.sql`) apabila ada kebutuhan
  akses tambahan, misalnya supervisor per-perusahaan (bukan lintas semua perusahaan).

---

## 8. Kustomisasi

- **Menambah/ubah perusahaan atau kategori**: edit langsung lewat Supabase Table Editor
  pada tabel `companies` / `categories`, atau jalankan `INSERT` SQL tambahan.
- **Warna & identitas visual**: token warna ada di `tailwind.config.js` (grup warna
  `brand`), font diatur lewat Google Fonts di `index.html`.
- **Menambah field pada tiket** (mis. lampiran foto): tambahkan kolom baru di tabel
  `tickets` lewat SQL, lalu perbarui form di `src/pages/NewTicket.jsx` dan tampilan di
  `src/pages/TicketDetail.jsx`.
