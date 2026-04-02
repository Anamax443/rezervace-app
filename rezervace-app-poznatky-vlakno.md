# Rezervace App — Poznatky z vývoje
## Shrnutí zkušeností z vlákna (Feb 2026)

---

## 1. PowerShell a diakritika — KRITICKÝ PROBLÉM

### Problém
PowerShell here-string (`@'...'@`) poškozuje UTF-8 znaky při zápisu do souborů.
Výsledkem jsou znaky `\ufffd` (Unicode replacement character) nebo `??` v HTML.

### Řešení — odsouhlasený mechanismus

| Úkol | Nástroj | Poznámka |
|------|---------|----------|
| Zápis nových souborů s češtinou | Node .cjs s `\uXXXX` | Žádná přímá čeština v kódu |
| Oprava existujících souborů | Python `-c` nebo Python skript | Spolehlivé UTF-8 |
| Ověření obsahu souboru | Python `-c "print(open(...)...)"` | Terminál zobrazuje špatně, soubor je OK |

### Příklady

**Zápis přes Node .cjs:**
```javascript
// fix.cjs
const fs = require('fs');
const content = 'N\u00e1zev, P\u0159\u00edpadov\u00e1 studie';
fs.writeFileSync('output.txt', content, 'utf8');
```

**Oprava přes Python:**
```powershell
python -c "
c = open('soubor.astro', encoding='utf-8').read()
c = c.replace('\ufffdN\ufffdzev', 'Název')
open('soubor.astro', 'w', encoding='utf-8').write(c)
"
```

**Ověření obsahu:**
```powershell
python -c "print(open('soubor.astro', encoding='utf-8').read()[:300])"
```

### Klíčové zjištění
- Terminál (`type`, PowerShell výstup) zobrazuje UTF-8 špatně — to NEZNAMENÁ že soubor je poškozený
- Python `print()` zobrazuje správně
- Soubory zapsané přes Node .cjs s `\uXXXX` jsou vždy správně UTF-8

---

## 2. i18n — Vícejazyčnost

### Architektura
- `src/lib/i18n.ts` — slovník překladů (CS, EN, snadno rozšiřitelné)
- `public/lang.js` — runtime překlady v prohlížeči
- `data-i18n="klic"` atribut na HTML elementech
- `window.t('klic')` pro dynamický JS obsah
- Jazyk uložen v `localStorage('lang')`

### Přepínač jazyka
```html
<button onclick="setLang('cs')">CS</button>
<button onclick="setLang('en')">EN</button>
```
- Vlajky emoji nefungují spolehlivě na Windows — použít text CS/EN
- `setLang()` volá `location.reload()` pro překreslení stránky

### Dynamický obsah (JS generated)
```javascript
// Místo hardcoded češtiny:
tbody.innerHTML = '<tr><td>Žádné záznamy</td></tr>';

// Použít:
tbody.innerHTML = '<tr><td>' + t('noData') + '</td></tr>';
```

### Přidání nového jazyka
Do `src/lib/i18n.ts` přidat blok:
```typescript
sk: {
  dashboard: 'Dashboard',
  tenants: 'Nájomníci',
  // ...
}
```

---

## 3. Nasazení admin-api Worker (Cloudflare)

### Postup
```powershell
cd workers/admin-api
npm install
npx wrangler secret put SUPABASE_SERVICE_KEY
npx wrangler secret put INTERNAL_AUTH_TOKEN
npx wrangler deploy
```

### Ověření
```powershell
curl https://admin-api.bass443.workers.dev/health
```

### Auth flow
1. Client posílá Bearer JWT token
2. Worker ověří token přes Supabase Auth `/auth/v1/user`
3. Načte profil z tabulky `profiles` pomocí **uživatelova JWT** (ne service key!)
4. RLS politiky vyžadují správné `auth.uid()` — service key ho nesetuje

### Kritická oprava
```typescript
// ŠPATNĚ — service key nesetuje auth.uid(), RLS selhává
headers: { "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}` }

// SPRÁVNĚ — uživatelův token setuje auth.uid()
headers: { "Authorization": `Bearer ${token}` }
```

---

## 4. Supabase — nastavení hesla

### Přes SQL Editor (pokud chybí tlačítko v UI)
```sql
UPDATE auth.users
SET encrypted_password = crypt('NoveHeslo123!', gen_salt('bf'))
WHERE id = 'uuid-uzivatele';
```

### Nový formát Supabase klíčů
- Anon key nyní začíná `sb_pub...` (ne `eyJ...`)
- Service key začíná `sb_sec...`
- `import.meta.env` nefunguje v inline `<script>` tagu v Astro — použít hardcoded hodnoty nebo `<script is:inline>`

---

## 5. Astro — specifika

### Inline skripty
```html
<!-- Takhle NE — Astro bundluje script a import.meta.env nefunguje -->
<script src="/lang.js"></script>

<!-- Takhle ANO — is:inline zabraňuje bundlování -->
<script src="/lang.js" is:inline></script>
```

### Event listenery
```javascript
// Takhle NE — onclick="login()" nefunguje když je funkce v <script> tagu
<button onclick="login()">

// Takhle ANO
<button id="btn">
document.getElementById("btn").addEventListener("click", login);
```

---

## 6. Projekt — aktuální stav

### Hotovo ✅
- Databáze migrace v2.0 (Supabase)
- Worker `admin-api` nasazený na Cloudflare Workers
- Astro admin konzole — login stránka
- Superadmin dashboard, tenants, users, event-log
- i18n CS/EN s přepínačem jazyků

### Rozpracováno / TODO
- Dynamické překlady v JS generovaném obsahu (noData, noUsers, noTenants)
- Filtrace sloupců na všech stránkách
- Export dat (HTML, JSON, CSV)
- Admin a Keyuser konzole
- Nasazení admin frontendu na Cloudflare Pages

### Technologie
- **Backend:** Cloudflare Workers (TypeScript), Supabase (PostgreSQL + Auth)
- **Frontend:** Astro 5 + Cloudflare adapter
- **Dev:** Node.js 24, Python 3.14, PowerShell 7

---

*Dokument vytvořen: 22. února 2026*
*Projekt: rezervace-app (github.com/Anamax443/rezervace-app)*
