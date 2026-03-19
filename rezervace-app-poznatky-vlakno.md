# Rezervace App — Poznatky z vývoje
## Shrnutí zkušeností ze všech vláken (Feb–Mar 2026)

---

## 1. PowerShell a diakritika — KRITICKÝ PROBLÉM

### Problém
PowerShell here-string (`@'...'@`) poškozuje UTF-8 znaky při zápisu do souborů.
Výsledkem jsou znaky `\ufffd` (Unicode replacement character) nebo `??` v HTML.

### Řešení — odsouhlasený mechanismus

| Úkol | Nástroj | Poznámka |
|------|---------|----------|
| Zápis nových souborů s češtinou | Node .cjs s `\uXXXX` | Žádná přímá čeština v kódu |
| Oprava existujících souborů | Python skript (uložit do souboru, pak spustit) | Spolehlivé UTF-8 |
| Ověření obsahu souboru | `python -c "print(open(...)...)"` | Terminál zobrazuje špatně, soubor je OK |

### Příklady

**Zápis přes Node .cjs (preferovaný způsob):**
```javascript
// fix.cjs
const fs = require('fs');
// Pole řetězců joined s \n — nejspolehlivější varianta
const lines = [
  'N\u00e1zev souboru',
  'Dal\u0161\u00ed \u0159\u00e1dek',
];
fs.writeFileSync('output.txt', lines.join('\n'), 'utf8');
```

**Oprava přes Python (uložit do .py souboru, pak spustit):**
```python
# fix.py
c = open('soubor.astro', encoding='utf-8').read()
c = c.replace('\ufffdN\ufffdzev', 'Název')
open('soubor.astro', 'w', encoding='utf-8').write(c)
```
```powershell
python fix.py
```

**Ověření obsahu:**
```powershell
python -c "print(open('soubor.astro', encoding='utf-8').read()[:300])"
```

### Klíčová zjištění
- Terminál (`type`, PowerShell výstup) zobrazuje UTF-8 špatně — to NEZNAMENÁ že soubor je poškozený
- Python `print()` zobrazuje správně
- **Inline Python v PowerShell (-c) selhává** — vždy zapisovat Python do dočasného souboru a spouštět
- Node.js `-e` inline příkazy selhávají při složitých string escape sekvencích — vždy `.cjs` soubor
- Soubory zapsané přes Node .cjs s `\uXXXX` jsou vždy správně UTF-8

---

## 2. Template literals v TypeScript / JavaScript — ZÁKEŘNÁ CHYBA

### Problém
Backticky musí obalovat celou template literal hodnotu, ne být zanořeny do property names:

```typescript
// ŠPATNĚ — backticky jsou uvnitř property name → worker padá
const headers = {
  "Authorization`: Bearer ${token}, `apikey": token
}

// SPRÁVNĚ
const headers = {
  "Authorization": `Bearer ${token}`,
  "apikey": token
}
```

### Projev
Worker padá při každém requestu. Prohlížeč vidí pouze "Failed to fetch" — bez detailu. Proto je nutný CORS global try-catch (viz níže).

---

## 3. CORS — global try-catch wrapper

### Problém
Pokud worker hodí výjimku před odesláním response, prohlížeč dostane síťovou chybu bez CORS hlaviček. Výsledek: "Failed to fetch" — bez jakéhokoli detailu.

