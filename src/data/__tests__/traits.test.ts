// code-guard: intentional-duplicate - test reads traits.json under the name ROWS like src/data/traits.ts; it checks that module, no logic is duplicated.
import lookalikes from '@/data/lookalikes.json';
import species from '@/data/species.json';
import traitsEnJson from '@/data/traits.en.json';
import traitsJson from '@/data/traits.json';
import officialEnJson from '@/data/official.en.json';
import officialJson from '@/data/official.json';
import { compareSpecies, dangerousSpeciesOfGenus, hasTraits, officialTexts, traitSources } from '@/data/traits';

type Row = { fields: Record<string, { text: string; mentions?: string[] }[]> };
const ROWS = traitsJson as unknown as Record<string, Row>;

describe('cechy do odróżniania (traits.json z content/cechy/cechy.py)', () => {
  it('goryczak ↔ borowik: zdania Wikipedii o różnicach i pola obu gatunków', () => {
    const c = compareSpecies('Boletus edulis', 'Tylopilus felleus');
    expect(c.sources.map((s) => s.title)).toEqual(['Borowik szlachetny', 'Goryczak żółciowy']);
    expect(c.sentences.some((s) => s.from === 'Tylopilus felleus' && s.text.includes('różowawych porach'))).toBe(true);
    expect(c.fields.find((f) => f.key === 'spod')?.b?.join(' ')).toContain('bladoróżowe');
    expect(c.fields.find((f) => f.key === 'miazsz')?.b?.join(' ')).toContain('bardzo gorzki');
  });

  it('goryczak ↔ borowik jest w tabeli sobowtórów (broszura LP/WSSE) i ma porównanie', () => {
    const row = lookalikes.find((l) => l.dangerous_latin === 'Tylopilus felleus' && l.confused_with_latin === 'Boletus edulis');
    expect(row?.source.type).toBe('official');
    expect(row?.source.quote).toContain('Mylony z borowikiem szlachetnym');
    expect(compareSpecies('Boletus edulis', 'Tylopilus felleus').sources).toHaveLength(2);
  });

  it('każda para gatunek–gatunek z tabeli sobowtórów daje porównanie z 2 źródłami i polami', () => {
    const pairs = lookalikes.filter((l) => l.dangerous_rank === 'species' && l.confused_with_rank === 'species');
    const comparable = pairs.filter((l) => hasTraits(l.dangerous_latin) && hasTraits(l.confused_with_latin));
    expect(comparable).toHaveLength(pairs.length); // Morchella pragensis: z czeskiej Wikipedii (tłumaczenie)
    for (const l of comparable) {
      const c = compareSpecies(l.confused_with_latin, l.dangerous_latin);
      expect(c.sources).toHaveLength(2);
      expect(c.fields.length).toBeGreaterThan(0);
    }
  });

  it('pary „cały rodzaj”: każda ma co najmniej jedno porównanie gatunek–gatunek', () => {
    const genusSpecies = (g: string) => species.filter((s) => s.genus === g && hasTraits(s.latin)).map((s) => s.latin);
    for (const l of lookalikes.filter((x) => x.dangerous_rank === 'genus' || x.confused_with_rank === 'genus')) {
      const dangerous = l.dangerous_rank === 'genus' ? dangerousSpeciesOfGenus(l.dangerous_latin) : [l.dangerous_latin].filter(hasTraits);
      const confused = l.confused_with_rank === 'genus' ? genusSpecies(l.confused_with_latin) : [l.confused_with_latin].filter(hasTraits);
      expect([l.dangerous_latin, dangerous.length > 0 && confused.length > 0]).toEqual([l.dangerous_latin, true]);
    }
  });

  it('pokrycie atlasu: 398 z 400 gatunków ma cechy; wszystkie śmiertelne mają', () => {
    expect(species.filter((s) => hasTraits(s.latin))).toHaveLength(398); // brak: Artomyces microsporus, Neolentinus degener — żadna Wikipedia ani GBIF nie ma opisu
    expect(species.filter((s) => s.category === 'deadly').every((s) => hasTraits(s.latin))).toBe(true);
  });

  it('teksty są czyste: bez znaczników wiki, przypisów i znaczników linków', () => {
    const bad = /\[\[|\]\]|\{\{|\}\}|<|>|\||name=|[⁣⁤⟨⟩]/;
    for (const row of Object.values(ROWS)) for (const list of Object.values(row.fields)) for (const s of list) expect(s.text).not.toMatch(bad);
  });

  it('wzmianki wskazują tylko gatunki z cechami (link zawsze prowadzi do porównania)', () => {
    for (const row of Object.values(ROWS)) for (const s of row.fields.podobne ?? []) for (const m of s.mentions ?? []) expect(hasTraits(m)).toBe(true);
  });

  it('nieznane nazwy z parametrów trasy → puste porównanie bez wyjątku', () => {
    expect(compareSpecies('constructor', 'Nie istnieje')).toEqual({ official: [], sentences: [], fields: [], sources: [] });
  });

  it('każde hasło ma link do konkretnej wersji i licencję CC BY-SA 4.0', () => {
    const src = traitSources();
    expect(src).toHaveLength(Object.keys(ROWS).length);
    for (const s of src) {
      expect(s.url).toMatch(/^https:\/\/(pl|cs|ca|fi)\.wikipedia\.org\/w\/index\.php\?title=.+&oldid=\d+$/);
      expect(s.translatedFrom === null).toBe(s.url.startsWith('https://pl.'));
      expect(s.license).toBe('CC BY-SA 4.0');
    }
  });

  it('wersja angielska: każdy gatunek, pole i zdanie ma tłumaczenie (ta sama liczba zdań), bez polskich liter', () => {
    const en = traitsEnJson as unknown as Record<string, Record<string, string[]>>;
    expect(Object.keys(en).sort()).toEqual(Object.keys(ROWS).sort());
    for (const [latin, row] of Object.entries(ROWS)) {
      for (const [field, list] of Object.entries(row.fields)) {
        expect([latin, field, en[latin][field]?.length]).toEqual([latin, field, list.length]);
        for (const t of en[latin][field]) expect(t).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/);
      }
    }
  });

  it('porównanie po angielsku: te same zdania co po polsku, w tłumaczeniu', () => {
    const pl = compareSpecies('Boletus edulis', 'Tylopilus felleus', 'pl');
    const en = compareSpecies('Boletus edulis', 'Tylopilus felleus', 'en');
    expect(en.sentences).toHaveLength(pl.sentences.length);
    expect(en.fields.map((f) => f.key)).toEqual(pl.fields.map((f) => f.key));
    expect(en.sentences.some((s) => /pink/i.test(s.text))).toBe(true);
  });

  it('teksty urzędowe: akapit PSSE o borowiku i goryczaku + hasła broszury LP/WSSE obu gatunków', () => {
    const o = officialTexts('Boletus edulis', 'Tylopilus felleus');
    expect(o.map((x) => x.heading ?? x.about)).toEqual(['Borowik szlachetny, a goryczak żółciowy', 'Boletus edulis', 'Tylopilus felleus']);
    expect(o[0].text).toContain('różowo zabarwioną warstwą rurek');
    expect(o[0].url).toMatch(/^https:\/\/www\.gov\.pl\//);
  });

  it('teksty urzędowe: akapit o pieczarkach obejmuje cały rodzaj Agaricus (np. pieczarka polna ↔ muchomor jadowity)', () => {
    expect(officialTexts('Agaricus campestris', 'Amanita virosa').some((x) => x.heading?.startsWith('Pieczarki jadalne'))).toBe(true);
  });

  it('teksty urzędowe: każdy gatunek przypisany w official.json ma cechy (porównanie się otworzy)', () => {
    const data = officialJson as unknown as { species: Record<string, unknown>; pairs: { species: string[] }[] };
    for (const l of [...Object.keys(data.species), ...data.pairs.flatMap((p) => p.species)]) expect([l, hasTraits(l)]).toEqual([l, true]);
  });

  it('hasła broszury nie są sklejone: dokładnie jeden początek hasła „(Genus species)” na tekst, bez „Nagłówek NN (”', () => {
    const data = officialJson as unknown as { species: Record<string, { text: string }> };
    for (const [latin, v] of Object.entries(data.species)) {
      expect([latin, (v.text.match(/\(([A-Z]) ?[a-z]+ [a-z]+\)(?= –| Od )/g) ?? []).length]).toEqual([latin, 1]);
      expect([latin, /\s\d{1,3}\s\([A-Z]/.test(v.text)]).toEqual([latin, false]);
    }
  });

  it('teksty urzędowe po angielsku: każdy tekst ma tłumaczenie bez polskich liter i oznaczenie „translated”', () => {
    const en = officialEnJson as unknown as Record<string, string>;
    const data = officialJson as unknown as { species: Record<string, { text: string }>; pairs: { text: string; heading: string }[] };
    const texts = [...Object.values(data.species).map((v) => v.text), ...data.pairs.flatMap((p) => [p.text, p.heading])];
    for (const t of texts) expect(en[t]).toMatch(/^[^ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+$/);
    expect(officialTexts('Boletus edulis', 'Tylopilus felleus', 'en').every((o) => o.translated)).toBe(true);
    expect(officialTexts('Boletus edulis', 'Tylopilus felleus', 'en')[0].heading).toMatch(/^[^ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+$/);
  });
});
