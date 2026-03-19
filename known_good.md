# Known Good — Validované stavy projektu

> Zapisovat **až po ověření funkčnosti** — ne jen po commitu.
> Při regresi: `git show <hash>:cesta/k/souboru.ts`

---

## Landing page (frontend)

✅ `a1c4de3` — root landing page funkční, dark wine theme (#0D0B10, #C0395A), link na /novak

## Admin-api Worker — základ

✅ `0db84e9` — admin konzole + worker admin-api základ projektu
✅ `37f8bc6` — admin endpointy dashboard, akce, rezervace, users
✅ `ea346d7` — tenant admin endpointy deployed

## Admin-api Worker — system-check

✅ `d48f676` — superadmin system-check UI (stav všech služeb)

## Admin-api Worker — API klíče + šifrování

✅ `9a78ef7` — superadmin api-keys stránka + test-api-key endpoint
✅ `db02d9e` — AES-256-GCM crypto + save/load api-keys endpointy
✅ `d5f6c39` — system.astro sloučený (health check + API klíče + terminál)

## CORS + template literal fix

> Hash z vlákna dbe7fa7e — doplnit po ověření v Gitu:
🔲 `????????` — CORS global try-catch, health endpointy na 4 workerech, template literal fix

## i18n opravy

✅ `57c41e8` — i18n dynamické překlady, oprava hardcoded textů, locale

---

## Stav secrets (admin-api worker)

| Secret | Stav | Datum |
|--------|------|-------|
| SUPABASE_SERVICE_KEY | ✅ | Feb 2026 |
| INTERNAL_AUTH_TOKEN | ✅ | Feb 2026 |
| RESEND_API_KEY | ✅ | Feb 2026 |
| FIO_PLATFORM_TOKEN | ✅ | Feb 2026 |
| ENCRYPTION_KEY | ✅ | Feb 2026 |

## Stav API klíčů v DB (system_settings)

| Klíč | Uložen | Ověřen |
|------|--------|--------|
| supabase | ✅ | Feb 2026 |
| resend | ✅ | Feb 2026 |
| fio | 🔲 | — |
| internal | 🔲 | — |

---

*Soubor vytvořen: 19. března 2026 (vlákno 06)*
*Projekt: rezervace-app (github.com/Anamax443/rezervace-app)*
