// code-guard: intentional-duplicate - skrypt Node; nazwa `main` i krótkie lokalne nazwy zbiegają się z identyfikatorami UI, brak wspólnej logiki.
// Pobiera wagę ViT (int8, 89 MB) z GitHub Release do assets/model/ i sprawdza SHA-256.
// Wagi pochodzą z DF20 (licencja CC BY-NC 4.0 - tylko użytek niekomercyjny), dlatego nie leżą w repo.
// Użycie:  node scripts/fetch-model.js            (URL z MODEL_URL poniżej lub env GRZYBODEX_MODEL_URL)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Uzupełnij po utworzeniu Release (np. https://github.com/<user>/<repo>/releases/download/model-v1/vit_384_int8.onnx).
const MODEL_URL = process.env.GRZYBODEX_MODEL_URL || 'TODO-RELEASE-URL';
const SHA256 = '2738176a8453975006b480ea91210ca858ee9b84412ff98a581eb4a0438da931';
const SIZE = 89225488;
const target = path.join(__dirname, '..', 'assets', 'model', 'vit_384_int8.onnx');

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

async function fetchModel() {
  if (fs.existsSync(target) && sha(fs.readFileSync(target)) === SHA256) {
    console.log('Model już jest i suma się zgadza:', target);
    return;
  }
  if (!/^https:\/\//.test(MODEL_URL)) {
    throw new Error('Ustaw GRZYBODEX_MODEL_URL (link do pliku w GitHub Release) albo uzupełnij MODEL_URL w scripts/fetch-model.js');
  }
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`Pobieranie nie powiodło się: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length !== SIZE || sha(buf) !== SHA256) {
    throw new Error(`Zła suma kontrolna lub rozmiar (${buf.length} B, sha ${sha(buf)}) - plik nie został zapisany`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, buf);
  console.log('Zapisano', target);
}

fetchModel().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
