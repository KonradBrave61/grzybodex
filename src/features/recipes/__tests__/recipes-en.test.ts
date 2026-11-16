// code-guard: intentional-duplicate - local fixture names in tests fuzzy-match production identifiers; no logic is duplicated.
import { recipeStrings } from '@/i18n/recipes';

import { RECIPES, RECIPES_EN, recipeText, SHELF, SHELF_EN, shelfText } from '../data';
import { seasonMonths, withoutNote } from '../logic';
import { FORBIDDEN_WORDS_EN } from '../texts';

const { pl, en } = recipeStrings;
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const nonEmpty = (t: string | undefined) => typeof t === 'string' && t.trim().length > 0;
const allStrings = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(allStrings) : [];

describe('English recipe content (data/przepisy.en.json)', () => {
  it('has exactly one translation per recipe', () => {
    expect(Object.keys(RECIPES_EN).sort()).toEqual(RECIPES.map((r) => r.id).sort());
  });

  it.each(RECIPES.map((r) => [r.id, r] as const))('%s: non-empty title, original, ingredients, steps; same counts as Polish', (id, r) => {
    const t = RECIPES_EN[id];
    expect(nonEmpty(t.tytul)).toBe(true);
    expect(t.tytul).not.toBe(r.tytul);
    expect(nonEmpty(t.oryginal)).toBe(true);
    expect(t.na_dzis.skladniki).toHaveLength(r.na_dzis.skladniki.length);
    expect(t.na_dzis.kroki).toHaveLength(r.na_dzis.kroki.length);
    [...t.na_dzis.skladniki, ...t.na_dzis.kroki].forEach((x) => expect(nonEmpty(x)).toBe(true));
    // Paragraph structure of the original is kept.
    expect(t.oryginal.split('\n')).toHaveLength(r.oryginal.split('\n').length);
  });

  it.each(RECIPES.map((r) => [r.id, r] as const))('%s: same page, same season months, every species (by Latin name) named', (id, r) => {
    const t = RECIPES_EN[id];
    expect(withoutNote(t.strona)).toBe(withoutNote(r.ksiazka.strona));
    const [from, to] = seasonMonths(r.sezon) ?? [0, 0];
    expect(withoutNote(t.sezon)).toBe(`${EN_MONTHS[from - 1]}–${EN_MONTHS[to - 1]}`);
    expect(Object.keys(t.gatunki).sort()).toEqual(r.gatunki.map((g) => g.scientificName).sort());
    Object.values(t.gatunki).forEach((g) => {
      expect(nonEmpty(g.nazwa)).toBe(true);
      expect(nonEmpty(g.nazwa_w_przepisie)).toBe(true);
    });
  });

  it('uses one English name per Latin name across all recipes', () => {
    const names = new Map<string, Set<string>>();
    Object.values(RECIPES_EN).forEach((t) =>
      Object.entries(t.gatunki).forEach(([latin, g]) => names.set(latin, (names.get(latin) ?? new Set()).add(g.nazwa))),
    );
    names.forEach((set) => expect(set.size).toBe(1));
  });

  it('recipeText: Polish = source data unchanged; English = translation + Polish original kept', () => {
    const r = RECIPES[0];
    const p = recipeText(r, 'pl');
    expect(p).toMatchObject({ tytul: r.tytul, oryginal: r.oryginal, polishOriginal: null, sezon: r.sezon, kroki: r.na_dzis.kroki });
    expect(p.species(r.gatunki[0])).toEqual({ inRecipe: r.gatunki[0].nazwa_w_przepisie, name: r.gatunki[0].nazwa_pl });
    const e = recipeText(r, 'en');
    expect(e.tytul).toBe('Saffron milk caps in butter');
    expect(e.polishOriginal).toBe(r.oryginal);
    expect(e.species(r.gatunki[0]).name).toBe('saffron milk cap');
  });

  it('every shelf item has an English description; titles stay original', () => {
    SHELF.forEach((item) => {
      expect(SHELF_EN[item.isbn ?? item.url ?? '']).toBeDefined();
      const local = shelfText(item, 'en');
      [local.typ, local.rok, local.gloss].forEach((x) => expect(nonEmpty(x)).toBe(true));
      expect(shelfText(item, 'pl')).toEqual({ typ: item.typ, rok: item.rok, wydawca: item.wydawca, gloss: '' });
    });
  });
});

describe('English safety texts', () => {
  it('the warning shown with every recipe exists in English, item for item', () => {
    expect(en.warning.title).toBe('Before you cook');
    expect(en.warning.items).toHaveLength(pl.warning.items.length);
    en.warning.items.forEach((item, i) => {
      const text = item.map((s) => s.text).join('');
      expect(nonEmpty(text)).toBe(true);
      expect(text).not.toBe(pl.warning.items[i].map((s) => s.text).join(''));
      // Emphasis (bold) is kept on the same items.
      expect(item.some((s) => s.bold)).toBe(pl.warning.items[i].some((s) => s.bold));
    });
    const all = en.warning.items.flat().map((s) => s.text).join(' ');
    ['certain', 'certificate', 'mushroom expert', 'raw', 'children', 'pregnant', 'breastfeeding', 'older people', 'digestive', '112'].forEach((w) =>
      expect(all).toContain(w),
    );
  });
  it('banner, MZ-list species note and Sanepid advice keep their meaning', () => {
    expect(en.speciesNote).toContain('approved for sale');
    expect(en.speciesNote).toContain('Minister of Health');
    expect(en.speciesNote).toContain('does not mean that your specimen is fit to eat');
    expect(en.banner.history).toContain('not advice');
    expect(en.banner.onlySureRest).toContain('certificate');
    expect(en.banner.skipped).toContain('dangerous');
    expect(en.ui.translated).toBe('Translated from the Polish original');
    expect(pl.ui.translated).toBe('');
  });
  it('English texts contain none of the forbidden words', () => {
    const officialTitles = new Set<string>(en.warningSources.map((w) => w.title));
    const ui = allStrings({ ...en, warningSources: en.warningSources.map((w) => w.who) });
    const data = Object.values(RECIPES_EN).flatMap((t) => [
      t.tytul,
      t.strona,
      t.sezon,
      ...t.na_dzis.skladniki,
      ...t.na_dzis.kroki,
      ...Object.values(t.gatunki).flatMap((g) => [g.nazwa, g.nazwa_w_przepisie]),
    ]);
    // Glosses of official page titles („Bezpieczne grzybobranie” = Safe mushroom picking) are quoted titles, like officialTitles.
    const shelf = SHELF.flatMap((s) => {
      const l = shelfText(s, 'en');
      return [l.typ, l.rok, l.wydawca, ...(s.isbn ? [l.gloss] : [])];
    });
    const texts = [...ui, ...data, ...shelf].filter((t) => !officialTitles.has(t));
    const hits = texts.flatMap((t) => FORBIDDEN_WORDS_EN.filter((w) => t.toLowerCase().includes(w)).map((w) => `${w} ← ${t}`));
    expect(hits).toEqual([]);
    expect(FORBIDDEN_WORDS_EN.filter((w) => 'This mushroom is safe and edible.'.toLowerCase().includes(w))).toEqual(['safe', 'edible']);
  });
});
