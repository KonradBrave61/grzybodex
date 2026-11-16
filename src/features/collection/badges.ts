// code-guard: intentional-duplicate - badge field names fuzzy-match other modules; no logic is duplicated.
/**
 * Badges are earned for PHOTOS only (no rankings, nothing rewards picking mushrooms — see docs/legal, protected species).
 * Pure functions: the collection screen passes rows from SQLite.
 */
import { collectionStrings } from '@/i18n/collection';
import type { Lang } from '@/i18n/i18n';

export type BadgeInput = { latin: string; createdAt: Date; shots: number; dangerous: boolean };
export type BadgeState = { id: string; title: string; done: boolean; progress: string; earnedAt: Date | null; tone: 'bolete' | 'gold' | 'blue' | 'moss' | 'plum' };

type Texts = (typeof collectionStrings)['pl'];
type BadgeId = keyof Texts['badge'];
type Rule = { id: BadgeId; tone: BadgeState['tone']; need: number; count: (s: BadgeInput[]) => BadgeInput[]; unit: (t: Texts, n: number, need: number) => string };

const distinct = (s: BadgeInput[]) => {
  const seen = new Set<string>();
  return s.filter((x) => (seen.has(x.latin) ? false : (seen.add(x.latin), true)));
};
const month = (x: BadgeInput) => x.createdAt.getMonth() + 1;
const ofSpecies = (latin: string) => (s: BadgeInput[]) => s.filter((x) => x.latin === latin);
const plain = (t: Texts, n: number, need: number) => t.ofTotal(Math.min(n, need), need);

const RULES: Rule[] = [
  { id: 'first', tone: 'moss', need: 1, count: (s) => s, unit: (t) => t.unitFirst },
  { id: 'bolete', tone: 'bolete', need: 1, count: ofSpecies('Boletus edulis'), unit: (t) => t.unitBolete },
  { id: 'chanterelle', tone: 'gold', need: 1, count: ofSpecies('Cantharellus cibarius'), unit: (t) => t.unitChanterelle },
  { id: 'careful', tone: 'blue', need: 3, count: (s) => s.filter((x) => x.dangerous), unit: (t, n, need) => t.unitDangerous(plain(t, n, need)) },
  { id: 'three', tone: 'moss', need: 1, count: (s) => s.filter((x) => x.shots >= 3), unit: (t) => t.unitThree },
  { id: 'autumn10', tone: 'plum', need: 10, count: (s) => distinct(s.filter((x) => month(x) >= 9 && month(x) <= 11)), unit: plain },
  { id: 'detective', tone: 'moss', need: 10, count: (s) => s, unit: (t, n, need) => t.unitScans(plain(t, n, need)) },
  { id: 'early', tone: 'gold', need: 1, count: (s) => s.filter((x) => x.createdAt.getHours() < 7), unit: (t) => t.unitEarly },
  { id: 'winter', tone: 'blue', need: 1, count: (s) => s.filter((x) => [12, 1, 2].includes(month(x))), unit: (t) => t.unitWinter },
  { id: 'morel', tone: 'bolete', need: 1, count: (s) => s.filter((x) => x.latin.startsWith('Morchella ')), unit: (t) => t.unitMorel },
  { id: 'twenty', tone: 'plum', need: 20, count: distinct, unit: (t, n, need) => t.unitSpecies(plain(t, n, need)) },
  { id: 'encyclopedist', tone: 'moss', need: 100, count: distinct, unit: (t, n, need) => t.unitSpecies(plain(t, n, need)) },
];

/**
 * RESPONSIBILITY: Wylicza stan wszystkich 12 odznak z listy skanów (tylko zdjęcia, bez rankingów)
 * INPUTS:         scans: BadgeInput[] — trusted (z lokalnej bazy), dowolna kolejność; lang: język tytułów i postępu (domyślnie pl)
 * OUTPUTS:        BadgeState[] w stałej kolejności; earnedAt = data skanu, który dopełnił odznakę (najwcześniejsza kolejność czasowa)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function computeBadges(scans: BadgeInput[], lang: Lang = 'pl'): BadgeState[] {
  const t = collectionStrings[lang];
  const chrono = [...scans].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return RULES.map((r) => {
    const hits = r.count(chrono);
    const done = hits.length >= r.need;
    return { id: r.id, title: t.badge[r.id], tone: r.tone, done, progress: r.unit(t, hits.length, r.need), earnedAt: done ? hits[r.need - 1].createdAt : null };
  });
}
