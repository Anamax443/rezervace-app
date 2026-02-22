import os

p = os.path.join('workers', 'admin-api', 'src', 'index.ts')
c = open(p, encoding='utf-8').read()

# Najdi radky 85-92 (oblast s duplikaty)
lines = c.split('\n')
seen = set()
clean = []
for line in lines:
    stripped = line.strip()
    if stripped in ('const logStatus = logRes.status;', 'const logError = logRes.ok ? null : await logRes.text();'):
        if stripped in seen:
            continue
        seen.add(stripped)
    clean.append(line)

open(p, 'w', encoding='utf-8').write('\n'.join(clean))
print('OK - duplikaty odstraneny')
