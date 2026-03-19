// ============================================================
// workers/image-optimizer/src/index.ts
// Worker – příjem obrázku, konverze na WebP, uložení do
// Supabase Storage ve 3 variantách (thumbnail, card, hero)
// ============================================================

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// ── VARIANTY OBRÁZKŮ ─────────────────────────────────────────
const VARIANTS = [
  { name: "thumbnail", width: 200, height: 150 },
  { name: "card",      width: 800, height: 500 },
  { name: "hero",      width: 1600, height: 900 },
];

// ── UPLOAD DO SUPABASE STORAGE ────────────────────────────────
async function uploadToStorage(
  env: Env,
  path: string,
  imageData: ArrayBuffer,
  contentType: string
): Promise<string> {
  const res = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/akce-obrazky/${path}`,
    {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: imageData,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Storage upload failed: ${err}`);
  }

  return `${env.SUPABASE_URL}/storage/v1/object/public/akce-obrazky/${path}`;
}

// ── CLOUDFLARE IMAGE RESIZING ─────────────────────────────────
async function resizeImage(
  imageUrl: string,
  width: number,
  height: number
): Promise<ArrayBuffer> {
  const res = await fetch(imageUrl, {
    // @ts-ignore
    cf: {
      image: {
        width,
        height,
        fit: "cover",
        format: "webp",
        quality: 85,
      },
    },
  });

  if (!res.ok) throw new Error(`Image resize failed: ${res.status}`);
  return res.arrayBuffer();
}

// ── HLAVNÍ HANDLER ────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", worker: "image-optimizer", timestamp: new Date().toISOString() }), { status: 200, headers: { "Content-Type": "application/json", ...CORS } });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    try {
      const formData = await request.formData();
      const file = formData.get("image") as File | null;
      const tenantId = formData.get("tenant_id") as string | null;
      const akceId = formData.get("akce_id") as string | null;

      if (!file || !tenantId || !akceId) {
        return json({ error: "Chybí image, tenant_id nebo akce_id" }, 400);
      }

      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        return json({ error: "Povolené formáty: JPG, PNG, WebP" }, 400);
      }

      if (file.size > 5 * 1024 * 1024) {
        return json({ error: "Maximální velikost souboru je 5 MB" }, 400);
      }

      // Ulož originál
      const originalBuffer = await file.arrayBuffer();
      const ext = file.type.split("/")[1];
      const originalPath = `${tenantId}/${akceId}/original.${ext}`;
      const originalUrl = await uploadToStorage(env, originalPath, originalBuffer, file.type);

      // Vygeneruj a ulož varianty
      const urls: Record<string, string> = {};

      for (const variant of VARIANTS) {
        const resized = await resizeImage(originalUrl, variant.width, variant.height);
        const path = `${tenantId}/${akceId}/${variant.name}.webp`;
        const url = await uploadToStorage(env, path, resized, "image/webp");
        urls[variant.name] = url;
        console.log(`✓ ${variant.name}: ${path}`);
      }

      // Aktualizuj akci v DB
      await fetch(`${env.SUPABASE_URL}/rest/v1/akce?id=eq.${akceId}`, {
        method: "PATCH",
        headers: {
          apikey: env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image_path: `${tenantId}/${akceId}` }),
      });

      return json({
        success: true,
        paths: {
          original: originalPath,
          thumbnail: `${tenantId}/${akceId}/thumbnail.webp`,
          card: `${tenantId}/${akceId}/card.webp`,
          hero: `${tenantId}/${akceId}/hero.webp`,
        },
        urls,
      });

    } catch (err) {
      console.error("Image optimizer error:", err);
      return json({ error: "Interní chyba serveru" }, 500);
    }
  },
};