const fs = require('fs');
const path = require('path');

const lines = [
  '---',
  'export const prerender = true;',
  '---',
  '<!DOCTYPE html>',
  '<html lang="cs">',
  '<head>',
  '  <meta charset="UTF-8" />',
  '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
  '  <title>Rezervace \u2013 Online rezerva\u010dn\u00ed syst\u00e9m</title>',
  '  <style>',
  '    * { box-sizing: border-box; margin: 0; padding: 0; }',
  "    body { font-family: 'Segoe UI', sans-serif; background: #0D0B10; color: #E8E8F0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; }",
  '    .logo { font-size: 56px; margin-bottom: 24px; }',
  '    h1 { font-family: Georgia, serif; font-size: 36px; color: #F5E6E8; text-align: center; margin-bottom: 12px; }',
  '    .subtitle { color: #6B4A52; font-size: 15px; text-align: center; max-width: 420px; line-height: 1.6; margin-bottom: 40px; }',
  '    .features { display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; margin-bottom: 48px; }',
  '    .feature { background: #1A1015; border: 1px solid #2A1520; border-radius: 12px; padding: 20px 24px; width: 200px; text-align: center; }',
  '    .feature-icon { font-size: 28px; margin-bottom: 10px; }',
  '    .feature-title { font-size: 13px; color: #F5E6E8; font-weight: 600; margin-bottom: 4px; }',
  '    .feature-desc { font-size: 11px; color: #6B4A52; line-height: 1.5; }',
  "    .btn { padding: 13px 32px; background: linear-gradient(135deg, #8B1A2F 0%, #C0395A 100%); border-radius: 10px; color: #fff; font-size: 15px; font-weight: 600; text-decoration: none; display: inline-block; margin-bottom: 16px; }",
  '    .demo-link { font-size: 12px; color: #5A3A42; text-decoration: none; display: block; text-align: center; }',
  '  </style>',
  '</head>',
  '<body>',
  '  <div class="logo">\uD83C\uDF77</div>',
  '  <h1>Rezerva\u010dn\u00ed syst\u00e9m</h1>',
  '  <p class="subtitle">Online rezervace m\u00edst na kulturn\u00ed akce \u2014 degustace v\u00edn, p\u0159edn\u00e1\u0161ky, koncerty a dal\u0161\u00ed.</p>',
  '  <div class="features">',
  '    <div class="feature"><div class="feature-icon">\uD83C\uDFAB</div><div class="feature-title">Online rezervace</div><div class="feature-desc">Rezervujte m\u00edsta odkudkoliv, kdykoliv</div></div>',
  '    <div class="feature"><div class="feature-icon">\uD83D\uDCB3</div><div class="feature-title">Platba p\u0159evodem</div><div class="feature-desc">QR k\u00f3d a automatick\u00e9 p\u00e1rov\u00e1n\u00ed plateb</div></div>',
  '    <div class="feature"><div class="feature-icon">\uD83D\uDCE7</div><div class="feature-title">Vstupenky emailem</div><div class="feature-desc">Automatick\u00e9 odesl\u00e1n\u00ed po zaplacen\u00ed</div></div>',
  '  </div>',
  '  <a href="/novak" class="btn">Zobrazit demo \u2192</a>',
  '  <a href="/novak" class="demo-link">Vino t\u00e9ka Nov\u00e1k \u2014 uk\u00e1zkov\u00fd tenant</a>',
  '</body>',
  '</html>'
];

const content = lines.join('\n');
const target = path.join(__dirname, 'frontend', 'src', 'pages', 'index.astro');
fs.writeFileSync(target, content, 'utf8');
console.log('OK - ' + content.length + ' znaku, soubor: ' + target);
