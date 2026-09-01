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
| **Pelapor (User)** | Membuat tiket baru, memilih perusahaan & kategori masalah (bisa disimpan sebagai perusahaan default pribadi), melihat status tiket miliknya, menambahkan catatan tambahan |
| **Tim Support** | Melihat tiket dari perusahaan & kategori yang menjadi akses pengguna tsb (diatur Super Admin), filter & pencarian, mengubah status, menugaskan ke diri sendiri/rekan, mencatat riwayat perbaikan |
| **Supervisor** | Semua kemampuan Support (bisa ikut melaporkan tiket baru, melihat tiket buatannya sendiri di menu **Tiket Saya**, & melakukan perbaikan) **ditambah** Dashboard Laporan & Analitik dengan filter periode tanggal & perusahaan (bisa disimpan sebagai tampilan default pribadi), grafik per status/kategori/perusahaan, rata-rata waktu penyelesaian, tabel detail yang bisa diklik untuk lihat isi & riwayat tanggapan tiket, dan ekspor CSV |
| **Super Admin** | Semua kemampuan Supervisor **ditambah** Administrasi Pengguna (tambah, edit, ganti password, hapus, ubah role, atur akses perusahaan & kategori) dan **Kontak Support** (nomor WhatsApp per kombinasi perusahaan+kategori) — satu-satunya peran yang bisa mengelola akun pengguna lain, dan satu-satunya yang TIDAK dibatasi akses perusahaan/kategori (selalu melihat semua) |

**Akses perusahaan & kategori per pengguna**: setiap akun (peran apa pun) hanya melihat &
bisa membuat tiket untuk perusahaan/kategori yang menjadi aksesnya — diatur Super Admin
lewat tombol **"Kelola Akses"** di Administrasi Pengguna. Satu akun bisa dikaitkan ke lebih
dari satu perusahaan/kategori. Default untuk akun baru:
- **Perusahaan**: hanya perusahaan yang dipilih sebagai "Perusahaan Default" saat
  mendaftar sendiri lewat `/register` (kalau dibuat Super Admin lewat "+ Tambah Pengguna",
  fallback ke SEMUA perusahaan karena form itu tidak meminta pilihan default).
- **Kategori**: selalu SEMUA kategori terpilih.

Super Admin bisa mengubah keduanya kapan pun lewat "Kelola Akses" — pengaturan itu selalu
menggantikan (bukan sekadar menambah) apa pun yang di-set otomatis saat pendaftaran.

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

1. **Daftar** akun pertama lewat halaman Daftar (otomatis jadi Pelapor, dengan akses ke
   SEMUA perusahaan & kategori secara default — lihat Bagian 7 soal cara mempersempitnya).
   Form Daftar juga meminta **Perusahaan Default** — sekadar untuk mengisi otomatis pilihan
   perusahaan saat membuat tiket, bisa diubah kapan pun.
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

## 8. Akses Perusahaan & Kategori per Pengguna

Setiap akun (peran apa pun kecuali Super Admin) hanya bisa **melihat** tiket dan **membuat**
tiket baru untuk perusahaan/kategori yang menjadi aksesnya. Ini diatur lewat tabel
penghubung `user_companies` dan `user_categories` — satu akun bisa dikaitkan ke lebih dari
satu perusahaan dan/atau kategori sekaligus.

**Cara mengatur — lewat aplikasi, sebagai Super Admin, di menu Administrasi Pengguna:**
klik tombol **"Kelola Akses"** di baris pengguna yang dituju → centang perusahaan &
kategori yang boleh dilihat pengguna tsb (ada tombol "Pilih Semua" / "Kosongkan" di
masing-masing) → **Simpan Akses**. Perubahan berlaku **langsung** (real-time, tidak perlu
logout/login), karena kebijakan RLS membaca tabel penghubung ini langsung dari database.

