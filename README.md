# FixHub — Sistem Ticketing Support Perusahaan

Aplikasi web untuk pelaporan dan pelacakan gangguan **aset komputer, kendaraan operasional,
dan fasilitas gedung**, dengan empat peran: **Pelapor (User)**, **Tim Support**,
**Supervisor**, dan **Super Admin**.

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
| **Supervisor** | Semua kemampuan Support (bisa ikut melaporkan tiket baru & melakukan perbaikan) **ditambah** Dashboard Laporan & Analitik dengan filter periode tanggal (grafik per status/kategori/perusahaan, rata-rata waktu penyelesaian), tabel detail yang bisa diklik untuk lihat isi & riwayat tanggapan tiket, dan ekspor CSV |
| **Super Admin** | Semua kemampuan Supervisor **ditambah** Administrasi Pengguna (tambah, edit, ganti password, hapus, ubah role) — satu-satunya peran yang bisa mengelola akun pengguna lain |

**Perusahaan** yang sudah tersedia: PT SAS International, PT Petrindo Semesta, PT Sarana
Instrument, PT Omni Composite Solutions, PT Mika Tunggal, PT Agora.

**Kategori masalah**: Hardware, Software, Network & Infrastructure, Facilities &
Maintenance, Housekeeping & Environment, Security & Access Control.

---

## 2. Struktur Proyek

```
fixhub-app/
├── public/
│   └── logo.png                      ← Logo aplikasi (favicon + header + login)
├── supabase/
│   ├── schema.sql                    ← Jalankan sekali (dan ulang tiap update) di SQL Editor
│   └── functions/
│       ├── admin-create-user/        ← Edge Function, deploy dengan Supabase CLI
│       └── admin-set-password/       ← Edge Function, deploy dengan Supabase CLI
├── src/
│   ├── lib/supabaseClient.js
│   ├── context/AuthContext.jsx
│   ├── components/         ← Layout, badge status/prioritas, kartu tiket, dll.
│   ├── pages/               ← Login, Register, Dashboard per role, Administrasi Pengguna, dll.
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
6. Buka **Authentication → URL Configuration**, tambahkan URL berikut ke **Redirect URLs**
   (dibutuhkan untuk fitur "Lupa Kata Sandi" agar tautan di email diizinkan mengarah balik
   ke aplikasi Anda):
   - `http://localhost:5173/reset-password` (untuk uji coba lokal)
   - `https://domain-netlify-anda.netlify.app/reset-password` (isi setelah situs Anda
     ter-deploy di Netlify; bisa ditambahkan belakangan)

### Edge Functions untuk fitur admin (opsional, tapi disarankan)

Mengubah role, mengedit nama, atau menghapus pengguna cukup lewat SQL biasa (sudah termasuk
dalam `schema.sql`). Tapi **membuat akun baru** dan **mengatur ulang password pengguna lain**
wajib lewat Admin API Supabase (bukan SQL biasa), sehingga butuh dua Edge Function:

```bash
npm install -g supabase
supabase login
supabase link --project-ref xxxxxxxxxxxx   # Project Ref ada di Project Settings > General
supabase functions deploy admin-create-user
supabase functions deploy admin-set-password
```

Tidak perlu mengatur secret apa pun — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan
`SUPABASE_SERVICE_ROLE_KEY` otomatis tersedia di setiap Edge Function. Jika langkah ini
dilewati, seluruh fitur lain tetap berjalan normal — hanya tombol **"+ Tambah Pengguna"**
dan **"Ganti Password"** di halaman Administrasi Pengguna yang akan menampilkan pesan bahwa
function terkait belum ter-deploy.

---

## 4. Menjalankan di Komputer Lokal (opsional, untuk uji coba sebelum deploy)

```bash
npm install
cp .env.example .env
# lalu isi .env dengan Project URL & anon key dari Supabase

npm run dev
```

Buka `http://localhost:5173` untuk mencoba aplikasi.

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

Pendaftaran publik (`/register`) selalu membuat akun dengan role **Pelapor** — tidak ada
pilihan role di form itu. Untuk mendapatkan akun Support/Supervisor/Super Admin:

1. **Daftar** akun pertama lewat halaman Daftar (otomatis jadi Pelapor).
2. **Angkat akun itu jadi Super Admin** satu kali lewat SQL Editor (lihat Bagian 7) — ini
   satu-satunya langkah manual yang dibutuhkan, untuk "membuka pintu" pertama kali.
3. **Login sebagai Super Admin** → buka menu **Administrasi Pengguna** → klik
   **"+ Tambah Pengguna"** untuk membuat akun Support/Supervisor/Super Admin lain langsung
   dari aplikasi, lengkap dengan password awal.
