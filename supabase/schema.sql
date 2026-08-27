-- =====================================================================
-- TiketPro — Skema Database (Supabase / PostgreSQL)
-- Jalankan SELURUH file ini di Supabase Dashboard > SQL Editor > New Query
-- Aman dijalankan berkali-kali (idempotent). Dibungkus dalam satu
-- transaksi (begin...commit) agar TIDAK bisa tersimpan sebagian saja
-- apabila ada satu statement yang gagal.
-- =====================================================================

begin;

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('user', 'support', 'supervisor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_status as enum ('open', 'in_progress', 'pending', 'resolved', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_priority as enum ('low', 'medium', 'high', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type asset_type as enum ('computer', 'vehicle', 'building', 'other');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- MASTER DATA: PERUSAHAAN
-- ---------------------------------------------------------------------
create table if not exists companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique
);

insert into companies (name) values
  ('PT SAS International'),
  ('PT Petrindo Semesta'),
  ('PT Sarana Instrument'),
  ('PT Omni Composite Solutions'),
  ('PT Mika Tunggal'),
  ('PT Agora')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- MASTER DATA: KATEGORI MASALAH
-- ---------------------------------------------------------------------
create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique
);

insert into categories (name) values
  ('Hardware'),
  ('Software'),
  ('Network & Infrastructure'),
  ('Facilities & Maintenance'),
  ('Housekeeping & Environment'),
  ('Security & Access Control')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- PROFILES (1:1 dengan auth.users, menyimpan role & perusahaan)
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'user',
  company_id uuid references companies(id),
  phone text,
  created_at timestamptz default now()
);

-- Pastikan RLS tidak "dipaksakan" ke pemilik tabel (default Postgres
-- memang begini, baris ini hanya menjamin eksplisit).
alter table profiles no force row level security;

-- ---------------------------------------------------------------------
-- TICKETS
-- ---------------------------------------------------------------------
create sequence if not exists ticket_seq start 1;

