// ============================================================
// workers/fio-polling/src/index.ts
// Cron Worker – každých 5 minut kontroluje příchozí platby
// od zákazníků a páruje je s rezervacemi přes VS
// ============================================================

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

// ── TYPY ─────────────────────────────────────────────────────
interface Tenant {
  id: string;
  nazev: string;
  fio_api_token: string;
}

interface FioTransaction {
  column0: { value: number } | null;  // amount
  column1: { value: string } | null;  // date
  column5: { value: string } | null;  // vs
  column22: { value: string } | null; // transaction id
}

interface Rezervace {
  id: string;
  tenant_id: string;
  vs: number;
  celkova_castka: number;
  stav: string;
  email: string;
  jmeno: string | null;
  akce_id: string;
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

// ── FIO API – načtení transakcí za posledních 7 dní ──────────
async function fetchFioTransactions(token: string): Promise<FioTransaction[]> {
  const dateTo = new Date();
  const dateFrom = new Date();
  dateFrom.setDate(dateTo.getDate() - 7);

  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const url = `https://fioapi.fio.cz/v1/rest/periods/${token}/${fmt(dateFrom)}/${fmt(dateTo)}/transactions.json`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Fio API error: ${res.status}`);
    return [];
  }

  const data = await res.json() as {
    accountStatement?: {
      transactionList?: {
        transaction?: FioTransaction[]
      }
    }
  };

  return data?.accountStatement?.transactionList?.transaction ?? [];
}

// ── ZPRACOVÁNÍ PLATBY ─────────────────────────────────────────
async function processPayment(
  env: Env,
  tenant: Tenant,
  transaction: FioTransaction
): Promise<void> {
  const vs = transaction.column5?.value;
  const amount = transaction.column0?.value;

  if (!vs || !amount) return;

  // Najdi rezervaci podle VS a tenant_id
  const findRes = await supabase(
    env,
    "GET",
    `rezervace?vs=eq.${vs}&tenant_id=eq.${tenant.id}&stav=eq.čeká&select=*`
  );

  if (!findRes.ok) return;
  const rezervace: Rezervace[] = await findRes.json();
  if (rezervace.length === 0) return;

  const r = rezervace[0];

  // Ověř částku (tolerance ±1 Kč)
  if (Math.abs(amount - r.celkova_castka) > 1) {
    console.log(`VS ${vs}: částka nesedí (očekáváno ${r.celkova_castka}, přijato ${amount})`);
    return;
  }

  // Označ rezervaci jako zaplacenou
  await supabase(env, "PATCH", `rezervace?id=eq.${r.id}`, {
    stav: "zaplaceno_qr",
    datum_platby: new Date().toISOString(),
  });

  // Zapiš do billing logu
  await supabase(env, "POST", "billing_log", {
    tenant_id: tenant.id,
    udalost: "platba_prijata",
    castka: amount,
    vs: vs.toString(),
    poznamka: `Platba spárována – rezervace ${r.id}`,
  });

  console.log(`✓ Platba spárována: VS ${vs}, ${amount} Kč, tenant ${tenant.nazev}`);

  // TODO: odeslat vstupenku emailem přes Resend
  // await sendTicketEmail(env, r);
}

// ── HLAVNÍ HANDLER ────────────────────────────────────────────
export default {
  // Cron trigger – každých 5 minut
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(runPolling(env));
  },

  // HTTP trigger – pro manuální spuštění a testování
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === "/health") {
      return new Response(JSON.stringify({ status: "ok", worker: "fio-polling", timestamp: new Date().toISOString() }), { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
    if (path === "/run") {
      ctx.waitUntil(runPolling(env));
      return new Response("Polling spuštěn", { status: 200 });
    }
    return new Response("fio-polling worker", { status: 200 });
  },
};

// ── POLLING LOGIKA ────────────────────────────────────────────
async function runPolling(env: Env): Promise<void> {
  console.log(`[fio-polling] Start: ${new Date().toISOString()}`);

  // Načti všechny aktivní tenanty s Fio tokenem
  const tenantsRes = await supabase(
    env,
    "GET",
    "tenants?aktivni=eq.true&fio_api_token=not.is.null&select=id,nazev,fio_api_token"
  );

  if (!tenantsRes.ok) {
    console.error("Nepodařilo se načíst tenanty");
    return;
  }

  const tenants: Tenant[] = await tenantsRes.json();
  console.log(`[fio-polling] Kontroluji ${tenants.length} tenantů`);

  // Pro každého tenanta zkontroluj platby
  for (const tenant of tenants) {
    try {
      const transactions = await fetchFioTransactions(tenant.fio_api_token);
      console.log(`[fio-polling] ${tenant.nazev}: ${transactions.length} transakcí`);

      for (const tx of transactions) {
        await processPayment(env, tenant, tx);
      }
    } catch (err) {
      console.error(`[fio-polling] Chyba pro tenant ${tenant.nazev}:`, err);
    }
  }

  console.log(`[fio-polling] Hotovo: ${new Date().toISOString()}`);
}