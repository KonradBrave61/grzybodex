// code-guard: intentional-duplicate - names (hasTraits, traitSources) fuzzy-match the Traits component of the species card (Wikidata chips); this module is the Wikipedia comparison data, no logic is shared.
/**
 * Features for telling look-alikes apart, built by content/cechy/cechy.py from Polish Wikipedia (CC BY-SA 4.0, fixed revision).
 * Every text is a verbatim sentence of the article's "Morfologia" section — nothing is paraphrased. Exception: 3 species without a Polish
 * article use another Wikipedia (cs/ca/fi); their text is a Polish translation, marked by TraitSource.translatedFrom.
 * "podobne" sentences name other species by wiki link or full Latin name (`mentions`); a sentence without a name inherits
 * the names of the previous one in the same paragraph, e.g. "Its pores are pink." after "Confused with X.".
 * traits.json also keeps audit fields for content/ (identity, original, inherited, edibility) that the app does not read.
 */
import officialEnJson from './official.en.json';
import officialJson from './official.json';
import traitsEnJson from './traits.en.json';
import traitsJson from './traits.json';

import { dangerOfLatin } from '@/data/atlas';
import type { Lang } from '@/i18n/i18n';

/** Order on the comparison screen: underside, stem and flesh first — look-alikes usually differ there, not on the cap seen from above. */
export const TRAIT_FIELDS = ['spod', 'trzon', 'miazsz', 'mleczko', 'wysyp', 'kapelusz', 'owocnik', 'inne'] as const;
export type TraitField = (typeof TRAIT_FIELDS)[number];
type Sentence = { text: string; mentions?: string[] };
/** lang/translated: article from another Wikipedia (no Polish article); `text` is then a Polish translation (content/cechy/obce.json). */
type TraitRow = { title: string; url: string; license: string; lang?: string; translated?: boolean; fields: Partial<Record<TraitField | 'podobne', Sentence[]>> };
export type TraitSource = { latin: string; title: string; url: string; license: string; translatedFrom: string | null };
/** Official text (Sanepid / State Forests) shown above Wikipedia: a "X vs Y" paragraph or the species entry of a brochure. */
export type OfficialText = { title: string; url: string; heading: string | null; about: string | null; text: string; translated: boolean };
export type Comparison = {
  /** content/cechy/urzedowe.py: PSSE paragraphs naming both species (or their genus) + brochure entries of each species. */
  official: OfficialText[];
  /** Sentences of either article that speak about the other species (verbatim), with the article they come from. */
  sentences: { from: string; text: string }[];
  /** Field by field, both species; null = the article has no such field. Only fields present in at least one article. */
  fields: { key: TraitField; a: string[] | null; b: string[] | null }[];
  sources: TraitSource[];
};

const TRAITS = traitsJson as unknown as Record<string, TraitRow>;
type OfficialData = {
  sources: Record<string, { title: string; url: string }>;
  species: Record<string, { source: string; text: string }>;
  pairs: { source: string; heading: string; text: string; species: string[]; genera: string[] }[];
};
const OFFICIAL = officialJson as unknown as OfficialData;
/** English of official texts keyed by the Polish text (content/cechy/sprawdz_en.py). */
const OFFICIAL_EN = officialEnJson as unknown as Record<string, string>;

const covers = (p: OfficialData['pairs'][number], latin: string) => p.species.includes(latin) || p.genera.includes(latin.split(' ')[0]);
const official = (source: string, heading: string | null, about: string | null, text: string, lang: Lang): OfficialText => {
  const en = lang === 'en' ? OFFICIAL_EN[text] : undefined;
  const head = heading && lang === 'en' ? (OFFICIAL_EN[heading] ?? heading) : heading;
  return { ...OFFICIAL.sources[source], heading: head, about, text: en ?? text, translated: !!en };
};

/**
 * RESPONSIBILITY: Urzędowe teksty o parze gatunków: akapity PSSE obejmujące oba gatunki (albo ich rodzaj) i hasła broszury LP/WSSE
 * INPUTS:         a, b: dwumiany (untrusted — z trasy); lang: 'en' → tłumaczenie (official.en.json), brak → polski
 * OUTPUTS:        OfficialText[] — najpierw akapity różnic, potem hasło gatunku a i b; pusta lista, gdy źródła ich nie opisują
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function officialTexts(a: string, b: string, lang: Lang = 'pl'): OfficialText[] {
  const pairs = a === b ? [] : OFFICIAL.pairs.filter((p) => covers(p, a) && covers(p, b));
  const entries = [a, b].filter((l) => Object.prototype.hasOwnProperty.call(OFFICIAL.species, l));
  return [
    ...pairs.map((p) => official(p.source, p.heading, null, p.text, lang)),
    ...entries.map((l) => official(OFFICIAL.species[l].source, null, l, OFFICIAL.species[l].text, lang)),
  ];
}
/** English translations (content/cechy/sprawdz_en.py): same species → field → sentence order as traits.json. */
const TRAITS_EN = traitsEnJson as unknown as Record<string, Partial<Record<TraitField | 'podobne', string[]>>>;

