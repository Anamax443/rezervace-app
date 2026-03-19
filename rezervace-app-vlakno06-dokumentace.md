# Rezervace-App — Dokumentace vlákna 06

## Přehled session
**Datum:** 19. března 2026
**Vlákno:** rezervace-app06
**Navazuje na:** vlákno 05b (AES šifrování, system.astro, API klíče)
**Autor dokumentace:** Claude (Anthropic AI)
**Architekt a iniciátor projektu:** Milan Trnka

---

## 1. Co bylo hotovo z předchozích vláken

### Vlákno 05b (24. února 2026)
- AES-256-GCM šifrování (`crypto.ts`)
- Tabulka `system_settings`
- Endpointy: `test-api-key`, `save-api-key`, `load-api-keys`
- `system.astro` — sloučená stránka (health + API klíče + terminál)

### Session po vláknu 05b (přibližně 1.–8. března 2026)
- CORS global try-catch wrapper v admin-api workeru
- Oprava template literal syntaxe (backticky v property names)
- Health endpointy na 4 workerech (fio-polling, fio-billing, rezervace, image-optimizer)
- API klíče Supabase + Resend uloženy šifrovaně do DB
- Landing page na root URL (`/`) — dark wine theme (#0D0B10, #C0395A), commit `a1c4de3`

---

## 2. Co bylo uděláno v tomto vlákně

### Dokumentace — kompletní aktualizace

Všechny dokumentační soubory aktualizovány tak, aby odrážely skutečný stav projektu ke dni 19. 3. 2026:

| Soubor | Změny |
|--------|-------|
| `dokumentace.md` | Verze 2.0 — přidán admin-api worker, crypto.ts, system_settings, landing page, aktuální TODO |
| `rezervace-app-poznatky-vlakno.md` | Přidány poznatky: template literal bug, CORS wrapper, inline Python v PS, known_good postup |
| `known_good.md` | Nový soubor — validované commit hashe, stav secrets a DB klíčů |
| `rezervace-app-vlakno06-dokumentace.md` | Tento soubor |

### Commit skript

Soubor `commit-docs.cjs` — Node.js skript pro commit dokumentace přes Git. Spustit v kořeni projektu.

---

## 3. Stav projektu ke dni 19. 3. 2026

### Infrastruktura
- 5 Workers nasazeno a funkčních (admin-api, fio-polling, fio-billing, rezervace, image-optimizer)
- Všechny workers mají `/health` endpoint
- admin-api má CORS global try-catch wrapper
- Supabase: DB + Auth + system_settings tabulka

### Admin konzole
- Všechny superadmin stránky funkční (dashboard, tenants, users, event-log, system)
- i18n CS/EN kompletní
- API klíče Supabase + Resend uloženy v DB (šifrovaně)

### Frontend
- Landing page na root URL
- Zákaznický web (seznam akcí, detail, formulář)

---

## 4. TODO příště

### Priorita 1 — `resolveApiKeys()`
Worker čte klíče z `system_settings` (dešifruje) s fallbackem na env secrets.
Dotčené soubory: `workers/admin-api/src/index.ts`, `workers/admin-api/src/crypto.ts`

Vzor implementace:
```typescript
async function resolveApiKeys(env: Env) {
  try {
    // Načíst z DB
    const { data } = await supabase.from('system_settings').select('key, encrypted_value, iv');
    const keys: Record<string, string> = {};
    for (const row of data ?? []) {
      keys[row.key] = await decrypt(row.encrypted_value, row.iv, env.ENCRYPTION_KEY);
    }
    return {
      SUPABASE_SERVICE_KEY: keys.supabase ?? env.SUPABASE_SERVICE_KEY,
      RESEND_API_KEY: keys.resend ?? env.RESEND_API_KEY,
      FIO_PLATFORM_TOKEN: keys.fio ?? env.FIO_PLATFORM_TOKEN,
      INTERNAL_AUTH_TOKEN: keys.internal ?? env.INTERNAL_AUTH_TOKEN,
    };
  } catch {
    // Fallback na env
    return env;
  }
}
```

### Priorita 2 — Event Log zápis
POST do `event_log` tabulky selhává tiše. Debug: přidat explicitní log chyby do workeru, ověřit RLS politiku pro zápis service rolí.

### Priorita 3 — Admin stránky
- `/admin/index.astro` — dashboard tenantu (volá `/admin/dashboard`)
- `/admin/akce.astro` — seznam akcí
- `/admin/rezervace.astro` — rezervace
- `/admin/users.astro` — správa key userů

---

## 5. Git commity v tomto vlákně

| # | Hash | Zpráva |
|---|------|--------|
| 1 | (po commitu doplnit) | `docs: kompletni aktualizace dokumentace vlakno06` |

---

*Dokument vytvořen: 19. března 2026*
*Vlákno: rezervace-app06*
*Projekt: rezervace-app (github.com/Anamax443/rezervace-app)*
