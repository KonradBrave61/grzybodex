// code-guard: intentional-duplicate - local fixture names in tests fuzzy-match production identifiers; no logic is duplicated.
import { candidateFor, lookalikePairs, SPECIES } from '@/data/atlas';
import classmap from '@/data/classmap.json';
import { collectionStrings } from '@/i18n/collection';
import { scanStrings } from '@/i18n/scan';

import { evaluateSafety, type Warning } from '../safety';
import { warningText } from '../warning-text';

const en = scanStrings.en;
const pl = scanStrings.pl;

/** Every warning the safety net can produce on the bundled data (each class predicted alone). */
const allWarnings = (): Warning[] => {
  const pairs = lookalikePairs();
  const seen = new Map<string, Warning>();
  for (const c of classmap as { class_id: number }[]) {
    for (const w of evaluateSafety([candidateFor(c.class_id)], pairs)) seen.set(JSON.stringify(w), w);
  }
  return [...seen.values()];
};

describe('safety warnings in English', () => {
  const warnings = allWarnings();

  it('the bundled data produces every warning kind', () => {
    expect(SPECIES.length).toBeGreaterThan(0);
    for (const kind of ['in_top', 'genus', 'lookalike'] as const) expect(warnings.some((w) => w.kind === kind)).toBe(true);
  });

  it('every safety warning has a non-empty English title and body with the same severity as Polish', () => {
    for (const w of warnings) {
      const e = warningText('en', w);
      const p = warningText('pl', w);
      expect(e.title.trim()).not.toBe('');
      expect(e.body.trim()).not.toBe('');
      expect(e.deadly).toBe(p.deadly);
      expect(e.body).toContain('Do not eat this mushroom.');
      if (e.deadly) expect(e.body).toContain('A mistake can cost a life.');
      if (w.kind !== 'genus') expect(e.title).toContain(w.danger === 'deadly' ? 'DEADLY POISONOUS' : 'POISONOUS');
      expect(e.body).not.toMatch(/[ąćęłńóśźż]/i.source.length ? /\b(Nie|grzyb|Pomyłka)\b/ : /$^/);
    }
  });

  it('keeps the Polish warning text unchanged', () => {
    expect(warningText('pl', { kind: 'genus', genus: 'Amanita', via: 'Amanita citrina' }).body).toBe(
      'Rodzaj Amanita. Pomyłka może kosztować życie. Nie jedz tego grzyba. Pokaż go grzyboznawcy.',
    );
    expect(pl.similarBody('Hełmówka jadowita', 'Galerina marginata', 'Płomiennica zimowa', true)).toBe(
      'To może być: Hełmówka jadowita (Galerina marginata). Bywa mylony z: Płomiennica zimowa. Pomyłka może kosztować życie. Nie jedz tego grzyba. Pokaż go grzyboznawcy.',
    );
  });
});

/** Text values; functions are called with all arguments 2 (truthy) and all 0 (falsy) to cover both branches. */
const render = (v: unknown): string[] => {
  if (typeof v === 'string') return [v];
  if (typeof v === 'function') return [2, 0].map((a) => String((v as (...x: unknown[]) => unknown)(...Array<unknown>(v.length).fill(a))));
  return Object.values(v as Record<string, unknown>).flatMap(render);
};

describe('scan and collection namespaces', () => {
  it.each([
    ['scan', scanStrings],
    ['collection', collectionStrings],
  ] as const)('%s: every English text is non-empty and has no Polish letters', (_, ns) => {
    for (const [key, value] of Object.entries(ns.en)) {
      for (const text of render(value)) {
        expect([key, text.trim().length > 0]).toEqual([key, true]);
        expect([key, /[ąćęłńóśźż]/i.test(text)]).toEqual([key, false]);
      }
    }
  });
  it('safety-critical keys keep "do not eat" in English', () => {
    for (const k of ['srcOutsideDanger', 'srcOutsideNoData', 'srcNoData'] as const) expect(en[k]).toContain('Do not eat');
    expect(en.hintBody).toContain('Do not eat a mushroom based on this app');
    expect(en.unknownBody).toContain('does not mean the mushroom is fit to eat');
  });
});
