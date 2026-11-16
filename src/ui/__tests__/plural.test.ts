// code-guard: intentional-duplicate - local fixture names in tests fuzzy-match production identifiers; no logic is duplicated.
import { pluralPl, pluralWord } from '../plural';

const WORDS = ['skan', 'skany', 'skanów'] as const;

describe('pluralPl', () => {
  it.each([
    [0, '0 skanów'],
    [1, '1 skan'],
    [2, '2 skany'],
    [4, '4 skany'],
    [5, '5 skanów'],
    [12, '12 skanów'],
    [14, '14 skanów'],
    [22, '22 skany'],
    [25, '25 skanów'],
    [112, '112 skanów'],
    [122, '122 skany'],
  ])('%i → %s', (n, expected) => {
    expect(pluralPl(n, WORDS)).toBe(expected);
  });
});

describe('pluralWord', () => {
  it('returns only the word (map screen: "3 zapisane")', () => {
    const forms = ['zapisana', 'zapisane', 'zapisanych'] as const;
    expect([0, 1, 2, 4, 5, 12, 22, 25].map((n) => pluralWord(n, forms))).toEqual([
      'zapisanych',
      'zapisana',
      'zapisane',
      'zapisane',
      'zapisanych',
      'zapisanych',
      'zapisane',
      'zapisanych',
    ]);
  });
});
