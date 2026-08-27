-- =====================================================================
-- TiketPro — Skema Database (Supabase / PostgreSQL)
-- Jalankan seluruh file ini di Supabase Dashboard > SQL Editor > New Query
-- =====================================================================

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
-- TRIGGER: auto-update updated_at & resolved_at
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

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
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

drop policy if exists "staff read all profiles" on profiles;
create policy "staff read all profiles" on profiles for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('support', 'supervisor'))
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

drop policy if exists "staff read all tickets" on tickets;
create policy "staff read all tickets" on tickets for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('support', 'supervisor'))
);

drop policy if exists "support update tickets" on tickets;
create policy "support update tickets" on tickets for update using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'support')
);

-- Ticket updates (log)
drop policy if exists "insert ticket update" on ticket_updates;
create policy "insert ticket update" on ticket_updates for insert with check (
  user_id = auth.uid() and (
    exists (select 1 from tickets t where t.id = ticket_id and t.created_by = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('support', 'supervisor'))
  )
);

drop policy if exists "read ticket updates" on ticket_updates;
create policy "read ticket updates" on ticket_updates for select using (
  exists (select 1 from tickets t where t.id = ticket_id and t.created_by = auth.uid())
  or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('support', 'supervisor'))
);

-- =====================================================================
-- SELESAI. Setelah menjalankan file ini:
-- 1) Aktifkan provider Email di Authentication > Providers.
-- 2) (Opsional, untuk testing cepat) matikan "Confirm email" di
--    Authentication > Providers > Email agar user langsung bisa login
--    tanpa verifikasi email dulu.
-- =====================================================================
