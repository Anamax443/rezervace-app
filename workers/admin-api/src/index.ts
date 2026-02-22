import { verifyAuth, requireSuperadmin, jsonResponse, type Env } from "./auth";
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
    return new Response(JSON.stringify({ error: "Endpoint nenalezen" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
  },
};
