# add_health_endpoints.py
# Spustit z D:\git\rezervace-app
# python add_health_endpoints.py

import os

base = os.path.dirname(os.path.abspath(__file__))
if not os.path.exists(os.path.join(base, 'workers')):
    base = r'D:\git\rezervace-app'

patches = [
    {
        "name": "fio-polling",
        "file": os.path.join(base, "workers", "fio-polling", "src", "index.ts"),
        "old": '    if (new URL(request.url).pathname === "/run") {',
        "new": '''    const path = new URL(request.url).pathname;
    if (path === "/health") {
      return new Response(JSON.stringify({ status: "ok", worker: "fio-polling", timestamp: new Date().toISOString() }), { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
    if (path === "/run") {''',
    },
    {
        "name": "fio-billing",
        "file": os.path.join(base, "workers", "fio-billing", "src", "index.ts"),
        "old": '    if (new URL(request.url).pathname === "/run") {',
        "new": '''    const path = new URL(request.url).pathname;
    if (path === "/health") {
      return new Response(JSON.stringify({ status: "ok", worker: "fio-billing", timestamp: new Date().toISOString() }), { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
    if (path === "/run") {''',
    },
    {
        "name": "rezervace",
        "file": os.path.join(base, "workers", "rezervace", "src", "index.ts"),
        "old": '    // CORS preflight\n    if (method === "OPTIONS") {',
        "new": '''    // Health check
    if (path === "/health") {
      return new Response(JSON.stringify({ status: "ok", worker: "rezervace", timestamp: new Date().toISOString() }), { status: 200, headers: { "Content-Type": "application/json", ...CORS } });
    }

    // CORS preflight
    if (method === "OPTIONS") {''',
    },
    {
        "name": "image-optimizer",
        "file": os.path.join(base, "workers", "image-optimizer", "src", "index.ts"),
        "old": '    if (request.method === "OPTIONS") {\n      return new Response(null, { headers: CORS });\n    }\n\n    if (request.method !== "POST") {',
        "new": '''    if (new URL(request.url).pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", worker: "image-optimizer", timestamp: new Date().toISOString() }), { status: 200, headers: { "Content-Type": "application/json", ...CORS } });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    if (request.method !== "POST") {''',
    },
]

for p in patches:
    print(f"\n--- {p['name']} ---")
    if not os.path.exists(p["file"]):
        print(f"  CHYBA: soubor nenalezen: {p['file']}")
        continue

    c = open(p["file"], encoding="utf-8").read()

    if "/health" in c:
        print(f"  PRESKOCENO: /health uz existuje")
        continue

    if p["old"] not in c:
        print(f"  CHYBA: pattern nenalezen v souboru")
        print(f"  Hledam: {repr(p['old'][:80])}")
        continue

    c = c.replace(p["old"], p["new"], 1)
    open(p["file"], "w", encoding="utf-8", newline="\n").write(c)
    print(f"  OK: /health endpoint pridan")

print("\n=== Hotovo ===")
print("Ted spust deploy pro kazdy worker:")
print("  cd workers/fio-polling && npx wrangler deploy && cd ../..")
print("  cd workers/fio-billing && npx wrangler deploy && cd ../..")
print("  cd workers/rezervace && npx wrangler deploy && cd ../..")
print("  cd workers/image-optimizer && npx wrangler deploy && cd ../..")
