# Rezervace-app – Projektová dokumentace

**Verze:** 2.1
**Datum:** 20. března 2026
**Autor:** Milan Trnka (architekt a iniciátor projektu)
**Asistent:** Claude (Anthropic AI)

---

## Obsah

1. [Přehled projektu](#přehled-projektu)
2. [Architektura systému](#architektura-systému)
3. [Databáze – Supabase](#databáze--supabase)
4. [Cloudflare Workers](#cloudflare-workers)
5. [Frontend – Astro](#frontend--astro)
6. [Nasazení a infrastruktura](#nasazení-a-infrastruktura)
7. [Bezpečnost](#bezpečnost)
8. [Rozvojový plán](#rozvojový-plán)
9. [Přihlašovací údaje a secrets](#přihlašovací-údaje-a-secrets)

---

## Přehled projektu

**Rezervace-app** je multi-tenant SaaS rezervační systém pro kulturní akce (degustace vín, přednášky, koncerty apod.). Každý tenant (zákazník platformy) má vlastní subdoménu, správu akcí a rezervací s platební integrací přes Fio banku.

### Klíčové funkce

- Veřejný web pro zákazníky – seznam akcí, detail, rezervační formulář
- Platba bankovním převodem přes QR kód (Fio banka)
- Automatické párování plateb a generování vstupenek
- Multi-tenant architektura – jeden systém, více zákazníků
- Billing systém pro předplatné tenantů
- Admin konzole pro superadmin / admin / keyuser role
- Šifrované uložení API klíčů v DB (AES-256-GCM)
- Health monitoring 8 služeb v reálném čase

### Technologický stack

| Vrstva | Technologie | Popis |
|--------|-------------|-------|
| Databáze | Supabase (PostgreSQL) | Data, auth, storage |
| API Workers | Cloudflare Workers | TypeScript serverless funkce |
| Frontend + Admin | Astro 5 + Cloudflare Pages | Zákaznický web i admin konzole v jednom projektu |
| Email | Resend | Transakční emaily |
| Platby | Fio banka API | QR platby a párování |
| Repozitář | GitHub | `Anamax443/rezervace-app` |

---

## Architektura systému

```
┌─────────────────────────────────────────────────────┐
│                   ZÁKAZNÍK (prohlížeč)              │
│         rezervace-app.pages.dev/novak               │
└────────────────────┬────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────────┐
│            CLOUDFLARE PAGES (frontend)              │
│              Astro 5 – jeden projekt                │
│  /                  – landing page + admin rozcestník│
│  /login             – přihlášení do administrace    │
│  /superadmin/       – dashboard, tenants, users     │
│  /superadmin/system – health check + API klíče      │
│  /superadmin/event-log – audit log                  │
│  /admin/            – TODO                          │
│  /[subdomain]       – seznam akcí tenantu           │
│  /[subdomain]/akce/[id] – detail + rezervační form  │
└────────────────────┬────────────────────────────────┘
                     │ fetch()
┌────────────────────▼────────────────────────────────┐
│           CLOUDFLARE WORKERS (API)                  │
├─────────────────────────────────────────────────────┤
│  admin-api.bass443.workers.dev                      │
│    GET  /health                 – status workeru    │
│    GET  /superadmin/tenants     – seznam tenantů    │
│    GET  /superadmin/users       – seznam uživatelů  │
│    GET  /superadmin/event-log   – audit log         │
│    GET  /superadmin/system-check – health 8 služeb  │
│    POST /superadmin/test-api-key – test klíče       │
│    POST /superadmin/save-api-key – uložení klíče    │
│    GET  /superadmin/load-api-keys – metadata klíčů  │
│    GET  /admin/dashboard        – statistiky tenant │
│    GET  /admin/akce             – akce tenantu      │
│    GET  /admin/rezervace        – rezervace tenantu │
│    GET  /admin/users            – uživatelé tenantu │
│                                                     │
│  rezervace.bass443.workers.dev                      │
│    GET  /health                                     │
│    POST /rezervace      – vytvoření rezervace       │
│    GET  /vstupenka/:token – ověření vstupenky       │
│    POST /vstupenka/:token/pouzit – použití          │
│                                                     │
│  fio-polling.bass443.workers.dev  (cron */5 min)    │
│    GET  /health                                     │
│    – kontrola příchozích plateb zákazníků           │
│    – párování plateb s rezervacemi dle VS           │
│                                                     │
│  fio-billing.bass443.workers.dev  (cron */6 hod)    │
│    GET  /health                                     │
│    – kontrola plateb předplatného tenantů           │
│    – správa plan_status                             │
│                                                     │
│  image-optimizer.bass443.workers.dev                │
│    GET  /health                                     │
│    POST / – resize obrázků na 3 varianty (WebP)     │
└────────────────────┬────────────────────────────────┘
                     │ REST API
┌────────────────────▼────────────────────────────────┐
│              SUPABASE (backend)                     │
│  Project: arcutrsftxarurghmtqj.supabase.co          │
│                                                     │
│  PostgreSQL databáze + Row Level Security           │
│  Storage: akce-obrazky bucket                       │
│  Auth: uživatelé (superadmin, admin, keyuser)       │
└─────────────────────────────────────────────────────┘
```

---

## Databáze – Supabase

**Project URL:** `https://arcutrsftxarurghmtqj.supabase.co`

### Migrace

Soubory v `supabase/migrations/`:

| Soubor | Obsah |
|--------|-------|
| `001_init.sql` | Schéma tabulek |
| `002_rls.sql` | Row Level Security pravidla |
| `003_seed.sql` | Testovací data |

### Hlavní tabulky

**`tenants`** – zákazníci platformy
```
id, nazev, subdomain, fio_ucet, fio_api_token
plan, plan_status, plan_zacatek, plan_expirace
aktivni, logo_url
```

**`profily`** – uživatelé systému
```
id (FK → auth.users), tenant_id, role
(superadmin / admin / keyuser)
```

**`akce`** – kulturní akce tenantů
```
id, tenant_id, nazev, typ, datum, cas_zacatek, cas_konec
kapacita, cena, popis, ma_sezeni, image_path, aktivni
```

**`rezervace`** – rezervace zákazníků
```
id, tenant_id, akce_id, vs (variabilní symbol)
email, jmeno, pocet_mist, celkova_castka
stav: čeká / zaplaceno_qr / zrušeno
vstupenka_token, vstupenka_pouzita
datum_platby
```

**`billing_log`** – log plateb
```
id, tenant_id, typ, castka, vs, fio_id, poznamka
```

**`event_log`** – audit log událostí
```
id, tenant_id, kategorie (information/warning/error)
zprava, created_at
```

**`system_settings`** – šifrované API klíče (AES-256-GCM)
```
key TEXT PRIMARY KEY  (supabase / resend / fio / internal)
encrypted_value TEXT
iv TEXT
updated_at TIMESTAMPTZ
updated_by TEXT
```
RLS: přístup pouze přes service_role.

### Views

**`akce_obsazenost`** – akce s počtem volných míst
```sql
SELECT akce.*, (kapacita - COUNT(rezervace)) AS volno
```

### Testovací uživatelé

| Email | Role | UUID |
|-------|------|------|
| superadmin@maxferit.cz | superadmin | af1f34fd-6574-4b1b-ae56-62a56426ee71 |
| admin@maxferit.cz | admin | 6da9101e-544f-4333-be44-68307f01ad2f |
| keyuser@maxferit.cz | keyuser | e069485a-9f11-4c4a-b20d-27354a7c7411 |

**Testovací tenant:** Vinotéka Novák (`subdomain: novak`)

---

## Cloudflare Workers

### admin-api ← HLAVNÍ WORKER

**URL:** `https://admin-api.bass443.workers.dev`
**Složka:** `workers/admin-api/`

**Soubory:**
- `src/index.ts` – všechny endpointy (superadmin + admin)
- `src/auth.ts` – autentizace, role, Env interface
- `src/crypto.ts` – AES-256-GCM encrypt/decrypt

**Secrets (všechny nastaveny):**
- `SUPABASE_SERVICE_KEY`
- `INTERNAL_AUTH_TOKEN`
- `RESEND_API_KEY`
- `FIO_PLATFORM_TOKEN`
- `ENCRYPTION_KEY` (256-bit AES, base64)

**Čtení API klíčů – `resolveApiKeys()`:**

Worker čte klíče ze dvou zdrojů (priorita: DB > env):
1. Načte záznamy z `system_settings` (dešifruje AES-256-GCM)
2. Fallback na Cloudflare Worker Secrets (env proměnné)

**CORS:**
- Globální try-catch wrapper zajišťuje, že CORS hlavičky jsou vždy vráceny, i při nečekané chybě

**Auth flow:**
1. Client posílá Bearer JWT token
2. Worker ověří token přes Supabase Auth `/auth/v1/user`
3. Načte profil z `profiles` pomocí uživatelova JWT (ne service key!)
4. Service key nesetuje `auth.uid()` — RLS by selhalo

---

### fio-polling

**URL:** `https://fio-polling.bass443.workers.dev`
**Cron:** každých 5 minut (`*/5 * * * *`)
**Složka:** `workers/fio-polling/`

Logika: načte aktivní tenanty → Fio API → páruje VS s rezervacemi → aktualizuje stav na `zaplaceno_qr`.

Cron zároveň brání Supabase free tier pauzování (aktivita každých 5 min).

---

### fio-billing

**URL:** `https://fio-billing.bass443.workers.dev`
**Cron:** každých 6 hodin
**Složka:** `workers/fio-billing/`

Logika: kontrola expirací tenantů → upozornění emailem → grace period → deaktivace.

Páruje platby platformního Fio účtu: 490 Kč = monthly, 4 490 Kč = annual.

---

### rezervace

**URL:** `https://rezervace.bass443.workers.dev`
**Složka:** `workers/rezervace/`

| Metoda | Cesta | Popis |
|--------|-------|-------|
| GET | `/health` | Status workeru |
| POST | `/rezervace` | Vytvoření nové rezervace |
| GET | `/vstupenka/:token` | Detail vstupenky |
| POST | `/vstupenka/:token/pouzit` | Označení jako použitá |

---

### image-optimizer

**URL:** `https://image-optimizer.bass443.workers.dev`
**Složka:** `workers/image-optimizer/`

Endpoint `POST /` přijme obrázek a vygeneruje 3 WebP varianty:
thumbnail (200×150), card (800×500), hero (1600×900).

---

## Frontend – Astro

**URL:** `https://rezervace-app.pages.dev`
**Složka:** `frontend/`

> Admin konzole je součástí tohoto projektu — sloučena ve vláknu 07 (20. 3. 2026).
> Složka `admin/` zůstává v repozitáři jako archiv, ale není nasazována.

### Stránky

| Cesta | Soubor | Popis |
|-------|--------|-------|
| `/` | `pages/index.astro` | Landing page (dark wine theme) + nenápadný admin rozcestník |
| `/login` | `pages/login.astro` | Přihlášení do administrace |
| `/superadmin/` | `pages/superadmin/index.astro` | Superadmin dashboard |
| `/superadmin/tenants` | `pages/superadmin/tenants.astro` | Správa tenantů |
| `/superadmin/users` | `pages/superadmin/users.astro` | Správa uživatelů |
| `/superadmin/event-log` | `pages/superadmin/event-log.astro` | Audit log |
| `/superadmin/system` | `pages/superadmin/system.astro` | Health check + API klíče + terminál |
| `/admin/` | `pages/admin/` | TODO — admin stránky tenantu |
| `/[subdomain]` | `pages/[subdomain]/index.astro` | Seznam akcí tenantu |
| `/[subdomain]/akce/[id]` | `pages/[subdomain]/akce/[id].astro` | Detail + formulář |

> Statické routy (`/login`, `/superadmin`, ...) mají v Astru vyšší prioritu než dynamická `[subdomain]` — žádný konflikt.

### Pomocné soubory

| Soubor | Popis |
|--------|-------|
| `src/lib/i18n.ts` | Překlady CS/EN (server-side) |
| `src/lib/supabase.ts` | Supabase klient |
| `public/lang.js` | Překlady CS/EN (client-side, runtime) |
| `public/terminal.js` | Terminálový panel (pravý sidebar) |

### i18n architektura

- `data-i18n="klic"` atribut na HTML elementech
- `window.t('klic')` pro dynamický JS obsah
- Jazyk uložen v `localStorage('lang')`
- Přepínač: tlačítka CS / EN (ne vlajky — nefungují spolehlivě na Windows)

### Admin rozcestník (index.astro)

Nenápadná fixní lišta dole na landing page:
- Barva `#3D2A32` — téměř neviditelná pro náhodného návštěvníka
- Hover: rozsvítí se na `#C0395A`
- Odkazy: Přihlášení, Superadmin, Admin

### Environment proměnné

```
PUBLIC_SUPABASE_URL=https://arcutrsftxarurghmtqj.supabase.co
PUBLIC_SUPABASE_ANON_KEY=<anon klíč>
```

Nastaveno v Cloudflare Pages → Settings → Environment variables. Nikdy do Gitu.

---

## Nasazení a infrastruktura

### GitHub repozitář

```
https://github.com/Anamax443/rezervace-app (private)
```

Větev `main` — automatické nasazení na Cloudflare Pages po každém push.

### Struktura repozitáře

```
rezervace-app/
├── supabase/migrations/
│   ├── 001_init.sql
│   ├── 002_rls.sql
│   └── 003_seed.sql
├── workers/
│   ├── admin-api/
│   │   └── src/
│   │       ├── index.ts       # Všechny endpointy
│   │       ├── auth.ts        # Autentizace, Env interface
│   │       └── crypto.ts      # AES-256-GCM
│   ├── fio-polling/
│   ├── fio-billing/
│   ├── rezervace/
│   └── image-optimizer/
├── frontend/                  # NASAZOVÁNO na Cloudflare Pages
│   └── src/
│       ├── lib/
│       │   ├── i18n.ts        # Překlady CS/EN
│       │   └── supabase.ts
│       └── pages/
│           ├── index.astro    # Landing page + admin rozcestník
│           ├── login.astro    # Přihlášení
│           ├── superadmin/    # Superadmin konzole
│           │   ├── index.astro
│           │   ├── tenants.astro
│           │   ├── users.astro
│           │   ├── event-log.astro
│           │   └── system.astro
│           ├── admin/         # TODO
│           └── [subdomain]/   # Zákaznický web
│               ├── index.astro
│               └── akce/[id].astro
├── admin/                     # ARCHIV — neslouží k nasazení
├── dokumentace.md
├── api-klice-dokumentace.md
├── known_good.md
├── rezervace-app-poznatky-vlakno.md
├── ai_development_principles.md
└── check-api-keys.ps1
```

### Cloudflare prostředky

| Prostředek | Název | URL |
|-----------|-------|-----|
| Pages | rezervace-app | rezervace-app.pages.dev |
| Worker | admin-api | admin-api.bass443.workers.dev |
| Worker | fio-polling | fio-polling.bass443.workers.dev |
| Worker | fio-billing | fio-billing.bass443.workers.dev |
| Worker | rezervace | rezervace.bass443.workers.dev |
| Worker | image-optimizer | image-optimizer.bass443.workers.dev |

### Nasazení Workers

```bash
cd workers/<nazev-workeru>
npm install
npx wrangler deploy
```

### Aktualizace secrets

```bash
npx wrangler secret put SUPABASE_SERVICE_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put FIO_PLATFORM_TOKEN
npx wrangler secret put ENCRYPTION_KEY
```

---

## Bezpečnost

### Row Level Security (Supabase)

Každá tabulka má RLS politiky:
- Tenant vidí pouze svá data (`tenant_id = get_user_tenant_id()`)
- Superadmin vidí vše
- `system_settings` — přístup pouze přes service_role

### Helper funkce

```sql
public.is_superadmin()      -- ověří roli superadmin
public.get_user_role()      -- vrátí roli přihlášeného uživatele
public.get_user_tenant_id() -- vrátí tenant_id přihlášeného uživatele
```

### AES-256-GCM šifrování (`crypto.ts`)

API klíče se ukládají šifrované v `system_settings`:
- Algoritmus: AES-GCM, 256 bitů
- IV: 12 bajtů, náhodný, unikátní pro každý záznam
- Master klíč: Cloudflare Worker Secret `ENCRYPTION_KEY`

> ⚠️ Bez `ENCRYPTION_KEY` jsou záznamy v DB nečitelné. Při ztrátě nutno přegenerovat všechny klíče.

### Generování ENCRYPTION_KEY

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
npx wrangler secret put ENCRYPTION_KEY
```

### Secrets management

Všechny citlivé hodnoty pouze v Cloudflare Worker Secrets. Nikdy v kódu ani `.env` v repozitáři.

---

## Rozvojový plán

### Hotovo ✅

- [x] Databázové schéma (init, RLS, seed)
- [x] Tabulka `system_settings` pro šifrované klíče
- [x] Worker: admin-api (superadmin + admin endpointy)
- [x] Worker: admin-api – AES-256-GCM crypto modul
- [x] Worker: admin-api – test/save/load API klíčů
- [x] Worker: admin-api – system-check (8 služeb)
- [x] Worker: admin-api – CORS global try-catch wrapper
- [x] Worker: admin-api – resolveApiKeys() (DB + env fallback)
- [x] Worker: fio-polling (párování plateb + /health)
- [x] Worker: fio-billing (billing tenantů + /health)
- [x] Worker: rezervace (API + /health)
- [x] Worker: image-optimizer (WebP varianty + /health)
- [x] Frontend: landing page (dark wine theme) + admin rozcestník
- [x] Frontend: seznam akcí + detail + rezervační formulář
- [x] Admin konzole sloučena do frontendu (jeden Pages projekt)
- [x] Admin konzole: login stránka
- [x] Admin konzole: superadmin dashboard, tenants, users
- [x] Admin konzole: event-log stránka
- [x] Admin konzole: system.astro (health + API klíče + terminál)
- [x] i18n CS/EN (všechny superadmin stránky)
- [x] API klíče Supabase + Resend uloženy v DB (šifrovaně)

### Zbývá 🔲

- [ ] Event Log zápis (POST do `event_log` selhává tiše)
- [ ] Admin konzole: admin stránky (dashboard, akce, rezervace, users)
- [ ] Generování QR vstupenek a odesílání emailem
- [ ] Ověření domény bass443.com v Resend (DNS záznamy)
- [ ] Supabase Storage bucket `akce-obrazky` – public policy
- [ ] Filtrace sloupců na všech admin stránkách
- [ ] Export dat (HTML, JSON, CSV)
- [ ] SMS notifikace (BulkGate / GoSMS.cz — future)
- [ ] GitHub Actions – automatické testy

---

## Přihlašovací údaje a secrets

> ⚠️ Tento soubor NESMÍ obsahovat reálné klíče. Uložit do správce hesel.

### Kde najít klíče

| Klíč | Kde najít |
|------|-----------|
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API → service_role |
| `PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public |
| `RESEND_API_KEY` | resend.com → API Keys |
| `FIO_PLATFORM_TOKEN` | Fio internet banking → Nastavení → API |
| `ENCRYPTION_KEY` | Vygenerovat: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| Cloudflare API token | dash.cloudflare.com → My Profile → API Tokens |

### Přístupy

| Systém | URL |
|--------|-----|
| Supabase dashboard | https://supabase.com/dashboard/project/arcutrsftxarurghmtqj |
| Cloudflare dashboard | https://dash.cloudflare.com |
| GitHub repozitář | https://github.com/Anamax443/rezervace-app |
| Resend dashboard | https://resend.com |
| Frontend (prod) | https://rezervace-app.pages.dev |
| Landing page | https://rezervace-app.pages.dev/ |
| Demo tenant | https://rezervace-app.pages.dev/novak |
| Admin login | https://rezervace-app.pages.dev/login |
| Superadmin | https://rezervace-app.pages.dev/superadmin |

---

*Dokumentace vytvořena: 22. února 2026*
*Poslední aktualizace: 20. března 2026 (vlákno 07)*
