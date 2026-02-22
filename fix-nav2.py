import os

base = os.path.join('admin', 'src', 'pages', 'superadmin')
for fname in ['index.astro', 'tenants.astro', 'users.astro', 'event-log.astro']:
    p = os.path.join(base, fname)
    c = open(p, encoding='utf-8').read()
    if '/superadmin/system' not in c:
        c = c.replace(
            'data-i18n="eventLog">Event Log</span></a>\n    </nav>',
            'data-i18n="eventLog">Event Log</span></a>\n      <a href="/superadmin/system">\u2699\ufe0f <span data-i18n="systemCheck">Stav syst\u00e9mu</span></a>\n    </nav>'
        )
        open(p, 'w', encoding='utf-8').write(c)
        print(f'OK {fname}')
    else:
        print(f'SKIP {fname} - uz tam je')
