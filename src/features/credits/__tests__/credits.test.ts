// code-guard: intentional-duplicate - local fixture names in tests fuzzy-match production identifiers; no logic is duplicated.
import { BUNDLED_PHOTOS } from '@/data/bundled-photos';
import lookalikes from '@/data/lookalikes.json';
import recipes from '@/data/przepisy.json';
import samples from '@/data/samples.json';

import { ccLicense, creditSections, lookalikeSources, sampleCredits } from '../credits';

describe('licences and attributions screen data', () => {
  it('maps Creative Commons ids to label and deed URL', () => {
    expect(ccLicense('cc-by-sa-2.0')).toEqual({ label: 'CC BY-SA 2.0', url: 'https://creativecommons.org/licenses/by-sa/2.0/' });
    expect(() => ccLicense('all-rights-reserved')).toThrow();
  });

  it('every photo bundled in the app has author, licence link and source (CC BY-SA attribution)', () => {
    const byId = new Map(samples.map((s) => [s.id, s]));
    expect(Object.keys(BUNDLED_PHOTOS).filter((id) => !byId.get(id)?.author)).toEqual([]);
    for (const item of sampleCredits('pl')) {
      expect(item.detail).toMatch(/Autor: .+ · CC BY-SA \d\.\d/);
      expect(item.links.map((l) => l.url)).toEqual([expect.stringContaining('commons.wikimedia.org'), expect.stringContaining('creativecommons.org')]);
    }
  });

  it('every recipe author died in 1955 or earlier (public domain in Poland in 2026: 70 years p.m.a.)', () => {
    expect(recipes.przepisy.filter((r) => !(r.ksiazka.autor_zm <= 1955)).map((r) => r.id)).toEqual([]);
  });

  it('lookalike sources account for every pair exactly once', () => {
    const { official, wikipediaPairs } = lookalikeSources('pl');
    const counted = official.reduce((n, item) => n + Number(/par: (\d+)/.exec(item.detail)![1]), 0);
    expect(counted + wikipediaPairs).toBe(lookalikes.length);
  });

  it('all links are https and every section has content', () => {
    for (const section of creditSections('pl')) {
      expect(section.items.length).toBeGreaterThan(0);
      for (const item of section.items) for (const link of item.links) expect(link.url).toMatch(/^https:\/\//);
    }
  });

  it('English version has the same sections, items and links as the Polish one; only texts differ', () => {
    const pl = creditSections('pl');
    const en = creditSections('en');
    const shape = (sections: typeof pl) => sections.map((s) => [s.id, s.items.length, !!s.intro, s.items.flatMap((i) => i.links.map((l) => l.url))]);
    expect(shape(en)).toEqual(shape(pl));
    const titles = (sections: typeof pl) => sections.map((s) => s.title);
    expect(titles(en).filter((t, i) => t === titles(pl)[i])).toEqual([]);
  });

  it('English texts have no Polish letters except in names, titles and acts kept as they are', () => {
    const en = creditSections('en');
    expect(en.map((s) => `${s.title} ${s.intro ?? ''}`).filter((t) => /[ąćęłńóśźż]/i.test(t))).toEqual([]);
    for (const item of sampleCredits('en')) expect(item.detail).toMatch(/^Author: .+ · CC BY-SA \d\.\d · Wikimedia Commons\. Changes: /);
    const { official } = lookalikeSources('en');
    expect(official.every((i) => /pairs: \d+$/.test(i.detail))).toBe(true);
  });
});
