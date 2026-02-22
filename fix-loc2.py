import os
base = os.path.join('admin', 'src', 'pages', 'superadmin')
for fname in ['tenants.astro', 'users.astro']:
    p = os.path.join(base, fname)
    c = open(p, encoding='utf-8').read()
    if '"en-GB" : locale;' in c:
        c = c.replace('"en-GB" : locale;', '"en-GB" : "cs-CZ";')
        open(p, 'w', encoding='utf-8').write(c)
        print(f'OK {fname}')
    else:
        print(f'SKIP {fname}')
