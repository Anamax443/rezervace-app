import os

content = (
    "---\n"
    "export const prerender = true;\n"
    "---\n"
    "<!DOCTYPE html>\n"
    '<html lang="cs">\n'
    "<head>\n"
    '  <meta charset="UTF-8" />\n'
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n'
    "  <title>Rezervace \u2013 Online rezerva\u010dn\u00ed syst\u00e9m</title>\n"
    "  <style>\n"
    "    * { box-sizing: border-box; margin: 0; padding: 0; }\n"
    "    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0D0B10; color: #E8E8F0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; }\n"
    "    .logo { font-size: 56px; margin-bottom: 24px; }\n"
    "    h1 { font-family: Georgia, serif; font-size: 36px; color: #F5E6E8; text-align: center; margin-bottom: 12px; }\n"
    "    .subtitle { color: #6B4A52; font-size: 15px; text-align: center; max-width: 420px; line-height: 1.6; margin-bottom: 40px; }\n"
    "    .features { display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; margin-bottom: 48px; }\n"
    "    .feature { background: #1A1015; border: 1px solid #2A1520; border-radius: 12px; padding: 20px 24px; width: 200px; text-align: center; }\n"
    "    .feature-icon { font-size: 28px; margin-bottom: 10px; }\n"
    "    .feature-title { font-size: 13px; color: #F5E6E8; font-weight: 600; margin-bottom: 4px; }\n"
    "    .feature-desc { font-size: 11px; color: #6B4A52; line-height: 1.5; }\n"
    "    .btn { padding: 13px 32px; background: linear-gradient(135deg, #8B1A2F 0%, #C0395A 100%); border: none; border-radius: 10px; color: #fff; font-size: 15px; font-weight: 600; text-decoration: none; display: inline-block; margin-bottom: 16px; }\n"
    "    .demo-link { font-size: 12px; color: #5A3A42; text-decoration: none; display: block; text-align: center; }\n"
    "    .demo-link:hover { color: #C0395A; }\n"
    "    .divider { width: 1px; height: 40px; background: #2A1520; margin: 0 auto 40px; }\n"
    "  </style>\n"
    "</head>\n"
    "<body>\n"
    '  <div class="logo">\U0001f377</div>\n'
    "  <h1>Rezerva\u010dn\u00ed syst\u00e9m</h1>\n"
    '  <p class="subtitle">Online rezervace m\u00edst na kulturn\u00ed akce \u2014 degustace v\u00edn, p\u0159edn\u00e1\u0161ky, koncerty a dal\u0161\u00ed.</p>\n'
    "\n"
    '  <div class="features">\n'
    '    <div class="feature">\n'
    '      <div class="feature-icon">\U0001f3ab</div>\n'
    '      <div class="feature-title">Online rezervace</div>\n'
    '      <div class="feature-desc">Rezervujte m\u00edsta odkudkoliv, kdykoliv</div>\n'
    "    </div>\n"
    '    <div class="feature">\n'
    '      <div class="feature-icon">\U0001f4b3</div>\n'
    '      <div class="feature-title">Platba p\u0159evodem</div>\n'
    '      <div class="feature-desc">QR k\u00f3d a automatick\u00e9 p\u00e1rov\u00e1n\u00ed plateb</div>\n'
    "    </div>\n"
    '    <div class="feature">\n'
    '      <div class="feature-icon">\U0001f4e7</div>\n'
    '      <div class="feature-title">Vstupenky emailem</div>\n'
    '      <div class="feature-desc">Automatick\u00e9 odesl\u00e1n\u00ed po zaplacen\u00ed</div>\n'
    "    </div>\n"
    "  </div>\n"
    "\n"
    '  <div class="divider"></div>\n'
    "\n"
    '  <a href="/novak" class="btn">\U0001f441 Zobrazit demo</a>\n'
    '  <a href="/novak" class="demo-link">Vino t\u00e9ka Nov\u00e1k \u2014 uk\u00e1zkov\u00fd tenant</a>\n'
    "</body>\n"
    "</html>\n"
)

path = r"D:\git\rezervace-app\frontend\src\pages\index.astro"
with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("OK - soubor vytvoren")
