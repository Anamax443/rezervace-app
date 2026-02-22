import os

base = os.path.join('admin', 'src', 'pages', 'superadmin')

for fname in ['index.astro', 'tenants.astro', 'users.astro', 'event-log.astro']:
    p = os.path.join(base, fname)
    c = open(p, encoding='utf-8').read()
    fixed = False

    # Fix rekurze v getLocale - nahradil se i cs-CZ uvnitr funkce
    bad = 'return window.getLang() === "en" ? "en-GB" : getLocale()'
    good = 'return window.getLang() === "en" ? "en-GB" : "cs-CZ"'
    if bad in c:
        c = c.replace(bad, good)
        fixed = True

    bad2 = "return window.getLang() === 'en' ? 'en-GB' : getLocale()"
    if bad2 in c:
        c = c.replace(bad2, good)
        fixed = True

    # Fix locale not defined - pridat const locale pred pouzitim
    if 'toLocaleDateString(locale)' in c and 'const locale = getLocale()' not in c:
        c = c.replace('tbody.innerHTML = tenants.slice', 'const locale = getLocale();\n      tbody.innerHTML = tenants.slice')
        fixed = True

    if fixed:
        open(p, 'w', encoding='utf-8').write(c)
        print(f'OK {fname} - opraveno')
    else:
        print(f'SKIP {fname} - bez problemu')
