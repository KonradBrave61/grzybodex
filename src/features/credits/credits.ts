// code-guard: intentional-duplicate - short field names (title, url, label) fuzzy-match unrelated identifiers; no logic is duplicated.
import { displayName, speciesById } from '@/data/atlas';
import lookalikesJson from '@/data/lookalikes.json';
import { traitCount } from '@/data/traits';
import samplesJson from '@/data/samples.json';
import { referencePhotoCredits } from '@/data/reference';
import thirdPartyJson from '@/data/third-party.json';
import { creditsStrings } from '@/i18n/credits';
import type { Lang } from '@/i18n/i18n';

export type CreditLink = { label: string; url: string };
export type CreditItem = { title: string; detail: string; links: CreditLink[] };
export type CreditSection = { id: string; title: string; intro?: string; items: CreditItem[] };

type Sample = { id: string; latin: string; author: string; license: string; source: string };
type SourceRow = { source: { type: string; title: string; url: string } };

const MZ_LIST_URL = 'https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20260000258';
const CC_BY_NC_4 = { label: 'CC BY-NC 4.0', url: 'https://creativecommons.org/licenses/by-nc/4.0/' };
const CC_BY_SA_4 = { label: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' };
const OFL = { label: 'SIL Open Font License 1.1', url: 'https://openfontlicense.org/open-font-license-official-text/' };

/**
 * RESPONSIBILITY: Zamienia identyfikator licencji Creative Commons z danych (np. „cc-by-sa-3.0”) na etykietę i link
 * INPUTS:         id: string z samples.json (trusted, dane w paczce); format cc-<rodzaj>-<wersja>
 * OUTPUTS:        { label: „CC BY-SA 3.0”, url: https://creativecommons.org/licenses/by-sa/3.0/ }
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none (czysta funkcja)
 * ERRORS:         Error dla identyfikatora spoza wzorca cc-…-x.y (test pilnuje danych)
 */
export function ccLicense(id: string): CreditLink {
  const m = /^cc-([a-z-]+)-(\d\.\d)$/.exec(id);
  if (!m) throw new Error(`Unknown licence id: ${id}`);
  return { label: `CC ${m[1].toUpperCase()} ${m[2]}`, url: `https://creativecommons.org/licenses/${m[1]}/${m[2]}/` };
}

/**
 * RESPONSIBILITY: Atrybucje (TASL) zdjęć przykładowych dołączonych do aplikacji
 * INPUTS:         lang: język opisów (samples.json, trusted)
 * OUTPUTS:        po jednej pozycji na zdjęcie: nazwa, autor, licencja, źródło, zmiany; linki do pliku i licencji
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         jak ccLicense()
 */
export function sampleCredits(lang: Lang): CreditItem[] {
  const t = creditsStrings[lang];
  return (samplesJson as Sample[]).map((s) => {
    const lic = ccLicense(s.license);
    return {
      title: `${displayName(s.latin, lang)} (${s.latin})`,
      detail: t.sampleDetail(s.author, lic.label),
      links: [{ label: t.commonsFile, url: s.source }, lic],
    };
  });
}

/**
 * RESPONSIBILITY: Źródła tabeli sobowtórów: materiały urzędowe i publikacje (bez powtórzeń) + liczba par z Wikipedii
 * INPUTS:         lang: język opisów (lookalikes.json, trusted)
 * OUTPUTS:        { official: pozycje z liczbą par na źródło, wikipediaPairs: liczba par z Wikipedii }
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function lookalikeSources(lang: Lang): { official: CreditItem[]; wikipediaPairs: number } {
  const t = creditsStrings[lang];
  const rows = lookalikesJson as SourceRow[];
  const byUrl = new Map<string, { title: string; type: string; n: number }>();
  for (const { source } of rows) {
    if (source.type === 'wikipedia') continue;
    const e = byUrl.get(source.url) ?? { title: source.title, type: source.type, n: 0 };
    byUrl.set(source.url, { ...e, n: e.n + 1 });
  }
  const official = [...byUrl.entries()].map(([url, e]) => ({
    title: e.title,
    detail: `${e.type === 'scientific' ? t.scientific : t.official} · ${t.pairs(e.n)}`,
    links: [{ label: t.source, url }],
  }));
  return { official, wikipediaPairs: rows.filter((r) => r.source.type === 'wikipedia').length };
}

/**
 * RESPONSIBILITY: Atrybucje zdjęć wzorcowych Atlasu z Wikimedia Commons (autor, licencja, strona pliku)
 * INPUTS:         lang: język opisów i nazw (atlas-photos.json, trusted)
 * OUTPUTS:        po jednej pozycji na gatunek, w kolejności nazw (sortowanie wg języka)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function referencePhotoItems(lang: Lang): CreditItem[] {
  const t = creditsStrings[lang];
  // Sorted by Latin name, so both languages list the photos in the same order.
  return referencePhotoCredits(lang)
    .map((p) => ({ p, sp: speciesById(p.id) }))
    .sort((a, b) => (a.sp?.latin ?? a.p.id).localeCompare(b.sp?.latin ?? b.p.id))
    .map(({ p, sp }) => ({
      title: sp ? `${displayName(sp.latin, lang)} (${sp.latin})` : p.id,
      detail: t.refPhotoDetail(p.author),
      links: [{ label: 'Wikimedia Commons', url: p.page }, ...(p.licenseUrl ? [{ label: p.license, url: p.licenseUrl }] : [])],
    }));
}

/**
 * RESPONSIBILITY: Składa pełną treść ekranu „Licencje i autorzy” (model, zdjęcia, dane, czcionki, biblioteki)
 * INPUTS:         lang: język nagłówków i opisów (dane w paczce aplikacji; autorzy, nazwy licencji i adresy bez zmian)
 * OUTPUTS:        lista sekcji w kolejności wyświetlania; każda pozycja ma tytuł, opis i linki
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         jak ccLicense()
 */
export function creditSections(lang: Lang): CreditSection[] {
  const t = creditsStrings[lang];
  const lookalikes = lookalikeSources(lang);
  return [
    {
      id: 'model',
      title: t.modelTitle,
      intro: t.modelIntro,
      items: [
        {
          title: 'ViT-B/16 · Danish Fungi 2020',
          detail: t.modelDetail,
          links: [{ label: t.modelCard, url: 'https://huggingface.co/BVRA/vit_base_patch16_384.ft_df20_384' }, CC_BY_NC_4],
        },
        {
          title: t.df20Title,
          detail: t.df20Detail('Lukáš Picek, Milan Šulc, Jiří Matas, Thomas S. Jeppesen, Jacob Heilmann-Clausen, Thomas Læssøe, Tobias Frøslev, Emil Lind'),
          links: [{ label: t.df20Link, url: 'https://github.com/BohemianVRA/DanishFungiDataset' }],
        },
      ],
    },
    { id: 'photos', title: t.photosTitle, items: sampleCredits(lang) },
    {
      id: 'atlas-photos',
      title: t.atlasPhotosTitle,
      intro: t.atlasPhotosIntro,
      items: referencePhotoItems(lang),
    },
    {
      id: 'maps',
      title: t.mapsTitle,
      items: [
        {
          title: 'OpenStreetMap · Protomaps',
          detail: t.osmDetail,
          links: [
            { label: 'openstreetmap.org/copyright', url: 'https://www.openstreetmap.org/copyright' },
            { label: 'Protomaps', url: 'https://protomaps.com' },
          ],
        },
        {
          title: 'OpenTopoMap',
          detail: t.otmDetail,
          links: [{ label: 'opentopomap.org', url: 'https://opentopomap.org' }, { label: 'CC BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0/' }],
        },
        {
          title: t.bordersTitle,
          detail: t.bordersDetail,
          links: [{ label: 'geoportal.gov.pl', url: 'https://www.geoportal.gov.pl' }],
        },
      ],
    },
    {
      id: 'species',
      title: t.speciesTitle,
      intro: t.speciesIntro,
      items: [
        {
          title: t.mzTitle,
          detail: t.mzDetail,
          links: [{ label: 'ISAP', url: MZ_LIST_URL }],
        },
        {
          title: t.protectionTitle,
          detail: t.protectionDetail,
          links: [{ label: t.actText, url: 'https://api.sejm.gov.pl/eli/acts/DU/2014/1408/text.pdf' }],
        },
        {
          title: t.wikipediaTitle,
          detail: t.wikipediaDetail(lookalikes.wikipediaPairs, traitCount()),
          links: [{ label: 'pl.wikipedia.org', url: 'https://pl.wikipedia.org' }, CC_BY_SA_4],
        },
        {
          title: 'Wikidata',
          detail: t.wikidataDetail,
          links: [{ label: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' }],
        },
        {
          title: 'iNaturalist i GBIF',
          detail: t.inatDetail,
          links: [
            { label: 'iNaturalist', url: 'https://www.inaturalist.org' },
            { label: 'GBIF', url: 'https://www.gbif.org' },
          ],
        },
      ],
    },
    { id: 'lookalikes', title: t.lookalikesTitle, items: lookalikes.official },
    {
      id: 'fonts',
      title: t.fontsTitle,
      items: [
        {
          title: 'Shantell Sans',
          detail: t.shantellDetail,
          links: [{ label: t.project, url: 'https://github.com/arrowtype/shantell-sans' }, OFL],
        },
        {
          title: 'Source Sans 3',
          detail: t.sourceSansDetail,
          links: [{ label: t.project, url: 'https://github.com/adobe-fonts/source-sans' }, OFL],
        },
        {
          title: 'Noto Sans',
          detail: t.notoDetail,
          links: [{ label: t.project, url: 'https://github.com/notofonts/latin-greek-cyrillic' }, OFL],
        },
        {
          title: 'Caveat',
          detail: t.caveatDetail,
          links: [{ label: t.project, url: 'https://github.com/googlefonts/caveat' }, OFL],
        },
      ],
    },
    {
      id: 'libraries',
      title: t.librariesTitle,
      items: (thirdPartyJson as { name: string; version: string; license: string }[]).map((p) => ({ title: p.name, detail: `${p.version} · ${p.license}`, links: [] })),
    },
  ];
}