create table if not exists tickets (
  id uuid primary key default uuid_generate_v4(),
  ticket_number text unique not null
    default ('TKT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('ticket_seq')::text, 5, '0')),
  title text not null,
  description text not null,
  category_id uuid references categories(id) not null,
  company_id uuid references companies(id) not null,
  asset_type asset_type not null default 'other',
  asset_identifier text,
  location text,
  priority ticket_priority not null default 'medium',
  status ticket_status not null default 'open',
  created_by uuid references profiles(id) not null,
  assigned_to uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_tickets_created_by on tickets(created_by);
create index if not exists idx_tickets_status on tickets(status);
create index if not exists idx_tickets_company on tickets(company_id);
create index if not exists idx_tickets_category on tickets(category_id);

-- ---------------------------------------------------------------------
-- TICKET_UPDATES (log aktivitas / catatan perbaikan)
-- ---------------------------------------------------------------------
create table if not exists ticket_updates (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid references tickets(id) on delete cascade not null,
  user_id uuid references profiles(id) not null,
  note text,
  status_from ticket_status,
  status_to ticket_status,
  created_at timestamptz not null default now()
);

create index if not exists idx_ticket_updates_ticket on ticket_updates(ticket_id);

-- ---------------------------------------------------------------------
-- TRIGGER: auto-update updated_at & resolved_at pada tickets
-- ---------------------------------------------------------------------
create or replace function set_ticket_timestamps()
returns trigger as $$
begin
  new.updated_at = now();
  if new.status = 'resolved' and (old.status is distinct from 'resolved') then
    new.resolved_at = now();
  end if;
  if new.status <> 'resolved' then
    new.resolved_at = null;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_ticket_timestamps on tickets;
create trigger trg_set_ticket_timestamps
before update on tickets
for each row execute function set_ticket_timestamps();

-- =====================================================================
-- ROW LEVEL SECURITY
--
-- CATATAN PENTING soal desain: kebijakan tabel `profiles` terhadap
-- DIRINYA SENDIRI tidak pernah meng-query tabel profiles dalam bentuk
-- apa pun (baik subquery langsung maupun lewat fungsi) — dibaca dari
-- klaim JWT (`auth.jwt() -> 'app_metadata'`) sebagai gantinya. Ini
-- membuat "infinite recursion detected in policy for relation profiles"
-- SECARA STRUKTURAL tidak mungkin terjadi lagi.
--
-- Untuk tabel LAIN (tickets, ticket_updates) yang perlu tahu role user,
-- kita tetap boleh meng-query tabel profiles langsung — itu tidak
-- rekursif karena tabelnya berbeda — sehingga hasilnya selalu real-time
-- tanpa perlu user logout/login ulang setelah role-nya berubah.
-- =====================================================================

drop policy if exists "staff read all profiles" on profiles;
drop policy if exists "staff read all tickets" on tickets;
drop policy if exists "support update tickets" on tickets;
drop policy if exists "insert ticket update" on ticket_updates;
drop policy if exists "read ticket updates" on ticket_updates;
drop function if exists public.current_user_role();

-- Dipakai HANYA oleh kebijakan tabel profiles terhadap dirinya sendiri.
-- Baca dari klaim JWT (bukan query ke tabel profiles) sehingga TIDAK
-- mungkin memicu rekursi. Konsekuensinya: perubahan role baru berlaku
-- penuh di sini setelah user yang bersangkutan logout/login ulang.
create or replace function public.jwt_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'user');
$$;

grant execute on function public.jwt_role() to authenticated, anon;

-- Dipakai oleh kebijakan tabel LAIN (tickets, ticket_updates) yang perlu
-- tahu role user. Karena fungsi ini query ke tabel profiles TAPI dipasang
-- di kebijakan tabel yang BERBEDA (bukan profiles), ini tidak berisiko
-- rekursi sama sekali — dan hasilnya selalu real-time dari database,
-- tanpa perlu user logout/login ulang setelah role-nya diubah. Inilah
-- yang dipakai supaya tiket buatan pelapor langsung terlihat oleh
-- Support begitu role Support diaktifkan, tanpa harus re-login.
create or replace function public.current_user_role()
returns user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

grant execute on function public.current_user_role() to authenticated;

alter table companies enable row level security;
alter table categories enable row level security;
alter table profiles enable row level security;
alter table tickets enable row level security;
alter table ticket_updates enable row level security;

-- Master data: bisa dibaca semua user yang sudah login
drop policy if exists "read companies" on companies;
create policy "read companies" on companies for select using (auth.role() = 'authenticated');

drop policy if exists "read categories" on categories;
create policy "read categories" on categories for select using (auth.role() = 'authenticated');

-- Profiles
drop policy if exists "read own profile" on profiles;
create policy "read own profile" on profiles for select using (auth.uid() = id);

create policy "staff read all profiles" on profiles for select using (
  public.jwt_role() in ('support', 'supervisor')
);

drop policy if exists "insert own profile" on profiles;
create policy "insert own profile" on profiles for insert with check (auth.uid() = id);

drop policy if exists "update own profile" on profiles;
create policy "update own profile" on profiles for update using (auth.uid() = id);

-- Tickets
drop policy if exists "user insert own ticket" on tickets;
create policy "user insert own ticket" on tickets for insert with check (created_by = auth.uid());

drop policy if exists "user read own ticket" on tickets;
create policy "user read own ticket" on tickets for select using (created_by = auth.uid());

create policy "staff read all tickets" on tickets for select using (
  public.current_user_role() in ('support', 'supervisor')
);

create policy "support update tickets" on tickets for update using (
  public.current_user_role() = 'support'
);

-- Ticket updates (log)
create policy "insert ticket update" on ticket_updates for insert with check (
  user_id = auth.uid() and (
    exists (select 1 from tickets t where t.id = ticket_id and t.created_by = auth.uid())
    or public.current_user_role() in ('support', 'supervisor')
  )
);

create policy "read ticket updates" on ticket_updates for select using (
  exists (select 1 from tickets t where t.id = ticket_id and t.created_by = auth.uid())
  or public.current_user_role() in ('support', 'supervisor')
);

-- ---------------------------------------------------------------------
-- PEMBUATAN PROFIL OTOMATIS + SINKRONISASI ROLE KE JWT
-- Saat user baru mendaftar: (1) buat baris di public.profiles, dan
-- (2) salin role ke auth.users.raw_app_meta_data supaya ikut terbawa
-- ke dalam JWT saat mereka login. Trigger ini berjalan langsung ketika
-- baris dibuat di auth.users — TIDAK terpengaruh status "Confirm email".
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  the_role text := coalesce(new.raw_user_meta_data ->> 'role', 'user');
begin
  insert into public.profiles (id, full_name, role, company_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    the_role::user_role,
    nullif(new.raw_user_meta_data ->> 'company_id', '')::uuid
  )
  on conflict (id) do nothing;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', the_role)
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- FUNGSI ADMIN: ganti role seorang user dengan aman (mengubah profiles
-- DAN app_metadata sekaligus, supaya keduanya selalu sinkron).
--
-- Fungsi ini diberi izin EXECUTE ke role "authenticated" (supaya bisa
-- dipanggil dari halaman Administrasi Pengguna di aplikasi), TAPI di
-- dalam fungsi ini sendiri ada pengecekan: hanya pemanggil yang role-nya
-- 'supervisor' (dicek real-time dari database, bukan dari JWT) yang
-- benar-benar diizinkan melakukan perubahan. User lain yang mencoba
-- memanggil fungsi ini akan mendapat error.
-- ---------------------------------------------------------------------
create or replace function public.set_user_role(target_user_id uuid, new_role user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() <> 'supervisor' then
    raise exception 'Hanya Supervisor yang dapat mengubah role pengguna.';
  end if;

  update public.profiles set role = new_role where id = target_user_id;
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role::text)
  where id = target_user_id;
end;
$$;

grant execute on function public.set_user_role(uuid, user_role) to authenticated;

-- ---------------------------------------------------------------------
-- FUNGSI ADMIN: daftar seluruh pengguna (termasuk email, yang normalnya
-- tidak boleh dibaca langsung oleh client) untuk halaman Administrasi
-- Pengguna. Sama seperti di atas, dilindungi pengecekan role di dalam
-- fungsi — hanya Supervisor yang datanya benar-benar dikembalikan.
--
-- CATATAN: kolom auth.users.email bertipe "character varying", BUKAN
-- "text" — karena itu di-cast eksplisit (::text) di query. Tanpa cast
-- ini, Postgres akan menolak dengan error "structure of query does not
-- match function result type" walau terlihat sama-sama teks.
-- ---------------------------------------------------------------------
create or replace function public.list_users_for_admin()
returns table (
  id uuid,
  email text,
  full_name text,
  role user_role,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() <> 'supervisor' then
    raise exception 'Hanya Supervisor yang dapat melihat daftar pengguna.';
  end if;

  return query
    select p.id, u.email::text, p.full_name, p.role, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

grant execute on function public.list_users_for_admin() to authenticated;

-- ---------------------------------------------------------------------
-- FUNGSI ADMIN: ubah nama lengkap seorang pengguna.
-- ---------------------------------------------------------------------
create or replace function public.admin_update_profile(target_user_id uuid, new_full_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() <> 'supervisor' then
    raise exception 'Hanya Supervisor yang dapat mengedit pengguna.';
  end if;

  if new_full_name is null or trim(new_full_name) = '' then
    raise exception 'Nama lengkap tidak boleh kosong.';
  end if;

  update public.profiles set full_name = trim(new_full_name) where id = target_user_id;
end;
$$;

grant execute on function public.admin_update_profile(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- FUNGSI ADMIN: hapus akun pengguna sepenuhnya (auth.users + profiles,
-- profiles ikut terhapus lewat ON DELETE CASCADE). Supervisor tidak
-- dapat menghapus akunnya sendiri. Jika pengguna tersebut masih punya
-- riwayat tiket (sebagai pelapor atau petugas yang ditugaskan), hapus
-- akan ditolak dengan pesan yang jelas alih-alih error mentah dari
-- Postgres — supaya riwayat tiket tidak pernah hilang tanpa sengaja.
-- ---------------------------------------------------------------------
create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() <> 'supervisor' then
    raise exception 'Hanya Supervisor yang dapat menghapus pengguna.';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Anda tidak dapat menghapus akun Anda sendiri.';
  end if;

  begin
    delete from auth.users where id = target_user_id;
  exception when foreign_key_violation then
    raise exception 'Pengguna ini masih memiliki riwayat tiket (sebagai pelapor atau petugas), sehingga tidak dapat dihapus. Pindahkan/tutup dulu tiket terkait jika akun ini benar-benar perlu dihapus.';
  end;
end;
$$;

grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- BACKFILL (untuk akun yang sudah terlanjur terdaftar sebelum perbaikan
-- ini diterapkan):
--   1) Buatkan baris profiles bagi akun yang belum punya profil sama
--      sekali (mis. gagal tersimpan akibat bug RLS sebelumnya).
--   2) Salin role dari profiles ke app_metadata untuk SEMUA akun, agar
--      JWT mereka membawa klaim role yang benar.
-- ---------------------------------------------------------------------
insert into public.profiles (id, full_name, role)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
  'user'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

update auth.users u
set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', p.role::text)
from public.profiles p
where p.id = u.id;

commit;

-- =====================================================================
-- SELESAI. Langkah setelah menjalankan file ini:
--
-- 1) Aktifkan provider Email di Authentication > Providers.
-- 2) (Opsional, untuk testing cepat) matikan "Confirm email" di
--    Authentication > Providers > Email agar user langsung bisa login
--    tanpa verifikasi email dulu.
-- 3) Untuk mengangkat akun pertama menjadi Supervisor (supaya bisa
--    membuka halaman Administrasi Pengguna di aplikasi), jalankan satu
--    kali lewat SQL Editor:
--      select public.set_user_role('<uuid user>', 'supervisor');
--    Setelah itu, Supervisor bisa mengubah role pengguna lain langsung
--    dari halaman Administrasi Pengguna di aplikasi.
-- 4) PENTING: perubahan role pada TABEL tickets/ticket_updates langsung
--    berlaku real-time (tidak perlu logout/login). Tapi kemampuan
--    Support/Supervisor untuk melihat DAFTAR profil pengguna lain (mis.
--    dropdown "Ditugaskan ke") baru berlaku setelah pengguna yang
--    bersangkutan logout lalu login lagi (atau token-nya di-refresh
--    otomatis, biasanya < 1 jam).
-- 5) File ini AMAN dijalankan ulang berkali-kali (idempotent).
-- =====================================================================