### Řešení — obalit celý handler

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch (e: any) {
      // Vždy vrátit CORS hlavičky, i při nečekané chybě
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }
  }
}
```

### Poučení
Tento wrapper je povinný ve všech workerech. Bez něj je debugging v prohlížeči slepý.

---

## 4. Supabase Auth — správné použití JWT tokenu

### Kritická oprava
```typescript
// ŠPATNĚ — service key nesetuje auth.uid(), RLS selhává
headers: { "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}` }

// SPRÁVNĚ — uživatelův token setuje auth.uid()
headers: { "Authorization": `Bearer ${userJwtToken}` }
```

Service key obchází RLS (to je záměr pro zápisy), ale pro čtení dat uživatele je nutný jeho vlastní JWT — jinak RLS políčka selhávají.

### JWT platnost
- Supabase JWT platí **1 hodinu** (3600 sekund)
- Uložen v `localStorage` pod klíčem `sb_token`
- Po expiraci nutné nové přihlášení

---

## 5. Astro — specifika

### Inline skripty
```html
<!-- NE — Astro bundluje script, import.meta.env nefunguje -->
<script src="/lang.js"></script>

<!-- ANO — is:inline zabraňuje bundlování -->
<script src="/lang.js" is:inline></script>
```

### Event listenery
```javascript
// NE — onclick nefunguje v Astro kompilovaných stránkách
<button onclick="login()">

// ANO — addEventListener vždy funguje
<button id="btn">
document.getElementById("btn").addEventListener("click", login);
```

### Supabase nový formát klíčů
- Anon key: `sb_pub...` (ne `eyJ...`)
- Service key: `sb_sec...`

---

## 6. AES-256-GCM šifrování (`crypto.ts`)

### Přehled
```typescript
// Generování master klíče (jednou, uložit jako Worker Secret)
const key = crypto.getRandomValues(new Uint8Array(32));
// nebo: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

// Šifrování
async function encrypt(plaintext: string, base64Key: string): Promise<{encrypted: string, iv: string}>

// Dešifrování
async function decrypt(encrypted: string, iv: string, base64Key: string): Promise<string>
```

### Důležité
- IV je náhodný a unikátní pro každý záznam — nikdy neopakovat
- Bez `ENCRYPTION_KEY` jsou záznamy v `system_settings` nečitelné
- Při ztrátě klíče: přegenerovat `ENCRYPTION_KEY` + znovu uložit všechny API klíče

---

## 7. i18n — Vícejazyčnost

### Architektura
- `src/lib/i18n.ts` — slovník překladů (CS, EN, server-side)
- `public/lang.js` — runtime překlady v prohlížeči
- `data-i18n="klic"` atribut na HTML elementech
- `window.t('klic')` pro dynamický JS obsah
- Jazyk uložen v `localStorage('lang')`

### Dynamický obsah (JS generated)
```javascript
// NE — hardcoded čeština
tbody.innerHTML = '<tr><td>Žádné záznamy</td></tr>';

// ANO — přes t()
tbody.innerHTML = '<tr><td>' + window.t('noData') + '</td></tr>';
```

### Locale pro formátování dat
```javascript
function getLocale() { return window.getLang() === "en" ? "en-GB" : "cs-CZ"; }
const locale = getLocale();
new Date(ts).toLocaleDateString(locale);
```

---

## 8. Fio banka — specifika

### Rate limit
- 1 request / 30 sekund
- HTTP 409 = rate limit (ne chyba tokenu!)
- Při rate limitu počkat 30s a zkusit znovu

### Token expirace
- Token může expirovat tiše — bez varování
- Při expiraci: HTTP 409 nebo prázdná odpověď
- Kontrolovat pravidelně (ideálně denně přes `check-api-keys.ps1`)
- Po expiraci: nový token v Fio IB → aktualizovat ve všech workerech

---

## 9. Cloudflare Workers — health endpointy

### Povinný pattern pro všechny workers
```typescript
if (url.pathname === '/health') {
  return new Response(JSON.stringify({
    status: 'ok',
    worker: 'nazev-workeru',
    timestamp: new Date().toISOString()
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
```

Všechny 4 workers (fio-polling, fio-billing, rezervace, image-optimizer) mají `/health` endpoint od vlákna 05b.

---

## 10. Git workflow — povinný postup

```powershell
git add <soubory>
git commit --allow-empty -m "typ: popis zmeny"
git push
git log --oneline -3
```

- `--allow-empty` zajistí commit i když nejsou změny — předejde chybě "nothing to commit"
- Hash z `git log` zapsat do `known_good.md` po ověření funkčnosti
- Dokumentaci vždy aktualizovat před commitem

### Typy commitů
- `feat:` — nová funkcionalita
- `fix:` — oprava chyby
- `docs:` — pouze dokumentace
- `wip:` — rozpracováno (do finálního commitu přepsat)

---

## 11. Supabase free tier — limity

- 2 aktivní projekty per organizace
- Projekty se pauzují po 1 týdnu bez aktivity
- Ochrana: fio-polling cron každých 5 minut = trvalá aktivita
- Pro nové systémy/agendy: nová Supabase organizace (stejný GitHub účet `Anamax443`)

---

## 12. Projekt — aktuální stav (Mar 2026)

### Hotovo ✅
- Databáze migrace v2.0 (Supabase)
- Tabulka `system_settings` pro šifrované API klíče
- Worker `admin-api` — nasazen, všechny endpointy funkční
- Worker `admin-api` — AES-256-GCM crypto modul
- Worker `admin-api` — CORS global try-catch wrapper
- Health endpointy na všech 5 workerech
- Astro admin konzole — všechny superadmin stránky
- `system.astro` — health check + API klíče + terminálový panel
- i18n CS/EN (kompletní)
- Landing page (dark wine theme, #0D0B10, #C0395A)
- API klíče Supabase + Resend uloženy šifrovaně v DB

### Rozpracováno / TODO
- `resolveApiKeys()` — worker čte klíče z DB (fallback na env)
- Event Log zápis selhává tiše (POST do `event_log`)
- Admin a Keyuser konzole stránky
- Filtrace sloupců + export (HTML, JSON, CSV)
- Ověření domény bass443.com v Resend

---

*Dokument vytvořen: 22. února 2026*
*Poslední aktualizace: 19. března 2026 (vlákno 06)*
*Projekt: rezervace-app (github.com/Anamax443/rezervace-app)*
