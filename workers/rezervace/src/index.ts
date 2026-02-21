// ============================================================
// workers/rezervace/src/index.ts
// API Worker – vytvoření rezervace, ověření QR vstupenky
// ============================================================

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  RESEND_API_KEY: string;
}

// ── CORS HEADERS ──────────────────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// ── SUPABASE HELPER ───────────────────────────────────────────
async function supabase(
  env: Env,
  method: string,
  path: string,
  body?: unknown
): Promise<Response> {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=representation" : "return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── RESEND – email s instrukcemi k platbě ─────────────────────
async function sendPaymentEmail(
  env: Env,
  email: string,
  jmeno: string | null,
  akceNazev: string,
  castka: number,
  vs: number,
  fioUcet: string
): Promise<void> {
  const html = `
    <h2>Rezervace potvrzena – ${akceNazev}</h2>
    <p>Dobrý den${jmeno ? ` ${jmeno}` : ""},</p>
    <p>Vaše rezervace byla přijata. Pro dokončení prosím proveďte platbu:</p>
    <table>
      <tr><td><strong>Částka:</strong></td><td>${castka} Kč</td></tr>
      <tr><td><strong>Číslo účtu:</strong></td><td>${fioUcet}</td></tr>
      <tr><td><strong>Variabilní symbol:</strong></td><td>${vs}</td></tr>
    </table>
    <p>Po přijetí platby vám zašleme vstupenku s QR kódem.</p>
    <p><em>Rezervační systém</em></p>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "rezervace@rezervace-app.pages.dev",
      to: email,
      subject: `Rezervace – ${akceNazev} (VS: ${vs})`,
      html,
    }),
  });
}

// ── ROUTE: POST /rezervace ────────────────────────────────────
async function createRezervace(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as {
    akce_id: string;
    tenant_id: string;
    email: string;
    jmeno?: string;
    pocet_mist: number;
  };

  const { akce_id, tenant_id, email, jmeno, pocet_mist } = body;

  // Validace
  if (!akce_id || !tenant_id || !email || !pocet_mist) {
    return json({ error: "Chybí povinné pole" }, 400);
  }
  if (pocet_mist < 1 || pocet_mist > 10) {
    return json({ error: "Počet míst musí být 1–10" }, 400);
  }

  // Načti akci
  const akceRes = await supabase(
    env, "GET",
    `akce_obsazenost?id=eq.${akce_id}&tenant_id=eq.${tenant_id}&aktivni=eq.true`
  );
  if (!akceRes.ok) return json({ error: "Chyba serveru" }, 500);
  const akce = await akceRes.json() as {
    id: string; nazev: string; cena: number; volno: number;
  }[];
  if (akce.length === 0) return json({ error: "Akce nenalezena" }, 404);
  if (akce[0].volno < pocet_mist) return json({ error: "Nedostatek volných míst" }, 409);

  // Načti Fio účet tenantu
  const tenantRes = await supabase(env, "GET", `tenants?id=eq.${tenant_id}&select=fio_ucet,nazev`);
  const tenants = await tenantRes.json() as { fio_ucet: string; nazev: string }[];
  if (tenants.length === 0) return json({ error: "Tenant nenalezen" }, 404);

  // Vygeneruj VS
  const vsRes = await supabase(env, "GET", "rpc/nextval?sequence=vs_rezervace_seq");
  // Fallback – použij timestamp jako VS
  const vs = Date.now() % 9000000 + 100000;

  const celkova_castka = akce[0].cena * pocet_mist;

  // Vytvoř rezervaci
  const rezRes = await supabase(env, "POST", "rezervace", {
    tenant_id,
    akce_id,
    vs,
    email,
    jmeno: jmeno || null,
    pocet_mist,
    celkova_castka,
    stav: "čeká",
  });

  if (!rezRes.ok) return json({ error: "Nepodařilo se vytvořit rezervaci" }, 500);
  const rezervace = await rezRes.json() as { id: string; vstupenka_token: string }[];

  // Pošli email s instrukcemi k platbě
  await sendPaymentEmail(
    env, email, jmeno || null,
    akce[0].nazev, celkova_castka, vs, tenants[0].fio_ucet
  );

  return json({
    success: true,
    rezervace_id: rezervace[0].id,
    vs,
    castka: celkova_castka,
    message: "Rezervace vytvořena, zkontrolujte email",
  });
}

// ── ROUTE: GET /vstupenka/:token ──────────────────────────────
async function getVstupenka(token: string, env: Env): Promise<Response> {
  const res = await supabase(
    env, "GET",
    `rezervace?vstupenka_token=eq.${token}&select=*,akce(nazev,datum,cas_zacatek,cas_konec)`
  );
  if (!res.ok) return json({ error: "Chyba serveru" }, 500);
  const data = await res.json() as unknown[];
  if (data.length === 0) return json({ error: "Vstupenka nenalezena" }, 404);
  return json(data[0]);
}

// ── ROUTE: POST /vstupenka/:token/pouzit ─────────────────────
async function useVstupenka(token: string, env: Env): Promise<Response> {
  // Načti rezervaci
  const res = await supabase(env, "GET", `rezervace?vstupenka_token=eq.${token}&select=*`);
  if (!res.ok) return json({ error: "Chyba serveru" }, 500);
  const data = await res.json() as {
    id: string; stav: string; vstupenka_pouzita: boolean;
  }[];

  if (data.length === 0) return json({ error: "Vstupenka nenalezena" }, 404);
  const r = data[0];

  if (r.vstupenka_pouzita) return json({ error: "Vstupenka již byla použita" }, 409);
  if (r.stav === "čeká") return json({ error: "Rezervace není zaplacena" }, 402);
  if (r.stav === "zrušeno") return json({ error: "Rezervace je zrušena" }, 410);

  // Označ jako použitou
  await supabase(env, "PATCH", `rezervace?id=eq.${r.id}`, {
    vstupenka_pouzita: true,
  });

  return json({ success: true, message: "Vstupenka ověřena ✓" });
}

// ── HLAVNÍ HANDLER ────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    // POST /rezervace
    if (method === "POST" && path === "/rezervace") {
      return createRezervace(request, env);
    }

    // GET /vstupenka/:token
    const vstupenkaMatch = path.match(/^\/vstupenka\/([a-f0-9-]{36})$/);
    if (method === "GET" && vstupenkaMatch) {
      return getVstupenka(vstupenkaMatch[1], env);
    }

    // POST /vstupenka/:token/pouzit
    const pouzitMatch = path.match(/^\/vstupenka\/([a-f0-9-]{36})\/pouzit$/);
    if (method === "POST" && pouzitMatch) {
      return useVstupenka(pouzitMatch[1], env);
    }

    return json({ error: "Not found" }, 404);
  },
};