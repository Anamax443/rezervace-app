import os

p = os.path.join('admin', 'src', 'pages', 'superadmin', 'system.astro')
c = open(p, encoding='utf-8').read()

# Fix onclick na buttonu
c = c.replace('onclick="runCheck()"', 'id="check-btn"')
# Kdyby id uz bylo duplicitni
if c.count('id="check-btn"') > 1:
    c = c.replace('id="check-btn" id="check-btn"', 'id="check-btn"')

# Pridej addEventListener na konec scriptu pred </script>
if 'addEventListener' not in c or 'check-btn' not in c.split('addEventListener')[-1]:
    c = c.replace(
        '})();\n  </script>',
        '})();\n    document.getElementById("check-btn").addEventListener("click", runCheck);\n  </script>'
    )

open(p, 'w', encoding='utf-8').write(c)
print('OK system.astro - onclick nahrazen addEventListener')
