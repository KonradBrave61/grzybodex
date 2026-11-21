// code-guard: intentional-duplicate - local fixture names in tests fuzzy-match production identifiers; no logic is duplicated.
import { SPECIES, speciesById } from '@/data/atlas';

import { compareGuess, dailySecret, localDayNumber, msUntilNextDay, parseDailyGame, peakMonth, quizCategory, secretPool } from '../quiz';

const byLatin = (latin: string) => SPECIES.find((s) => s.latin === latin)!;

describe('quiz logic on the real atlas data', () => {
  it('the secret pool is large and every secret has the data the columns need', () => {
    const pool = secretPool(SPECIES);
    expect(pool.length).toBeGreaterThan(80);
    for (const s of pool) {
      expect(peakMonth(s.id)).not.toBeNull();
      expect(quizCategory(s)).not.toBe('unknown');
      expect(s.features?.filtr_spod_kapelusza?.length).toBeGreaterThan(0);
    }
  });

  it('guessing the secret itself is a hit in every column that has data', () => {
    const s = secretPool(SPECIES)[0];
    const row = compareGuess(s, s);
    expect([row.category, row.genus, row.underside, row.season, row.protectedCell].map((c) => c.verdict)).toEqual(['hit', 'hit', 'hit', 'hit', 'hit']);
    expect(row.stem.verdict).toBe(s.features?.filtr_trzon?.length ? 'hit' : 'nodata');
  });

  it('same genus is a hit, a different genus a miss', () => {
    expect(compareGuess(byLatin('Amanita muscaria'), byLatin('Amanita phalloides')).genus.verdict).toBe('hit');
    expect(compareGuess(byLatin('Boletus edulis'), byLatin('Amanita phalloides')).genus.verdict).toBe('miss');
  });

  it('SAFETY: poisonous vs deadly is "near", edible vs deadly is a miss', () => {
    const deadly = SPECIES.find((s) => quizCategory(s) === 'deadly')!;
    const poisonous = SPECIES.find((s) => quizCategory(s) === 'poisonous')!;
    const edible = SPECIES.find((s) => quizCategory(s) === 'edible')!;
    expect(compareGuess(poisonous, deadly).category.verdict).toBe('near');
    expect(compareGuess(edible, deadly).category.verdict).toBe('miss');
  });

  it('missing data is "nodata", never a silent miss', () => {
    const noStem = SPECIES.find((s) => !s.features?.filtr_trzon?.length)!;
    const withStem = SPECIES.find((s) => s.features?.filtr_trzon?.length)!;
    expect(compareGuess(noStem, withStem).stem.verdict).toBe('nodata');
    expect(compareGuess(withStem, noStem).stem.verdict).toBe('nodata');
    const noSeason = SPECIES.find((s) => peakMonth(s.id) === null)!;
    expect(compareGuess(noSeason, secretPool(SPECIES)[0]).season.verdict).toBe('nodata');
  });

  it('season compares months cyclically with a direction hint', () => {
    const at = (month: number) => SPECIES.find((s) => peakMonth(s.id) === month)!;
    const [dec, jan, jun] = [at(11), at(0), at(5)];
    expect(compareGuess(dec, jan).season).toMatchObject({ verdict: 'near', hint: 'later' });
    expect(compareGuess(jan, dec).season).toMatchObject({ verdict: 'near', hint: 'earlier' });
    expect(compareGuess(jan, jun).season.verdict).toBe('miss');
    expect(compareGuess(jun, jun).season.hint).toBeUndefined();
  });

});

describe('mushroom of the day', () => {
  const pool = secretPool(SPECIES);

  it('the day changes at local midnight, not at UTC midnight', () => {
    const late = new Date(2026, 10, 20, 23, 59, 59);
    const midnight = new Date(2026, 10, 21, 0, 0, 0);
    expect(localDayNumber(midnight) - localDayNumber(late)).toBe(1);
    expect(localDayNumber(new Date(2026, 10, 21, 0, 0, 1))).toBe(localDayNumber(new Date(2026, 10, 21, 23, 59)));
    expect(msUntilNextDay(late)).toBe(1000);
    expect(msUntilNextDay(midnight)).toBe(24 * 3600 * 1000);
  });

  it('is the same all day, changes the next day and repeats only after the whole pool', () => {
    const day = localDayNumber(new Date(2026, 10, 20, 8));
    expect(dailySecret(pool, day)).toBe(dailySecret(pool, localDayNumber(new Date(2026, 10, 20, 23, 30))));
    const cycle = Array.from({ length: pool.length }, (_, i) => dailySecret(pool, day + i).id);
    expect(new Set(cycle).size).toBe(pool.length);
    expect(dailySecret(pool, day + pool.length)).toBe(dailySecret(pool, day));
    expect(speciesById(dailySecret(pool, -3).id)).toBeDefined();
  });

  it('restores only today’s saved tries and survives broken storage', () => {
    const known = new Set(pool.map((p) => p.id));
    const [a, b] = pool;
    const saved = JSON.stringify({ day: 100, guesses: [a.id, 'nope', b.id, a.id], gaveUp: true });
    expect(parseDailyGame(saved, 100, known)).toEqual({ day: 100, guesses: [a.id, b.id], gaveUp: true });
    expect(parseDailyGame(saved, 101, known)).toEqual({ day: 101, guesses: [], gaveUp: false });
    expect(parseDailyGame('{broken', 100, known).guesses).toEqual([]);
    expect(parseDailyGame(null, 100, known).guesses).toEqual([]);
    expect(parseDailyGame('[1,2]', 100, known).guesses).toEqual([]);
  });
});
