import { encrypt, decrypt } from "./crypto";
import { verifyAuth, requireSuperadmin, requireAdmin, jsonResponse, type Env } from "./auth";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" };

async function testService(name: string, testFn: () => Promise<any>): Promise<{ name: string; status: string; latency: number; detail: string }> {
  const start = Date.now();
  try {
    const result = await testFn();
    return { name, status: "ok", latency: Date.now() - start, detail: result || "OK" };
  } catch (e: any) {
    return { name, status: "error", latency: Date.now() - start, detail: e.message || String(e) };
  }
}

// --- Resolve API keys: DB (system_settings) s fallbackem na env ---
interface ResolvedKeys {
  SUPABASE_SERVICE_KEY: string;
  RESEND_API_KEY: string;
  FIO_PLATFORM_TOKEN: string;
  INTERNAL_AUTH_TOKEN: string;
}

async function resolveApiKeys(env: Env): Promise<ResolvedKeys> {
  const defaults: ResolvedKeys = {
    SUPABASE_SERVICE_KEY: env.SUPABASE_SERVICE_KEY,
    RESEND_API_KEY: env.RESEND_API_KEY,
    FIO_PLATFORM_TOKEN: env.FIO_PLATFORM_TOKEN,
    INTERNAL_AUTH_TOKEN: env.INTERNAL_AUTH_TOKEN,
  };
  const keyMap: Record<string, keyof ResolvedKeys> = {
    supabase: "SUPABASE_SERVICE_KEY",
    resend: "RESEND_API_KEY",
    fio: "FIO_PLATFORM_TOKEN",
    internal: "INTERNAL_AUTH_TOKEN",
  };
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/system_settings?select=key,encrypted_value,iv`, {
      headers: { "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`, "apikey": env.SUPABASE_SERVICE_KEY },
    });
    if (!res.ok) return defaults;
    const rows = await res.json() as Array<{ key: string; encrypted_value: string; iv: string }>;
    for (const row of rows) {
      const envKey = keyMap[row.key];
      if (envKey && row.encrypted_value && row.iv) {
        try {
          defaults[envKey] = await decrypt(row.encrypted_value, row.iv, env.ENCRYPTION_KEY);
        } catch { /* decrypt failed - keep env fallback */ }
      }
    }
  } catch { /* DB nedostupna - keep env fallback */ }
  return defaults;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/health") return new Response(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }), { headers: { ...cors, "Content-Type": "application/json" } });
    const authResult = await verifyAuth(request, env);
    if ("error" in authResult) return new Response(JSON.stringify({ error: authResult.error }), { status: authResult.status, headers: { ...cors, "Content-Type": "application/json" } });
    const { user } = authResult;
    if (path === "/admin/me") return new Response(JSON.stringify(user), { headers: { ...cors, "Content-Type": "application/json" } });
    if (path.startsWith("/superadmin/")) {
      const roleCheck = requireSuperadmin(user);
      if (roleCheck) return new Response(JSON.stringify({ error: roleCheck.error }), { status: roleCheck.status, headers: { ...cors, "Content-Type": "application/json" } });
      const keys = await resolveApiKeys(env);
      const sbHeaders = { "Authorization": `Bearer ${keys.SUPABASE_SERVICE_KEY}`, "apikey": keys.SUPABASE_SERVICE_KEY };

      if (path === "/superadmin/system-check") {
        const results = await Promise.all([
          testService("supabase_db", async () => {
            const res = await fetch(`${env.SUPABASE_URL}/rest/v1/tenants?select=id&limit=1`, { headers: sbHeaders });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return `HTTP ${res.status} - DB dostupna`;
          }),
          testService("supabase_auth", async () => {
            const res = await fetch(`${env.SUPABASE_URL}/auth/v1/settings`, { headers: { "apikey": keys.SUPABASE_SERVICE_KEY } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return `HTTP ${res.status} - Auth dostupny`;
          }),
          testService("resend", async () => {
            if (!keys.RESEND_API_KEY) throw new Error("RESEND_API_KEY neni nastaven");
            const res = await fetch("https://api.resend.com/api-keys", { headers: { "Authorization": `Bearer ${keys.RESEND_API_KEY}` } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return `HTTP ${res.status} - Resend dostupny`;
          }),
          testService("fio_platform", async () => {
            if (!keys.FIO_PLATFORM_TOKEN) throw new Error("FIO_PLATFORM_TOKEN neni nastaven");
            const today = new Date().toISOString().slice(0, 10);
            const res = await fetch(`https://fioapi.fio.cz/v1/rest/periods/${keys.FIO_PLATFORM_TOKEN}/${today}/${today}/transactions.json`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return `HTTP ${res.status} - Fio dostupne`;
          }),
          testService("worker_fio_polling", async () => {
            const res = await fetch("https://fio-polling.bass443.workers.dev/health");
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return `HTTP ${res.status} - Worker dostupny`;
          }),
          testService("worker_fio_billing", async () => {
            const res = await fetch("https://fio-billing.bass443.workers.dev/health");
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return `HTTP ${res.status} - Worker dostupny`;
          }),
          testService("worker_rezervace", async () => {
            const res = await fetch("https://rezervace.bass443.workers.dev/health");
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return `HTTP ${res.status} - Worker dostupny`;
          }),
          testService("worker_image_optimizer", async () => {
            const res = await fetch("https://image-optimizer.bass443.workers.dev/health");
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return `HTTP ${res.status} - Worker dostupny`;
          }),
        ]);
        const allOk = results.every(r => r.status === "ok");
        // Log do event_log
        const failed = results.filter(r => r.status !== "ok").map(r => r.name);
        const logKategorie = allOk ? "information" : "warning";
        const logZprava = allOk
          ? "System check OK: vsechny sluzby dostupne (" + results.length + "/" + results.length + ")"
          : "System check: " + (results.length - failed.length) + "/" + results.length + " OK, problem: " + failed.join(", ");
        const logRes = await fetch(env.SUPABASE_URL + "/rest/v1/event_log", {
          method: "POST",
          headers: { ...sbHeaders, "Content-Type": "application/json", "Prefer": "return=minimal" },
          body: JSON.stringify({ kategorie: logKategorie, zdroj: "system-check", zprava: logZprava, detail: JSON.stringify(results), tenant_id: null }),
        });
        const logStatus = logRes.status;
        const logError = logRes.ok ? null : await logRes.text();
        return new Response(JSON.stringify({ overall: allOk ? "ok" : "degraded", timestamp: new Date().toISOString(), services: results, log_status: logStatus, log_error: logError }), { headers: { ...cors, "Content-Type": "application/json" } });
      }


      if (path === "/superadmin/test-api-key") {
        if (request.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
        const body = await request.json() as { service: string; key: string };
        if (!body.service || !body.key) return new Response(JSON.stringify({ error: "service and key required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

        const result = await testService(body.service, async () => {
          switch (body.service) {
            case "supabase": {
              const res = await fetch(`${env.SUPABASE_URL}/rest/v1/tenants?select=id&limit=1`, { headers: { "apikey": body.key, "Authorization": `Bearer ${body.key}` } });
              if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);
              const data = await res.json() as any[];
              return `OK - DB dostupna, ${data.length} tenant(u)`;
            }
            case "resend": {
              const res = await fetch("https://api.resend.com/api-keys", { headers: { "Authorization": `Bearer ${body.key}` } });
              if (!res.ok) throw new Error(`HTTP ${res.status} - neplatny klic`);
              return "OK - Resend klic platny";
            }
            case "fio": {
              const today = new Date().toISOString().slice(0, 10);
              const res = await fetch(`https://fioapi.fio.cz/v1/rest/periods/${body.key}/${today}/${today}/transactions.json`);
              if (!res.ok) throw new Error(`HTTP ${res.status} - token neplatny nebo rate limit`);
              const data = await res.json() as any;
              const info = data?.accountStatement?.info;
              return `OK - ucet ${info?.iban || "?"} (${info?.currency || "?"})`;
            }
            case "internal": {
              const res = await fetch("https://admin-api.bass443.workers.dev/health");
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return "OK - Worker dostupny";
            }
            default:
              throw new Error("Neznama sluzba: " + body.service);
          }
        });
        return new Response(JSON.stringify(result), { headers: { ...cors, "Content-Type": "application/json" } });
      }


      if (path === "/superadmin/save-api-key") {
        if (request.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
        const body = await request.json() as { service: string; key: string };
        if (!body.service || !body.key) return new Response(JSON.stringify({ error: "service and key required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
        const { encrypted, iv } = await encrypt(body.key, env.ENCRYPTION_KEY);
        const res = await fetch(`${env.SUPABASE_URL}/rest/v1/system_settings?key=eq.${body.service}`, {
          method: "GET", headers: sbHeaders,
        });
        const existing = await res.json() as any[];
        const payload = { key: body.service, encrypted_value: encrypted, iv, updated_at: new Date().toISOString(), updated_by: user.email };
        let saveRes;
        if (existing.length > 0) {
          saveRes = await fetch(`${env.SUPABASE_URL}/rest/v1/system_settings?key=eq.${body.service}`, {
            method: "PATCH", headers: { ...sbHeaders, "Content-Type": "application/json", "Prefer": "return=minimal" },
            body: JSON.stringify(payload),
          });
        } else {
          saveRes = await fetch(`${env.SUPABASE_URL}/rest/v1/system_settings`, {
            method: "POST", headers: { ...sbHeaders, "Content-Type": "application/json", "Prefer": "return=minimal" },
            body: JSON.stringify(payload),
          });
        }
        if (!saveRes.ok) {
          const err = await saveRes.text();
          return new Response(JSON.stringify({ error: "DB save failed", detail: err }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ status: "ok", service: body.service }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      if (path === "/superadmin/load-api-keys") {
        const res = await fetch(`${env.SUPABASE_URL}/rest/v1/system_settings?select=key,updated_at,updated_by`, { headers: sbHeaders });
        const rows = await res.json() as any[];
        return new Response(JSON.stringify(rows), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      if (path === "/superadmin/tenants") {
        const res = await fetch(`${env.SUPABASE_URL}/rest/v1/tenants?select=id,nazev,subdomain,plan,plan_status,plan_expirace,aktivni,created_at&order=created_at.desc`, { headers: sbHeaders });
        return new Response(await res.text(), { status: res.status, headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (path === "/superadmin/users") {
        const res = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?select=id,email,role,tenant_id,aktivni,expires_at,created_at&order=created_at.desc`, { headers: sbHeaders });
        return new Response(await res.text(), { status: res.status, headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (path === "/superadmin/event-log") {
        const limit = url.searchParams.get("limit") || "100";
        const kategorie = url.searchParams.get("kategorie");
        let query = `${env.SUPABASE_URL}/rest/v1/event_log?select=*&order=created_at.desc&limit=${limit}`;
        if (kategorie) query += `&kategorie=eq.${kategorie}`;
        const res = await fetch(query, { headers: sbHeaders });
        return new Response(await res.text(), { status: res.status, headers: { ...cors, "Content-Type": "application/json" } });
      }
    }
    // === ADMIN (tenant) ENDPOINTS ===
    if (path.startsWith("/admin/") && path !== "/admin/me") {
      const roleCheck = requireAdmin(user);
      if (roleCheck) return new Response(JSON.stringify({ error: roleCheck.error }), { status: roleCheck.status, headers: { ...cors, "Content-Type": "application/json" } });
      const keys = await resolveApiKeys(env);
      const sbHeaders = { "Authorization": `Bearer ${keys.SUPABASE_SERVICE_KEY}`, "apikey": keys.SUPABASE_SERVICE_KEY };
      const tenantFilter = user.role === "superadmin" ? "" : `&tenant_id=eq.${user.tenant_id}`;

      if (path === "/admin/dashboard") {
        const [akceRes, rezRes] = await Promise.all([
          fetch(`${env.SUPABASE_URL}/rest/v1/akce?select=id,nazev,datum,kapacita,aktivni${tenantFilter}&order=datum.desc`, { headers: sbHeaders }),
          fetch(`${env.SUPABASE_URL}/rest/v1/rezervace?select=id,stav,celkova_castka,created_at${tenantFilter}&order=created_at.desc`, { headers: sbHeaders }),
        ]);
        const akce = await akceRes.json() as any[];
        const rez = await rezRes.json() as any[];
        return new Response(JSON.stringify({
          akce_count: akce.length,
          akce_aktivni: akce.filter((a: any) => a.aktivni).length,
          rezervace_count: rez.length,
          rezervace_zaplaceno: rez.filter((r: any) => r.stav === "zaplaceno_qr").length,
          rezervace_ceka: rez.filter((r: any) => r.stav === "ceka").length,
          trzby: rez.filter((r: any) => r.stav === "zaplaceno_qr").reduce((s: number, r: any) => s + (r.celkova_castka || 0), 0),
          posledni_rezervace: rez.slice(0, 10),
        }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      if (path === "/admin/akce") {
        const res = await fetch(`${env.SUPABASE_URL}/rest/v1/akce?select=id,nazev,typ,datum,cas_zacatek,cas_konec,kapacita,cena,aktivni,created_at${tenantFilter}&order=datum.desc`, { headers: sbHeaders });
        return new Response(await res.text(), { status: res.status, headers: { ...cors, "Content-Type": "application/json" } });
      }

      if (path === "/admin/rezervace") {
        const akce_id = url.searchParams.get("akce_id");
        let query = `${env.SUPABASE_URL}/rest/v1/rezervace?select=id,akce_id,email,jmeno,pocet_mist,celkova_castka,stav,vs,datum_platby,created_at${tenantFilter}&order=created_at.desc`;
        if (akce_id) query += `&akce_id=eq.${akce_id}`;
        const res = await fetch(query, { headers: sbHeaders });
        return new Response(await res.text(), { status: res.status, headers: { ...cors, "Content-Type": "application/json" } });
      }

      if (path === "/admin/users") {
        let query = `${env.SUPABASE_URL}/rest/v1/profiles?select=id,email,role,tenant_id,aktivni,created_at&order=created_at.desc`;
        if (user.role !== "superadmin") query += `&tenant_id=eq.${user.tenant_id}`;
        const res = await fetch(query, { headers: sbHeaders });
        return new Response(await res.text(), { status: res.status, headers: { ...cors, "Content-Type": "application/json" } });
      }
    }
    return new Response(JSON.stringify({ error: "Endpoint nenalezen" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: "Internal server error", detail: e.message || String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
  },
};