**Aturan visibilitas:**
- Kalau pengguna hanya dikaitkan ke **satu** perusahaan → hanya tiket perusahaan itu yang
  terlihat (di Antrian Support, Laporan & Analitik, dan pilihan saat Buat Tiket).
- Kalau dikaitkan ke **beberapa** perusahaan → tiket dari perusahaan-perusahaan itu saja
  yang terlihat.
- Sama persis untuk kategori — kombinasi perusahaan **dan** kategori sama-sama harus cocok
  agar sebuah tiket terlihat oleh pengguna staf tsb.
- **Super Admin selalu melihat semua**, terlepas dari tabel penghubung ini.
- Tiket milik sendiri (di menu **Tiket Saya**, berdasarkan siapa pelapornya) selalu terlihat
  pemiliknya tanpa dibatasi tabel ini — pembatasan hanya berlaku untuk melihat tiket *milik
  orang lain* di Antrian Support / Laporan & Analitik.

**Default**:
- **Daftar sendiri lewat `/register`**: akses perusahaan langsung dipersempit ke HANYA
  perusahaan yang dipilih di kolom "Perusahaan Default" pada form Daftar — bukan semua
  perusahaan. Kategori tetap default SEMUA.
- **Dibuat Super Admin lewat "+ Tambah Pengguna"**: karena form itu tidak meminta pilihan
  perusahaan, akun baru mendapat akses ke SEMUA perusahaan & SEMUA kategori sebagai default
  aman — Super Admin lalu mempersempitnya lewat "Kelola Akses" sesuai kebutuhan.

## 9. Notifikasi WhatsApp ke Support (Kontak Support)

Begitu tiket baru berhasil disimpan, aplikasi otomatis membuka WhatsApp (aplikasi di HP,
atau WhatsApp Web/Desktop di laptop) di tab baru, dengan pesan **sudah terisi otomatis**:
nomor tiket, judul, perusahaan, prioritas, dan deskripsi lengkap. Pengguna tetap perlu
**klik "Kirim" secara manual** di WhatsApp — ini bukan keterbatasan implementasi, tapi cara
kerja dasar tautan `wa.me`: WhatsApp sengaja tidak mengizinkan pesan terkirim otomatis tanpa
sentuhan manusia (mencegah penyalahgunaan untuk spam). Pendekatan ini sepenuhnya **gratis**,
tidak seperti WhatsApp Business API resmi yang berbayar per pesan untuk notifikasi
bisnis-ke-pengguna.

**Nomor tujuannya ditentukan otomatis** dari kombinasi **perusahaan + kategori** tiket yang
baru dibuat, lewat menu **Kontak Support** (khusus Super Admin) — satu baris di sana berarti
satu penanggung jawab untuk satu kombinasi perusahaan+kategori tertentu. Satu perusahaan bisa
punya kontak berbeda untuk kategori berbeda (mis. kontak IT terpisah dari kontak fasilitas
gedung). Kalau kombinasi perusahaan+kategori suatu tiket belum punya kontak terdaftar,
aplikasi diam-diam tidak membuka WhatsApp — pembuatan tiket tetap berhasil normal.

**Kontak Support TIDAK menyimpan nomor WhatsApp sendiri** — setiap baris di sana WAJIB
ditautkan ke akun pengguna terdaftar (dropdown **"Pengguna Penanggung Jawab"**, hanya
menampilkan akun dengan role **Tim Support, Supervisor, atau Super Admin**). Nomor yang
dipakai untuk notifikasi SELALU diambil langsung & real-time dari kolom Nomor WhatsApp di
profil pengguna itu — kalau nomornya berubah nanti (lewat Administrasi Pengguna), kontak
support otomatis ikut ter-update tanpa perlu diedit ulang di menu Kontak Support.

Daftar kontak diurutkan **Perusahaan → Kategori → Nama Kontak**, dan bisa disaring per
perusahaan lewat dropdown filter di atas tabel. Saat memilih pengguna di form Tambah Kontak,
nomor WhatsApp-nya langsung ditampilkan sebagai pratinjau (atau peringatan kalau pengguna
tsb belum punya nomor tercatat) sebelum disimpan.