/**
 * RESPONSIBILITY: Czy dla gatunku są cechy z Wikipedii (do porównania)
 * INPUTS:         latin: dwumian (trusted, dane w bundlu)
 * OUTPUTS:        boolean
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export const hasTraits = (latin: string): boolean => Object.prototype.hasOwnProperty.call(TRAITS, latin);

/** Sentence i of a field in the asked language; Polish when no translation exists. */
const textOf = (latin: string, field: TraitField | 'podobne', i: number, lang: Lang): string => {
  const en = lang === 'en' && Object.prototype.hasOwnProperty.call(TRAITS_EN, latin) ? TRAITS_EN[latin][field]?.[i] : undefined;
  return en ?? TRAITS[latin].fields[field]![i].text;
};

/** Reverse index of "podobne" mentions: latin → species whose article names it (one pass at load, not per render). */
const MENTIONED_BY = new Map<string, Set<string>>();
for (const [latin, row] of Object.entries(TRAITS)) {
  for (const s of row.fields.podobne ?? []) {
    for (const m of s.mentions ?? []) {
      if (!MENTIONED_BY.has(m)) MENTIONED_BY.set(m, new Set());
      MENTIONED_BY.get(m)!.add(latin);
    }
  }
}

const about = (from: string, other: string, lang: Lang) =>
  (TRAITS[from]?.fields.podobne ?? []).flatMap((s, i) => (s.mentions?.includes(other) ? [{ from, text: textOf(from, 'podobne', i, lang) }] : []));

const toSource = (latin: string, t: TraitRow): TraitSource => ({
  latin,
  title: t.title,
  url: t.url,
  license: t.license,
  translatedFrom: t.translated ? (t.lang ?? null) : null,
});

/**
 * RESPONSIBILITY: Porównanie dwóch gatunków: zdania „Gatunki podobne” o drugim gatunku + pola budowy obu gatunków obok siebie
 * INPUTS:         a, b: dwumiany (untrusted — z parametrów trasy; nieznane → puste porównanie); lang: 'en' → tłumaczenia (traits.en.json), brak → polski
 * OUTPUTS:        Comparison — dosłowne zdania z Wikipedii, z listą haseł do podpisu licencji; puste listy, gdy brak danych
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none (dane w bundlu)
 * ERRORS:         none
 */
export function compareSpecies(a: string, b: string, lang: Lang = 'pl'): Comparison {
  const texts = (latin: string, key: TraitField) => {
    const list = hasTraits(latin) ? TRAITS[latin].fields[key] : undefined;
    return list?.length ? list.map((_, i) => textOf(latin, key, i, lang)) : null;
  };
  const fields = TRAIT_FIELDS.map((key) => ({ key, a: texts(a, key), b: texts(b, key) })).filter((f) => f.a || f.b);
  return {
    official: officialTexts(a, b, lang),
    sentences: hasTraits(a) && hasTraits(b) ? [...about(a, b, lang), ...about(b, a, lang)] : [],
    fields,
    sources: [a, b].filter(hasTraits).map((l) => toSource(l, TRAITS[l])),
  };
}

/**
 * RESPONSIBILITY: Gatunki podobne do danego według haseł Wikipedii (oba kierunki), z cechami do porównania
 * INPUTS:         latin: dwumian (trusted); exclude: dwumiany już pokazane gdzie indziej (np. ramka sobowtórów)
 * OUTPUTS:        posortowane dwumiany (bez samego gatunku i bez exclude)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function similarSpecies(latin: string, exclude: ReadonlySet<string> = new Set()): string[] {
  const out = new Set<string>();
  for (const s of hasTraits(latin) ? (TRAITS[latin].fields.podobne ?? []) : []) for (const m of s.mentions ?? []) out.add(m);
  for (const other of MENTIONED_BY.get(latin) ?? []) out.add(other);
  out.delete(latin);
  return [...out].filter((l) => !exclude.has(l)).sort();
}

/**
 * RESPONSIBILITY: Lista podpisów haseł Wikipedii użytych w cechach (ekran „Licencje i źródła”)
 * INPUTS:         none
 * OUTPUTS:        [{ latin, title, url, license }] posortowane po tytule
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function traitSources(): TraitSource[] {
  return Object.entries(TRAITS)
    .map(([l, t]) => toSource(l, t))
    .sort((x, y) => x.title.localeCompare(y.title, 'pl'));
}

/** Number of Wikipedia articles used for features (credits screen) — without building and sorting the list. */
export const traitCount = (): number => Object.keys(TRAITS).length;

const BY_GENUS = new Map<string, string[]>();

/**
 * RESPONSIBILITY: Groźne gatunki danego rodzaju, które mają cechy — do porównań, gdy źródło sobowtóra nazywa cały rodzaj (np. „Lepiota spp.”)
 * INPUTS:         genus: nazwa rodzaju (trusted, dane w bundlu)
 * OUTPUTS:        posortowane dwumiany z cechami i stopniem zagrożenia (atlas albo tabela sobowtórów)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function dangerousSpeciesOfGenus(genus: string): string[] {
  let out = BY_GENUS.get(genus);
  if (!out) {
    out = Object.keys(TRAITS)
      .filter((l) => l.startsWith(`${genus} `) && dangerOfLatin(l) !== null)
      .sort();
    BY_GENUS.set(genus, out);
  }
  return out;
}
