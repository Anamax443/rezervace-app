import os

p = os.path.join('workers', 'admin-api', 'src', 'index.ts')
c = open(p, encoding='utf-8').read()

# Najdi misto kde se vraci response system-checku
old = 'return new Response(JSON.stringify({ overall: allOk ? "ok" : "degraded", timestamp: new Date().toISOString(), services: results }), { headers: { ...cors, "Content-Type": "application/json" } });'

new = """// Log do event_log
        const failed = results.filter(r => r.status !== "ok").map(r => r.name);
        const logKategorie = allOk ? "information" : "warning";
        const logZprava = allOk
          ? "System check OK: vsechny sluzby dostupne (" + results.length + "/" + results.length + ")"
          : "System check: " + (results.length - failed.length) + "/" + results.length + " OK, problem: " + failed.join(", ");
        await fetch(env.SUPABASE_URL + "/rest/v1/event_log", {
          method: "POST",
          headers: { ...sbHeaders, "Content-Type": "application/json", "Prefer": "return=minimal" },
          body: JSON.stringify({ kategorie: logKategorie, zdroj: "system-check", zprava: logZprava, detail: JSON.stringify(results), tenant_id: null }),
        });
        return new Response(JSON.stringify({ overall: allOk ? "ok" : "degraded", timestamp: new Date().toISOString(), services: results }), { headers: { ...cors, "Content-Type": "application/json" } });"""

if 'event_log' not in c.split('system-check')[1].split('superadmin/tenants')[0]:
    c = c.replace(old, new)
    open(p, 'w', encoding='utf-8').write(c)
    print('OK - event_log zapis pridan')
else:
    print('SKIP - uz tam je')
