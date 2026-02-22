
window.translations = {
  cs: {
  dashboard: 'Dashboard',
  tenants: 'Tenanti',
  users: 'Uživatelé',
  eventLog: 'Event Log',
  logout: 'Odhlásit',
  loading: 'Načítám...',
  noData: 'Žádné záznamy',
  noTenants: 'Žádní tenanti',
  noUsers: 'Žádní uživatelé',
  search: 'Hledat...',
  export: 'Export',
  filter: 'Filtr',
  all: 'Vše',
  totalTenants: 'Celkem tenantů',
  active: 'Aktivní',
  trial: 'Trial',
  deactivated: 'Deaktivovaní',
  lastTenants: 'Poslední tenanti',
  name: 'Název',
  subdomain: 'Subdoména',
  plan: 'Plán',
  status: 'Status',
  isActive: 'Aktivní',
  expiration: 'Expirace',
  created: 'Vytvořen',
  email: 'Email',
  role: 'Role',
  tenant: 'Tenant',
  time: 'Čas',
  category: 'Kategorie',
  source: 'Zdroj',
  message: 'Zpráva',
  yes: 'Ano',
  no: 'Ne',
  language: 'Jazyk',
  systemCheck: 'Stav systému',
  runCheck: 'Spustit kontrolu',
  running: 'Kontroluji...',
  service: 'Služba',
  latency: 'Latence',
  detail: 'Detail',
  overallOk: 'Všechny služby fungují',
  overallDegraded: 'Některé služby mají problém',
  },
  en: {
  dashboard: 'Dashboard',
  tenants: 'Tenants',
  users: 'Users',
  eventLog: 'Event Log',
  logout: 'Logout',
  loading: 'Loading...',
  noData: 'No records',
  noTenants: 'No tenants',
  noUsers: 'No users',
  search: 'Search...',
  export: 'Export',
  filter: 'Filter',
  all: 'All',
  totalTenants: 'Total tenants',
  active: 'Active',
  trial: 'Trial',
  deactivated: 'Deactivated',
  lastTenants: 'Recent tenants',
  name: 'Name',
  subdomain: 'Subdomain',
  plan: 'Plan',
  status: 'Status',
  isActive: 'Active',
  expiration: 'Expiration',
  created: 'Created',
  email: 'Email',
  role: 'Role',
  tenant: 'Tenant',
  time: 'Time',
  category: 'Category',
  source: 'Source',
  message: 'Message',
  yes: 'Yes',
  no: 'No',
  language: 'Language',
  systemCheck: 'System Status',
  runCheck: 'Run Check',
  running: 'Checking...',
  service: 'Service',
  latency: 'Latency',
  detail: 'Detail',
  overallOk: 'All services operational',
  overallDegraded: 'Some services have issues',
  }
};

window.getLang = function() {
  return localStorage.getItem('lang') || 'cs';
};

window.setLang = function(lang) {
  localStorage.setItem('lang', lang);
  location.reload();
};

window.t = function(key) {
  var lang = window.getLang();
  return (window.translations[lang] && window.translations[lang][key]) || key;
};

document.addEventListener('DOMContentLoaded', function() {
  var lang = window.getLang();
  // Aktualizuj lang button
  var btn = document.getElementById('lang-btn');
  if (btn) btn.textContent = lang.toUpperCase() + ' ▼';
  // Preloz vsechny elementy s data-i18n
  document.querySelectorAll('[data-i18n]').forEach(function(el) {
    var key = el.getAttribute('data-i18n');
    el.textContent = window.t(key);
  });
});
