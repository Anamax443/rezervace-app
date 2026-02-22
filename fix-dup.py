import os
p = os.path.join('workers', 'admin-api', 'src', 'index.ts')
c = open(p, encoding='utf-8').read()
c = c.replace('const logRes = const logRes =', 'const logRes =')
open(p, 'w', encoding='utf-8').write(c)
print('OK - duplikat opraven')
