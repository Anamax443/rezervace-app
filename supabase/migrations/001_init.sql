-- ============================================================
-- 001_init.sql
-- Rezervační systém – základní schéma
-- Projekt: arcutrsftxarurghmtqj.supabase.co
-- ============================================================

-- ── EXTENSIONS ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ── ENUM TYPY ────────────────────────────────────────────────
create type user_role as enum ('superadmin', 'admin', 'keyuser');
create type tenant_plan as enum ('trial', 'monthly', 'annual', 'individual', 'none');
create type tenant_status as enum ('active', 'trial', 'grace', 'expired', 'deactivated');
create type akce_typ as enum ('přednáška', 'koncert', 'degustace', 'jiné');
create type rezervace_stav as enum ('čeká', 'zaplaceno_qr', 'zaplaceno_hotově', 'zrušeno');

-- ── TENANTS ──────────────────────────────────────────────────
create table public.tenants (
  id                uuid primary key default uuid_generate_v4(),
  nazev             text not null,
  subdomain         text not null unique,           -- firma (→ pages.dev/firma)
  logo_url          text,
  fio_api_token     text,                           -- AES-256 šifrovaný
  fio_ucet          text,                           -- číslo účtu pro QR platby
  plan              tenant_plan not null default 'trial',
  plan_status       tenant_status not null default 'trial',
  plan_cena         numeric(10,2),                  -- null = globální cena, číslo = individuální
  plan_poznamka     text,                           -- interní poznámka superadmina
  plan_zacatek      timestamptz,
  plan_expirace     timestamptz,
  trial_vyuzit      boolean not null default false, -- nelze spustit trial podruhé
  aktivni           boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── PROFILES ─────────────────────────────────────────────────
-- Rozšíření auth.users – role a tenant přiřazení
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  tenant_id         uuid references public.tenants(id) on delete cascade,
                    -- NULL pro superadmina
  role              user_role not null,
  jmeno             text,
  aktivni           boolean not null default true,
  mfa_vynuceno      boolean not null default true,
  first_login       boolean not null default true,  -- vynutí změnu hesla při prvním přihlášení
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── AKCE ─────────────────────────────────────────────────────
create table public.akce (
  id                uuid primary key default uuid_generate_v4(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  nazev             text not null,
  typ               akce_typ not null default 'přednáška',
  datum             date not null,
  cas_zacatek       time not null,
  cas_konec         time,                           -- volitelné
  kapacita          integer not null check (kapacita > 0),
  ma_sezeni         boolean not null default false,
  cena              numeric(10,2) not null check (cena >= 0),
  popis             text,
  image_path        text,                           -- cesta v Supabase Storage
  aktivni           boolean not null default false, -- false = draft
  vytvoril_id       uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── REZERVACE ────────────────────────────────────────────────
create table public.rezervace (
  id                uuid primary key default uuid_generate_v4(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  akce_id           uuid not null references public.akce(id) on delete restrict,
  vs                bigint not null unique,         -- variabilní symbol pro platbu
  jmeno             text,                           -- volitelné
  email             text not null,
  pocet_mist        integer not null check (pocet_mist > 0),
  celkova_castka    numeric(10,2) not null,
  stav              rezervace_stav not null default 'čeká',
  vstupenka_token   uuid not null default uuid_generate_v4(), -- QR kód vstupenky
  vstupenka_pouzita boolean not null default false,
  datum_rezervace   timestamptz not null default now(),
  datum_platby      timestamptz,
  upravil_id        uuid references auth.users(id), -- kdo naposledy editoval
  poznamka          text,                           -- interní poznámka key usera
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── BILLING LOG ──────────────────────────────────────────────
create table public.billing_log (
  id                uuid primary key default uuid_generate_v4(),
  tenant_id         uuid references public.tenants(id) on delete set null,
  udalost           text not null,                 -- "platba_prijata", "email_odeslán", "deaktivace"...
  castka            numeric(10,2),
  vs                text,
  poznamka          text,
  provedl_id        uuid references auth.users(id), -- null = systém (cron)
  created_at        timestamptz not null default now()
);

-- ── VS SEKVENCE ───────────────────────────────────────────────
-- Variabilní symboly rezervací začínají od 100001
create sequence if not exists vs_rezervace_seq start 100001 increment 1;

-- ── UPDATED_AT TRIGGER ───────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tenants_updated_at   before update on public.tenants   for each row execute function update_updated_at();
create trigger profiles_updated_at  before update on public.profiles  for each row execute function update_updated_at();
create trigger akce_updated_at      before update on public.akce      for each row execute function update_updated_at();
create trigger rezervace_updated_at before update on public.rezervace for each row execute function update_updated_at();

-- ── INDEXY ───────────────────────────────────────────────────
create index idx_akce_tenant_id      on public.akce(tenant_id);
create index idx_akce_datum          on public.akce(datum);
create index idx_akce_aktivni        on public.akce(aktivni);
create index idx_rezervace_tenant_id on public.rezervace(tenant_id);
create index idx_rezervace_akce_id   on public.rezervace(akce_id);
create index idx_rezervace_vs        on public.rezervace(vs);
create index idx_rezervace_stav      on public.rezervace(stav);
create index idx_profiles_tenant_id  on public.profiles(tenant_id);
create index idx_billing_tenant_id   on public.billing_log(tenant_id);
create index idx_tenants_subdomain   on public.tenants(subdomain);

-- ── VOLNÁ MÍSTA – COMPUTED VIEW ──────────────────────────────
create or replace view public.akce_obsazenost as
select
  a.id,
  a.tenant_id,
  a.nazev,
  a.typ,
  a.datum,
  a.cas_zacatek,
  a.cas_konec,
  a.kapacita,
  a.cena,
  a.ma_sezeni,
  a.popis,
  a.image_path,
  a.aktivni,
  coalesce(sum(r.pocet_mist) filter (where r.stav in ('čeká','zaplaceno_qr','zaplaceno_hotově')), 0)::integer as obsazeno,
  (a.kapacita - coalesce(sum(r.pocet_mist) filter (where r.stav in ('čeká','zaplaceno_qr','zaplaceno_hotově')), 0))::integer as volno
from public.akce a
left join public.rezervace r on r.akce_id = a.id
group by a.id;

-- ── SUPABASE STORAGE BUCKET ──────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'akce-obrazky',
  'akce-obrazky',
  true,                          -- veřejné čtení (obrázky na webu)
  5242880,                       -- max 5 MB
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

-- ============================================================
-- Hotovo! Pokračuj s 002_rls.sql
-- ============================================================