> **Catatan migrasi**: versi sebelumnya sempat mengizinkan mengisi nomor WhatsApp secara
> manual (tidak terikat akun), termasuk 18 kontak awal yang di-seed dari file Excel. Karena
> kolom nomor manual itu sudah dihapus dari database, kontak-kontak lama yang belum ditautkan
> ke akun pengguna akan tampil dengan badge **"Belum tertaut"** dan nomornya kosong — perlu
> ditautkan ulang lewat tombol **Edit** ke akun pengguna yang sesuai (buatkan dulu akunnya di
> Administrasi Pengguna kalau belum ada) supaya notifikasi WhatsApp untuk kombinasi itu
> berfungsi lagi.

**Notifikasi WhatsApp saat progress tiket diperbarui** (bukan cuma saat tiket dibuat): begitu
Support/Supervisor/Super Admin menyimpan perubahan di form "Perbarui Tiket" (ubah status,
penugasan, atau catatan perbaikan), WhatsApp juga otomatis terbuka dengan pesan berisi status
terbaru & catatan — dengan aturan penerima:
- Kalau **nama pengguna yang login sama dengan nama pelapor tiket** (mis. Supervisor
  mengelola tiket buatannya sendiri) → dikirim ke **PIC yang ditugaskan**.
- Kalau **berbeda** (staf mengelola tiket milik orang lain — kasus paling umum) → dikirim ke
  **pelapor**, sebagai notifikasi progress.

Nomor yang dipakai di sini diambil dari kolom Nomor WhatsApp di profil pelapor/PIC tsb
langsung (bukan dari Kontak Support) — kalau pihak yang dituju belum punya nomor WhatsApp
tercatat, aplikasi diam-diam tidak membuka WhatsApp (perubahan tetap tersimpan normal). Pesan
WhatsApp (baik saat tiket dibuat maupun saat diperbarui) selalu menyertakan nama pelapor dan
nama PIC yang ditugaskan, di samping nomor tiket, judul, perusahaan, & status.

Tersedia juga tombol **"Kirim Ulang via WhatsApp"** di form Perbarui Tiket — mengirim ulang
notifikasi memakai status tiket yang **sudah tersimpan** (bukan draft yang belum disimpan),
tanpa perlu mengubah apa pun dulu. Berguna kalau tab WhatsApp sebelumnya tertutup tanpa
sengaja, atau ingin menotifikasi ulang.

## 10. Catatan Keamanan untuk Produksi

- Aktifkan **Confirm email** di Supabase agar alamat email pelapor terverifikasi.
- Pertimbangkan menonaktifkan pendaftaran umum (`/register`) dan membuat seluruh akun staf
  lewat menu Administrasi Pengguna saja, jika akses harus tertutup untuk karyawan tertentu.
- Kategori akun baru selalu default SEMUA (lihat Bagian 8) — pertimbangkan meninjau &
  mempersempit akses kategori tiap akun staf lewat "Kelola Akses" setelah dibuat.
- Tinjau kembali kebijakan Row Level Security (`supabase/schema.sql`) apabila ada kebutuhan
  akses lain di luar kombinasi perusahaan+kategori yang sudah ada.

---

## 11. Kustomisasi

- **Menambah/ubah perusahaan atau kategori**: edit langsung lewat Supabase Table Editor
  pada tabel `companies` / `categories`, atau jalankan `INSERT` SQL tambahan.
- **Warna & identitas visual**: token warna ada di `tailwind.config.js` (grup warna
  `brand`), font diatur lewat Google Fonts di `index.html`.
- **Menambah field pada tiket** (mis. lampiran foto): tambahkan kolom baru di tabel
  `tickets` lewat SQL, lalu perbarui form di `src/pages/NewTicket.jsx` dan tampilan di
  `src/pages/TicketDetail.jsx`.
