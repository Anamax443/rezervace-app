// ============================================================
// workers/fio-billing/src/index.ts
// Cron Worker – každých 6 hodin kontroluje platby předplatného
// od tenantů a aktualizuje jejich plán
// ============================================================

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  FIO_PLATFORM_TOKEN: string;
  RESEND_API_KEY: string;
}

// ── TYPY ─────────────────────────────────────────────────────
interface Tenant {
  id: string;
  nazev: string;
  subdomain: string;
  plan: string;
  plan_status: string;
  plan_expirace: string | null;
  trial_vyuzit: boolean;
  vs: string; // VS = posledních 4 čísla z ID tenantu
}

interface FioTransaction {
  column0: { value: number } | null;  // amount
  column1: { value: string } | null;  // date
  column5: { value: string } | null;  // vs
  column22: { value: string } | null; // transaction id
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
      Prefer: "return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── RESEND – odeslání emailu ──────────────────────────────────
async function sendEmail(
  env: Env,
  to: string,
  subject: string,
  html: string
): Promise<void> {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "billing@rezervace-app.pages.dev",
      to,
      subject,
      html,
    }),
  });
}

// ── FIO API – načtení transakcí za posledních 30 dní ─────────
async function fetchPlatformTransactions(token: string): Promise<FioTransaction[]> {
  const dateTo = new Date();
  const dateFrom = new Date();
  dateFrom.setDate(dateTo.getDate() - 30);

  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const url = `https://fioapi.fio.cz/v1/rest/periods/${token}/${fmt(dateFrom)}/${fmt(dateTo)}/transactions.json`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Fio platform API error: ${res.status}`);
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

// ── BILLING LOG ───────────────────────────────────────────────
async function logBilling(
  env: Env,
  tenantId: string,
  udalost: string,
  castka?: number,
  poznamka?: string
): Promise<void> {
  await supabase(env, "POST", "billing_log", {
    tenant_id: tenantId,
    udalost,
    castka: castka ?? null,
    poznamka: poznamka ?? null,
  });
}

// ── KONTROLA EXPIRACÍ ─────────────────────────────────────────
async function checkExpirations(env: Env): Promise<void> {
  const now = new Date();

  // Načti tenanty které expirují nebo jsou po expiraci
  const res = await supabase(
    env,
    "GET",
    `tenants?aktivni=eq.true&plan_status=in.(active,trial)&plan_expirace=not.is.null&select=*`
  );

  if (!res.ok) return;
  const tenants: Tenant[] = await res.json();

  for (const tenant of tenants) {
    if (!tenant.plan_expirace) continue;

    const expirace = new Date(tenant.plan_expirace);
    const daysLeft = Math.floor((expirace.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // 7 dní před expirací – upozornění
    if (daysLeft === 7) {
      await logBilling(env, tenant.id, "email_upozorneni", undefined, `Plán expiruje za 7 dní`);
      console.log(`⚠ Upozornění: ${tenant.nazev} expiruje za 7 dní`);
      // TODO: odeslat email adminovi tenantu
    }

    // Expirace nastala – přechod do grace period
    if (daysLeft < 0 && tenant.plan_status !== "grace") {
      await supabase(env, "PATCH", `tenants?id=eq.${tenant.id}`, {
        plan_status: "grace",
      });
      await logBilling(env, tenant.id, "grace_period_start", undefined, `Grace period 7 dní zahájena`);
      console.log(`⏰ Grace period: ${tenant.nazev}`);
    }

    // Grace period +7 dní – deaktivace
    if (daysLeft < -7 && tenant.plan_status === "grace") {
      await supabase(env, "PATCH", `tenants?id=eq.${tenant.id}`, {
        plan_status: "deactivated",
        aktivni: false,
      });
      await logBilling(env, tenant.id, "deaktivace", undefined, `Účet deaktivován po grace periodě`);
      console.log(`✗ Deaktivace: ${tenant.nazev}`);
    }
  }
}

// ── ZPRACOVÁNÍ PLATBY PŘEDPLATNÉHO ───────────────────────────
async function processBillingPayment(
  env: Env,
  tenants: Tenant[],
  transaction: FioTransaction
): Promise<void> {
  const vs = transaction.column5?.value;
  const amount = transaction.column0?.value;

  if (!vs || !amount || amount <= 0) return;

  // VS předplatného = ID tenantu (první 4 znaky bez pomlček)
  const tenant = tenants.find(t => t.id.replace(/-/g, "").startsWith(vs.padStart(8, "0")));
  if (!tenant) {
    console.log(`Billing: VS ${vs} – tenant nenalezen`);
    return;
  }

  // Urči plán podle částky
  let newPlan: string | null = null;
  let daysToAdd = 0;

  if (Math.abs(amount - 490) <= 1) {
    newPlan = "monthly";
    daysToAdd = 30;
  } else if (Math.abs(amount - 4490) <= 1) {
    newPlan = "annual";
    daysToAdd = 365;
  }

  if (!newPlan) {
    console.log(`Billing: VS ${vs} – neznámá částka ${amount} Kč`);
    return;
  }

  // Aktualizuj tenant
  const now = new Date();
  const expirace = new Date(now);
  expirace.setDate(now.getDate() + daysToAdd);

  await supabase(env, "PATCH", `tenants?id=eq.${tenant.id}`, {
    plan: newPlan,
    plan_status: "active",
    plan_zacatek: now.toISOString(),
    plan_expirace: expirace.toISOString(),
    aktivni: true,
  });

  await logBilling(
    env,
    tenant.id,
    "platba_prijata",
    amount,
    `Předplatné ${newPlan} aktivováno do ${expirace.toISOString().split("T")[0]}`
  );

  console.log(`✓ Billing platba: ${tenant.nazev} → ${newPlan} do ${expirace.toISOString().split("T")[0]}`);
}

// ── HLAVNÍ HANDLER ────────────────────────────────────────────
export default {
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(runBillingCheck(env));
  },

  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === "/health") {
      return new Response(JSON.stringify({ status: "ok", worker: "fio-billing", timestamp: new Date().toISOString() }), { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
    if (path === "/run") {
      ctx.waitUntil(runBillingCheck(env));
      return new Response("Billing check spuštěn", { status: 200 });
    }
    return new Response("fio-billing worker", { status: 200 });
  },
};

// ── BILLING LOGIKA ────────────────────────────────────────────
async function runBillingCheck(env: Env): Promise<void> {
  console.log(`[fio-billing] Start: ${new Date().toISOString()}`);

  // 1. Zkontroluj expirace
  await checkExpirations(env);

  // 2. Načti platby na platformní účet
  const transactions = await fetchPlatformTransactions(env.FIO_PLATFORM_TOKEN);
  console.log(`[fio-billing] ${transactions.length} transakcí na platformním účtu`);

  // 3. Načti všechny tenanty
  const tenantsRes = await supabase(env, "GET", "tenants?select=*");
  if (!tenantsRes.ok) return;
  const tenants: Tenant[] = await tenantsRes.json();

  // 4. Zpracuj každou transakci
  for (const tx of transactions) {
    await processBillingPayment(env, tenants, tx);
  }

  console.log(`[fio-billing] Hotovo: ${new Date().toISOString()}`);
}