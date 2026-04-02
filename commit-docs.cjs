// commit-docs.cjs
// Spustit v koreni projektu: node commit-docs.cjs
// Zkopiruje dokumentacni soubory a provede git commit

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Soubory ke commitu (relativni cesty od korene projektu)
const FILES = [
  'dokumentace.md',
  'rezervace-app-poznatky-vlakno.md',
  'known_good.md',
  'rezervace-app-vlakno06-dokumentace.md',
];

// Zkontrolovat ze soubory existuji
const missing = FILES.filter(f => !fs.existsSync(path.join(__dirname, f)));
if (missing.length > 0) {
  console.error('CHYBA: Chybi soubory:', missing.join(', '));
  console.error('Zkopiruj soubory ze zipu do korene projektu D:\\git\\rezervace-app\\');
  process.exit(1);
}

console.log('Pridavam soubory do Git...');
try {
  // Git add
  execSync('git add ' + FILES.join(' '), { stdio: 'inherit' });

  // Git commit
  execSync('git commit --allow-empty -m "docs: kompletni aktualizace dokumentace vlakno06"', { stdio: 'inherit' });

  // Git push
  execSync('git push', { stdio: 'inherit' });

  // Git log
  console.log('\nPosledni commity:');
  execSync('git log --oneline -3', { stdio: 'inherit' });

  console.log('\nHOTOVO. Hash zapsat do known_good.md.');
} catch (err) {
  console.error('Git chyba:', err.message);
  process.exit(1);
}
