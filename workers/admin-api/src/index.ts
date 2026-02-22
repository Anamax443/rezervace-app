import { verifyAuth, requireSuperadmin, requireAdmin, jsonResponse, type Env } from "./auth";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" };
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
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
      const sbHeaders = { "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`, "apikey": env.SUPABASE_SERVICE_KEY };
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
      const sbHeaders = { "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`, "apikey": env.SUPABASE_SERVICE_KEY };
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
  },
};