// code-guard: intentional-duplicate - Node's `path`/`fs` names and short locals fuzzy-match UI identifiers; no logic is duplicated.
// Cuts the offline map packs (one PMTiles file per voivodeship × level) from a Protomaps daily build and writes
// src/features/map/offline/packs.json with exact sizes and SHA-256 sums. Map data: OpenStreetMap (ODbL).
//
// Needs the go-pmtiles CLI (https://github.com/protomaps/go-pmtiles/releases) and region GeoJSONs (voivodeship borders
// from GUGiK PRG, buffered ~1 km), one file per voivodeship id: <regions>/<id>.geojson.
//   node scripts/build-map-packs.js --pmtiles <pmtiles.exe> --regions <dir> --out <dir> --build 20261106 [--base-url URL]
// Re-running skips files that already exist in --out. Upload --out/*.pmtiles to the release that --base-url points at.
/* global __dirname */
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
for (const k of ['pmtiles', 'regions', 'out', 'build']) if (!args[k]) throw new Error(`missing --${k}`);

const LEVELS = { z13: 13, z15: 15 };
const OVERVIEW_ZOOM = 9;
const catalogPath = path.join(__dirname, '..', 'src', 'features', 'map', 'offline', 'packs.json');
const source = `https://build.protomaps.com/${args.build}.pmtiles`;

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function extract(region, maxZoom, out) {
  if (fs.existsSync(out)) return;
  execFileSync(args.pmtiles, ['extract', source, `${out}.part`, `--region=${region}`, `--maxzoom=${maxZoom}`, '-q'], { stdio: 'inherit' });
  fs.renameSync(`${out}.part`, out);
}

fs.mkdirSync(args.out, { recursive: true });
const old = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const packs = {};
for (const id of Object.keys(old.packs)) {
  packs[id] = {};
  for (const [level, zoom] of Object.entries(LEVELS)) {
    const file = path.join(args.out, `${args.build}-${id}-${level}.pmtiles`);
    extract(path.join(args.regions, `${id}.geojson`), zoom, file);
    packs[id][level] = { bytes: fs.statSync(file).size, sha256: sha256(file) };
    console.log(id, level, packs[id][level].bytes);
  }
}
const overview = path.join(args.out, `${args.build}-overview-z${OVERVIEW_ZOOM}.pmtiles`);
extract(path.join(args.regions, 'poland.geojson'), OVERVIEW_ZOOM, overview);

const catalog = {
  build: args.build,
  source: 'Protomaps basemap (OpenStreetMap, ODbL)',
  baseUrl: args['base-url'] ?? null,
  sizesExact: true,
  overview: { maxZoom: OVERVIEW_ZOOM, bytes: fs.statSync(overview).size },
  packs,
};
fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log('wrote', catalogPath);
