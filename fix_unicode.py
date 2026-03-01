import re

f = 'D:/git/rezervace-app/admin/src/pages/superadmin/system.astro'
c = open(f, encoding='utf-8').read()

# 1. Surrogatni pary (emoji) -> spravny Unicode
def pair(m):
    hi = int(m.group(1), 16)
    lo = int(m.group(2), 16)
    cp = 0x10000 + (hi - 0xD800) * 0x400 + (lo - 0xDC00)
    return chr(cp)

c = re.sub(r'\\u(d[89ab][0-9a-f]{2})\\u(d[c-f][0-9a-f]{2})', pair, c, flags=re.I)

# 2. Zbyle \uXXXX -> znak
def single(m):
    return chr(int(m.group(1), 16))

c = re.sub(r'\\u([0-9a-fA-F]{4})', single, c)

# 3. Zapis
open(f, 'w', encoding='utf-8', newline='\n').write(c)

# 4. Overeni
t = open(f, encoding='utf-8').read()
print('Zapsano:', len(t), 'znaku')
print('Zbyvajici escapes:', len(re.findall(r'\\u[0-9a-fA-F]{4}', t)))
print('Hotovo.')
