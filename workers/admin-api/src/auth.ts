export interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenant_id: string | null;
}

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  INTERNAL_AUTH_TOKEN: string;
  RESEND_API_KEY: string;
  ENCRYPTION_KEY: string;
  FIO_PLATFORM_TOKEN: string;
}

export async function verifyAuth(request: Request, env: Env): Promise<{ user: AuthUser } | { error: string; status: number }> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: "Chybi autorizacni token", status: 401 };
  }
  const token = authHeader.slice(7);
  const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { "Authorization": `Bearer ${token}`, "apikey": env.SUPABASE_SERVICE_KEY },
  });
  if (!userRes.ok) return { error: "Neplatny token", status: 401 };
  const userData = await userRes.json() as { id: string; email: string };
  const profileRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userData.id}&select=id,role,tenant_id,aktivni,expires_at`,
    { headers: { "Authorization": `Bearer ${token}`, "apikey": env.SUPABASE_SERVICE_KEY } }
  );
  if (!profileRes.ok) return { error: "Chyba profilu", status: 500 };
  const profiles = await profileRes.json() as Array<{ id: string; role: string; tenant_id: string | null; aktivni: boolean; expires_at: string | null }>;
  if (!profiles.length) return { error: "Profil nenalezen", status: 403 };
  const profile = profiles[0];
  if (!profile.aktivni) return { error: "Ucet je deaktivovan", status: 403 };
  if (profile.expires_at && new Date(profile.expires_at) < new Date()) return { error: "Platnost vyprsela", status: 403 };
  return { user: { id: userData.id, email: userData.email, role: profile.role, tenant_id: profile.tenant_id } };
}

export function requireSuperadmin(user: AuthUser): { error: string; status: number } | null {
  if (user.role !== "superadmin") return { error: "Pristup odepren", status: 403 };
  return null;
}

export function requireAdmin(user: AuthUser): { error: string; status: number } | null {
  if (user.role !== "admin" && user.role !== "superadmin") return { error: "Pristup odepren", status: 403 };
  return null;
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { "Content-Type": "application/json" } });
}

