import os

p = os.path.join('admin', 'src', 'pages', 'superadmin', 'event-log.astro')
c = open(p, encoding='utf-8').read()

# Nahrad onclick na filter buttonech za data atributy
c = c.replace("onclick=\"setFilter(null, this)\"", "data-filter=\"all\"")
c = c.replace("onclick=\"setFilter('information', this)\"", "data-filter=\"information\"")
c = c.replace("onclick=\"setFilter('warning', this)\"", "data-filter=\"warning\"")
c = c.replace("onclick=\"setFilter('error', this)\"", "data-filter=\"error\"")
c = c.replace("onclick=\"setFilter('critical', this)\"", "data-filter=\"critical\"")

# Nahrad setFilter funkci a pridej addEventListener
old_setfilter = """    function setFilter(kat, btn) {
      currentFilter = kat;
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadLogs();
    }"""

new_setfilter = """    function setFilter(kat, btn) {
      currentFilter = kat;
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadLogs();
    }
    document.querySelectorAll("[data-filter]").forEach(function(btn) {
      btn.addEventListener("click", function() {
        var f = btn.getAttribute("data-filter");
        setFilter(f === "all" ? null : f, btn);
      });
    });"""

c = c.replace(old_setfilter, new_setfilter)

# Fix logout onclick
c = c.replace('onclick="logout()"', 'id="logout-btn"')
if 'logout-btn' in c and 'getElementById("logout-btn")' not in c:
    c = c.replace('</script>', '    document.getElementById("logout-btn").addEventListener("click", logout);\n  </script>')

open(p, 'w', encoding='utf-8').write(c)
print('OK event-log.astro - onclick nahrazeny addEventListener')
