// code-guard: intentional-duplicate - small data-access names (photo, description) fuzzy-match other modules; no logic is duplicated.
/**
 * Reference material of the atlas, built by content/atlas/opisy_zdjecia.py:
 *  - one reference photo per species from Wikimedia Commons — accepted only when the file sits in the Commons category
 *    of exactly that species; free licences only (CC0 / public domain / CC BY / CC BY-SA), author kept for the credit;
 *  - descriptions from Polish Wikipedia (CC BY-SA 4.0, fixed revision); sentences about edibility are removed,
 *    because the category shown in the app comes only from the official list and the sources on the species card;
 *  - English descriptions translated from those Polish texts: descriptions.en.json (merged from descriptions.en.part*.json).
 */
import photoMeta from './atlas-photos.json';
import { ATLAS_PHOTO_FILES } from './atlas-photo-files';
import descriptionsEnJson from './descriptions.en.json';
import descriptionsJson from './descriptions.json';

import { atlasStrings } from '@/i18n/atlas';
import type { Lang } from '@/i18n/i18n';

export type ReferencePhoto = { source: number; author: string; license: string; licenseUrl: string; page: string };
export type Description = {
  title: string;
  url: string;
  license: string;
  edibilityRemoved: boolean;
  sections: { head: string; text: string }[];
  /** Language of `sections`; 'pl' when English was asked for but no translation exists yet. */
  lang: Lang;
  /** English text translated from the Polish Wikipedia article. */
  translated: boolean;
};

type PhotoRow = { file: string; how: string; license: string; license_url: string; author: string; page: string };
type DescriptionRow = { title: string; revid: number; url: string; license: string; edibility_removed: boolean; sections: { head: string; text: string }[] };
const PHOTOS = photoMeta as Record<string, PhotoRow>;
const DESCRIPTIONS = descriptionsJson as Record<string, DescriptionRow>;
const DESCRIPTIONS_EN = descriptionsEnJson as Record<string, { sections?: { head: string; text: string }[] }>;

/**
 * RESPONSIBILITY: Zdjęcie wzorcowe gatunku (dokładnie ten gatunek, wolna licencja) z autorem do podpisu
 * INPUTS:         id: identyfikator gatunku z atlasu; lang: język zastępczego podpisu autora (domyślnie 'pl')
 * OUTPUTS:        ReferencePhoto albo null (gatunek bez zdjęcia spełniającego warunki)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none (dane wbudowane w aplikację)
 * ERRORS:         none
 */
export function referencePhoto(id: string, lang: Lang = 'pl'): ReferencePhoto | null {
  const meta = PHOTOS[id];
  const source = ATLAS_PHOTO_FILES[id];
  if (!meta || source === undefined) return null;
  return { source, author: meta.author || atlasStrings[lang].unknownAuthor, license: meta.license, licenseUrl: meta.license_url, page: meta.page };
}

/**
 * RESPONSIBILITY: Opis gatunku z polskiej Wikipedii (wstęp, wygląd, siedlisko, gatunki podobne) z danymi do podpisu licencji
 * INPUTS:         id: identyfikator gatunku z atlasu; lang: 'pl' | 'en' (domyślnie 'pl')
 * OUTPUTS:        Description albo null (brak artykułu); en bez tłumaczenia → tekst polski z lang = 'pl'
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none (dane wbudowane w aplikację)
 * ERRORS:         none
 */
export function description(id: string, lang: Lang = 'pl'): Description | null {
  const d = DESCRIPTIONS[id];
  if (!d) return null;
  const en = lang === 'en' ? DESCRIPTIONS_EN[id]?.sections : undefined;
  const translated = !!en && en.length > 0;
  return { title: d.title, url: d.url, license: d.license, edibilityRemoved: d.edibility_removed, sections: translated ? en : d.sections, lang: translated ? 'en' : 'pl', translated };
}

/**
 * RESPONSIBILITY: Lista podpisów wszystkich zdjęć wzorcowych (ekran „Licencje i źródła”)
 * INPUTS:         lang: język zastępczego podpisu autora (domyślnie 'pl')
 * OUTPUTS:        [{ id, author, license, licenseUrl, page }]
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function referencePhotoCredits(lang: Lang = 'pl'): { id: string; author: string; license: string; licenseUrl: string; page: string }[] {
  return Object.entries(PHOTOS).map(([id, p]) => ({ id, author: p.author || atlasStrings[lang].unknownAuthor, license: p.license, licenseUrl: p.license_url, page: p.page }));
}
