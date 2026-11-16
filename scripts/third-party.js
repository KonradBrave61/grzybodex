// code-guard: intentional-duplicate - Node's `path` module and short local names fuzzy-match UI identifiers; no logic is duplicated.
// Regenerates src/data/third-party.json (name, version, licence of every direct runtime dependency) for the
// "Licencje i autorzy" screen. Run after changing dependencies:  node scripts/third-party.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const deps = Object.keys(require(path.join(root, 'package.json')).dependencies).sort();
const rows = deps.map((name) => {
  const pkg = require(path.join(root, 'node_modules', name, 'package.json'));
  return { name, version: pkg.version, license: typeof pkg.license === 'string' ? pkg.license : 'UNKNOWN' };
});
fs.writeFileSync(path.join(root, 'src/data/third-party.json'), JSON.stringify(rows, null, 1) + '\n');
console.log(`${rows.length} packages; unknown licence: ${rows.filter((r) => r.license === 'UNKNOWN').map((r) => r.name).join(', ') || 'none'}`);
