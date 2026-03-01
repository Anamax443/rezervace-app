import re

f = 'D:/git/rezervace-app/workers/admin-api/src/index.ts'
c = open(f, encoding='utf-8').read()

# Najdi vsechny template literals bez backtick: text${...}text (bez backtick na zacatku)
# Pattern: neni backtick pred ${, ale je to uvnitr stringu
before = c

# Oprav Bearer ${...} bez backtick
c = re.sub(r'"Bearer \$\{', '`Bearer ${', c)
c = re.sub(r'Bearer \$\{([^}]+)\}"', 'Bearer ${\\1}`', c)

# Oprav fetch(${env...}/path, { -> fetch(`${env...}/path`, {
c = re.sub(r'fetch\(\$\{([^}]+)\}([^,]+),\s*\{', r'fetch(`${\1}\2`, {', c)

# Oprav ostatni stringy s ${} bez backtick
# Pattern: "text ${var} text" -> `text ${var} text`
lines = c.split('\n')
fixed = []
for line in lines:
    # Pokud radek obsahuje ${ ale neni v backtick template
    if '${' in line and '`' not in line:
        # Nahrad " kolem template literal za backtick
        line = re.sub(r'"([^"]*\$\{[^"]*)"', r'`\1`', line)
    fixed.append(line)
c = '\n'.join(fixed)

open(f, 'w', encoding='utf-8', newline='\n').write(c)

# Overeni
remaining = len(re.findall(r'[^`]\$\{[^}]+\}[^`]', c))
print('Opraveno.')
print('Pocet radku:', len(lines))
print('Mozne zbyvajici:', remaining)
