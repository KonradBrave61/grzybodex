// code-guard: intentional-duplicate - text constant names fuzzy-match other files; no logic is duplicated.
/**
 * Language-independent constants of the "Przepisy" tab. All user-visible texts (both languages) are in src/i18n/recipes.ts.
 */

/** „Jak znaleźć Sanepid” — GIS page on free assessment at the nearest station (§8 header, PRZEGLAD-PRAWNY pkt 8). */
export const SANEPID_URL = 'https://www.gov.pl/web/gis/dla-milosnikow-zbierania-grzybow2';

/** Scan origin (library names) per recipe — content/przepisy/ZRODLA.md §2 „Pochodzenie skanów” (recipes 4–6: no details on Commons). */
export const SCAN_LIBRARY: Readonly<Record<string, readonly string[]>> = {
  'rydze-w-masle-cwierczakiewiczowa-1871': ['e-BUW/FBC'],
  'rydze-smazone-zawadzka-1913': ['Polona'],
  'borowiki-tuszone-zawadzka-1913': ['Polona'],
  'rydze-z-ryzem-kiewnarska-1927': ['Polona'],
  'omlet-z-grzybami-kiewnarska-1928': ['Polona'],
  'rydze-duszone-norkowska-1903': ['KPBC', 'Polona'],
};

/** §1.8 + §8.7 — words that must not appear in app texts (checked by unit tests). */
export const FORBIDDEN_WORDS = [
  'możesz zjeść',
  'bezpieczn',
  'jadalny na',
  'smacznego',
  'zbierz',
  'do koszyka',
  'sprawdzon',
  'zatwierdzony przez sanepid',
  'gwarantujemy',
  'jadaln',
  'prosto z lasu',
  'sam nazbieraj',
  'zdrowy przepis',
  'bezpieczny przepis',
] as const;

/** English counterparts of FORBIDDEN_WORDS (same intent: no promise of safety/edibility, no call to pick, no endorsement). */
export const FORBIDDEN_WORDS_EN = [
  'you can eat',
  'safe',
  'edible',
  'bon app',
  'enjoy your meal',
  'pick ',
  'forage',
  'to the basket',
  'to your basket',
  'verified',
  'checked',
  'approved by sanepid',
  'guarantee',
  'straight from the forest',
  'healthy recipe',
] as const;
