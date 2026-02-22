import os

p = os.path.join('workers', 'admin-api', 'src', 'index.ts')
c = open(p, encoding='utf-8').read()

# Nahrad fire-and-forget POST za POST s kontrolou
old = '''await fetch(env.SUPABASE_URL + "/rest/v1/event_log", {
          method: "POST",
          headers: { ...sbHeaders, "Content-Type": "application/json", "Prefer": "return=minimal" },
          body: JSON.stringify({ kategorie: logKategorie, zdroj: "system-check", zprava: logZprava, detail: JSON.stringify(results), tenant_id: null }),
        });'''

new = '''const logRes = await fetch(env.SUPABASE_URL + "/rest/v1/event_log", {
          method: "POST",
          headers: { ...sbHeaders, "Content-Type": "application/json", "Prefer": "return=minimal" },
          body: JSON.stringify({ kategorie: logKategorie, zdroj: "system-check", zprava: logZprava, detail: JSON.stringify(results), tenant_id: null }),
        });
        const logStatus = logRes.status;
        const logError = logRes.ok ? null : await logRes.text();'''

c = c.replace(old, new)

# Pridej log info do response
c = c.replace(
    'return new Response(JSON.stringify({ overall: allOk ? "ok" : "degraded", timestamp: new Date().toISOString(), services: results })',
    'return new Response(JSON.stringify({ overall: allOk ? "ok" : "degraded", timestamp: new Date().toISOString(), services: results, log_status: logStatus, log_error: logError })'
)

open(p, 'w', encoding='utf-8').write(c)
print('OK - debug logging pridano')