4. **Login sebagai Support** (atau Supervisor/Super Admin) → buat tiket lewat akun Pelapor
   mana pun → tiket langsung muncul di **Antrian Support** → ubah status & tambahkan
   catatan perbaikan.
5. **Login sebagai Supervisor** (atau Super Admin) → lihat grafik dan tabel laporan di menu
   **Laporan & Analitik**. Supervisor dan Super Admin juga punya akses ke **Buat Tiket** dan
   **Antrian Support**, jadi bisa ikut melaporkan masalah maupun menanganinya sendiri.

**Lupa kata sandi?** Ada dua jalur:
- **Self-service**: klik "Lupa kata sandi?" di halaman Masuk → masukkan email → klik tautan
  yang dikirim ke email tersebut → atur kata sandi baru.
- **Dibantu Super Admin**: Super Admin buka **Administrasi Pengguna** → klik **"Ganti
  Password"** di baris pengguna terkait → masukkan kata sandi baru untuknya langsung
  (berguna kalau pengguna tidak punya akses ke emailnya).

---

## 7. Cara Kerja Role & Cara Mengubahnya

Role pengguna disimpan di dua tempat yang saling sinkron: kolom `profiles.role` (dibaca
real-time untuk visibilitas & pengerjaan tiket, sehingga tiket langsung terlihat/bisa
dikerjakan tanpa perlu logout/login) dan klaim JWT `app_metadata` (dipakai khusus untuk
kebijakan tabel `profiles` itu sendiri, demi menghindari rekursi RLS).

**Sehari-hari — lewat aplikasi, sebagai Super Admin, di menu Administrasi Pengguna:**
- **Tambah**: tombol "+ Tambah Pengguna" (butuh Edge Function `admin-create-user` sudah
  ter-deploy, lihat Bagian 3).
- **Ubah role**: dropdown role di tiap baris (Pelapor / Support / Supervisor / Super Admin).
- **Edit nama**: tombol "Edit" di tiap baris.
- **Ganti password**: tombol "Ganti Password" di tiap baris (butuh Edge Function
  `admin-set-password` sudah ter-deploy, lihat Bagian 3) — berguna untuk pengguna yang lupa
  kata sandi tapi tidak punya akses ke email terdaftarnya.
- **Hapus**: tombol "Hapus" — ditolak dengan pesan yang jelas apabila pengguna tersebut
  masih memiliki riwayat tiket (sebagai pelapor atau petugas yang ditugaskan), supaya
  riwayat tiket tidak pernah hilang tanpa sengaja.

Halaman Administrasi Pengguna **hanya bisa diakses oleh Super Admin** — Supervisor tidak
lagi punya akses ke menu ini (dipindahkan sepenuhnya ke Super Admin).

**Bootstrap Super Admin pertama** (belum ada Super Admin sama sekali, jadi belum ada yang
bisa membuka halaman Administrasi Pengguna): jalankan sekali lewat **SQL Editor**:

```sql
select public.set_user_role('uuid-user-yang-dituju', 'superadmin');
```

Cara mendapatkan UUID: buka **Authentication → Users** di Supabase Dashboard, atau jalankan
`select id, email from auth.users;` di SQL Editor.

Setelah role seseorang diubah (baik lewat aplikasi maupun SQL), minta orang tersebut
**logout lalu login lagi** (atau tunggu refresh token otomatis, biasanya kurang dari 1 jam)
supaya JWT barunya membawa klaim role yang baru — ini memengaruhi kemampuan melihat daftar
profil pengguna lain (mis. dropdown "Ditugaskan ke"), meski visibilitas tiket sendiri sudah
langsung berubah tanpa perlu itu.

## 8. Catatan Keamanan untuk Produksi

- Aktifkan **Confirm email** di Supabase agar alamat email pelapor terverifikasi.
- Pertimbangkan menonaktifkan pendaftaran umum (`/register`) dan membuat seluruh akun staf
  lewat menu Administrasi Pengguna saja, jika akses harus tertutup untuk karyawan tertentu.
- Tinjau kembali kebijakan Row Level Security (`supabase/schema.sql`) apabila ada kebutuhan
  akses tambahan, misalnya supervisor per-perusahaan (bukan lintas semua perusahaan).

---

## 9. Kustomisasi

- **Menambah/ubah perusahaan atau kategori**: edit langsung lewat Supabase Table Editor
  pada tabel `companies` / `categories`, atau jalankan `INSERT` SQL tambahan.
- **Warna & identitas visual**: token warna ada di `tailwind.config.js` (grup warna
  `brand`), font diatur lewat Google Fonts di `index.html`.
- **Menambah field pada tiket** (mis. lampiran foto): tambahkan kolom baru di tabel
  `tickets` lewat SQL, lalu perbarui form di `src/pages/NewTicket.jsx` dan tampilan di
  `src/pages/TicketDetail.jsx`.
