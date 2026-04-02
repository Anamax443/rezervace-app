# Rezervace-App — Dokumentace vlákna 07

## Přehled session
**Datum:** 20. března 2026
**Vlákno:** rezervace-app07
**Navazuje na:** vlákno 06 (dokumentace, resolveApiKeys plán)
**Autor dokumentace:** Claude (Anthropic AI)
**Architekt a iniciátor projektu:** Milan Trnka

---

## 1. Co bylo hotovo z předchozích vláken

### Vlákno 06 (19. března 2026)
- Kompletní aktualizace dokumentace
- `resolveApiKeys()` naplánována jako Priorita 1

### Zjištění při zahájení vlákna 07
- `resolveApiKeys()` je již implementována v `workers/admin-api/src/index.ts` — Priorita 1 z vlákna 06 je hotová
- Admin konzole existovala pouze lokálně ve složce `admin/`, nebyla nasazena
- `frontend/` neobsahoval admin stránky

---

## 2. Co bylo uděláno v tomto vlákně

### Admin konzole sloučena do frontendu

**Problém:** Admin konzole nebyla dostupná — existovala jen lokálně v `admin/`, jako samostatný Astro projekt, který nebyl nikdy nasazen.

**Rozhodnutí:** Sloučit do jednoho Cloudflare Pages projektu (`rezervace-app`). Statické routy mají v Astru vyšší prioritu než dynamická `[subdomain]` — žádný konflikt.

**Postup:**
```powershell
Copy-Item -Recurse -Force admin\src\pages\* frontend\src\pages\
Copy-Item -Force admin\src\lib\i18n.ts frontend\src\lib\i18n.ts
```

**Výsledná struktura `frontend/src/pages/`:**
```
pages/
├── index.astro          # Landing page
├── login.astro          # Přihlášení (přesunuto z admin/)
├── superadmin/
│   ├── index.astro
│   ├── tenants.astro
│   ├── users.astro
│   ├── event-log.astro
│   └── system.astro
├── admin/               # prázdné, TODO
└── [subdomain]/
    ├── index.astro
    └── akce/[id].astro
```

Build proběhl čistě bez chyb.

### Admin rozcestník na landing page

Do `frontend/src/pages/index.astro` přidána nenápadná fixní lišta dole:
- Barva `#3D2A32` — záměrně téměř neviditelná pro náhodné návštěvníky
- Hover efekt: `#C0395A`
- Odkazy: Přihlášení → `/login`, Superadmin → `/superadmin`, Admin → `/admin`

### Service Bindings — inter-worker komunikace

**Problém:** admin-api worker volal ostatní workery přes HTTP (`fetch("https://fio-polling.bass443.workers.dev/health")`). Cloudflare blokuje inter-worker HTTP volání na `*.workers.dev` doménách — vracelo HTTP 404.

**Řešení:** Cloudflare Service Bindings — přímé propojení workerů bez HTTP overhead.

Změny:
- `workers/admin-api/wrangler.toml` — přidány 4 `[[services]]` bloky
- `workers/admin-api/src/auth.ts` — přidány Service Binding typy do `Env` interface
- `workers/admin-api/src/index.ts` — system-check volá `env.SVC_*.fetch()` místo `fetch(URL)`

Výsledek: 8/8 služeb OK, fio-polling 0ms latence (přímé volání).

### In-memory cache pro resolveApiKeys

**Problém:** Každý request načítal API klíče z DB — extra roundtrip ~120ms.

**Řešení:** Cache s TTL 5 minut na úrovni Worker instance. Při `save-api-key` se cache invaliduje.

Výsledek: latence tenants fetch klesla z 306ms na 186ms.

---

## 3. Živé URL po nasazení

| Stránka | URL |
|---------|-----|
| Landing page | https://rezervace-app.pages.dev/ |
| Demo tenant | https://rezervace-app.pages.dev/novak |
| Admin login | https://rezervace-app.pages.dev/login |
| Superadmin | https://rezervace-app.pages.dev/superadmin |
| System / Health | https://rezervace-app.pages.dev/superadmin/system |

---

## 4. Git commity v tomto vlákně

| # | Hash | Zpráva |
|---|------|--------|
| 1 | (doplnit) | `feat: admin konzole sloučena do frontendu` |
| 2 | (doplnit) | `docs: aktualizace dokumentace vlakno07` |

---

## 5. TODO příště

### Priorita 1 — Přihlášení a ověření funkčnosti
- Otevřít `/login`, přihlásit se jako superadmin
- Ověřit přesměrování na `/superadmin`
- Spustit system-check, ověřit výstup do terminálu
- Ověřit token v DevTools → Application → Local Storage (`sb_token`)

### Priorita 2 — Event Log zápis
- POST do `event_log` selhává tiše (problém z vlákna 04)
- Debug: ověřit RLS politiku pro zápis service rolí
- Přidat explicitní log chyby do workeru

### Priorita 3 — Admin stránky (tenant)
- `/admin/index.astro` — dashboard tenantu
- `/admin/akce.astro` — seznam akcí
- `/admin/rezervace.astro` — rezervace
- `/admin/users.astro` — správa key userů

---

## 6. Technické poznámky

### Sloučení admin → frontend
- `admin/` složka zůstává v repozitáři jako archiv, ale není nasazována
- `lang.js` a `terminal.js` byly již v `frontend/public/` — žádná kolize
- `admin/src/auth.ts` patří do workeru, ne do Astro frontendu — nepřesouváme
- i18n.ts z `admin/` má více klíčů než původní `frontend/src/lib/i18n.ts` — správně přepsáno

---

*Dokument vytvořen: 20. března 2026*
*Vlákno: rezervace-app07*
*Projekt: rezervace-app (github.com/Anamax443/rezervace-app)*
