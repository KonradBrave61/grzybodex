// code-guard: intentional-duplicate - text key names (title, back, season…) fuzzy-match other namespaces; texts only, no logic.
/**
 * Texts of the "Przepisy" (Recipes) tab and the recipe screen — docs/legal/teksty-w-aplikacji.md §8
 * (do not reword the Polish here without updating the doc). The forbidden-word lists in features/recipes/texts.ts win over §8;
 * minimal rephrasings are marked "REPHRASED". English keeps every safety text 1:1 (src/i18n/GLOSSARY.md).
 * Recipe content itself (titles, original text, modern version) is in data/przepisy.json and data/przepisy.en.json.
 */
import type { Segment } from '@/features/recipes/logic';

import { defineStrings } from './i18n';

type WarningSource = { who: string; title: string; url: string };

const MZ_PAGE = 'https://www.gov.pl/web/zdrowie/bezpieczne-grzybobranie';
const GIS_PAGE = 'https://www.gov.pl/web/gis/dla-milosnikow-zbierania-grzybow2';

export const recipeStrings = defineStrings({
  pl: {
    /** §8.1 — banner at the top of the tab. */
    banner: {
      title: 'Przepisy z dawnych książek kucharskich',
      history: 'To historia kuchni, a nie porada, czy grzyb można zjeść.',
      onlySureLead: 'Gotuj tylko z grzybów pewnych:',
      // REPHRASED: „sprawdzonych” → „ocenionych” (§1.8 forbids „sprawdzony”; GIS wording: „bezpłatna ocena”).
      onlySureRest:
        ' kupionych w sklepie lub na targu (grzyby leśne muszą mieć atest) albo ocenionych przez grzyboznawcę w Sanepidzie. Ta porada jest bezpłatna.',
      skipped: 'Dawne książki polecały czasem grzyby, które dziś uznaje się za groźne. Takie przepisy pomijamy.',
      sanepidButton: 'Jak znaleźć Sanepid',
    },
    /** §8.2 — warning shown with every recipe (above the ingredients, always visible). REPHRASED: „sprawdzonych” → „ocenionych” (§1.8). */
    warning: {
      title: 'Zanim ugotujesz',
      items: [
        [{ text: 'Użyj tylko grzybów pewnych — z atestem albo ocenionych przez grzyboznawcę.' }],
        [{ text: 'Nie jedz grzybów na surowo.', bold: true }],
        [{ text: 'Grzybów nie zaleca się dzieciom, kobietom w ciąży i karmiącym, osobom starszym i osobom z chorobami układu pokarmowego.' }],
        [{ text: 'Źle się czujesz po jedzeniu grzybów? ' }, { text: 'Dzwoń pod 112.', bold: true }],
      ] as Segment[][],
      sources: 'Źródła: Ministerstwo Zdrowia, Główny Inspektorat Sanitarny ·',
      sourcesLink: 'Skąd to wiemy?',
    },
    /** Official sources of the §8.2 warning, as listed in the §8 header of the legal doc (titles quoted verbatim). */
    warningSources: [
      { who: 'Ministerstwo Zdrowia:', title: 'Bezpieczne grzybobranie', url: MZ_PAGE },
      { who: 'Główny Inspektorat Sanitarny:', title: 'Dla miłośników zbierania grzybów', url: GIS_PAGE },
    ] as WarningSource[],
    /** Label of the MZ regulation link (§8 header: „rozporządzenie MZ, § 4 ust. 1 (atest)”); URL comes from the JSON. */
    actSourceLabel: 'Minister Zdrowia (atest, § 4 ust. 1):',
    /** §8.3 — note after the species name. REPHRASED: „jest bezpieczny” → „nadaje się do jedzenia” (§1.8 forbids „bezpieczny”). */
    speciesNote: ' — na liście grzybów dopuszczonych do sprzedaży (Minister Zdrowia). To nie znaczy, że Twój okaz nadaje się do jedzenia.',
    speciesCardButton: 'Karta gatunku',
    /** Old-name caveat per species — design board C2-Przepis (from ZRODLA.md §9 pkt 1). Others: no approved text yet. */
    speciesBrief: { 'Lactarius deliciosus': 'dawna nazwa obejmowała kilka mleczajów' } as Record<string, string>,
    /** §8.4 — source line under „Oryginał”. REPHRASED: „sprawdzony ze skanem” → „porównany ze skanem” (§1.8). */
    source: {
      lead: 'Źródło:',
      scanLead: 'Skan:',
      scanLink: 'Wikimedia Commons',
      and: ' i ',
      publicDomain: 'Domena publiczna.',
      spelling: 'Pisownia oryginalna. „[…]” oznacza pominięty fragment.',
      wikiPrefix: 'Tekst za: Wikiźródła, porównany ze skanem ·',
      wikiLink: 'pl.wikisource.org',
    },
    /** §8.5 — caption under „Na dziś”. The licence line is a placeholder in the legal doc (open decision). */
    adaptation: {
      heading: 'Na dziś',
      ingredients: 'Składniki',
      steps: 'Przygotowanie',
      showAll: 'Pokaż cały przepis na dziś',
      creditLead: 'Opracowanie:',
      basedOn: ' — na podstawie przepisu z książki:',
      changed: 'Zmieniliśmy miary i opis kroków. To nie jest oryginalny tekst z książki.',
      license: '[Licencja opracowania — DO DECYZJI]',
    },
    /** §8.6 — shelf. */
    shelf: {
      title: 'Półka — książki o grzybach i materiały urzędowe',
      learnLead: 'Książka pomaga się uczyć, ale ',
      learnBold: 'nie zastąpi grzyboznawcy',
      notAffiliated: 'Autorzy i wydawcy tych książek nie są związani z Grzybodexem.',
    },
    /** Filter chips of board C2-Przepisy (keys in features/recipes/logic.ts). */
    filters: { all: 'Wszystkie', rydz: 'Rydz', borowik: 'Borowik', season: 'Sezon teraz' },
    /** Alt text of bundled scan crops (board C2-Przepis), per recipe id. */
    scanAlt: {
      'rydze-w-masle-cwierczakiewiczowa-1871': 'Wycinek skanu strony 209 z książki, nagłówek „36. Rydze w maśle.”',
    } as Record<string, string>,
    /** Plain UI labels (not legal texts). Empty `translated` / `polishOriginal` = not shown (Polish is the original). */
    ui: {
      screenTitle: 'Przepisy',
      back: 'Wróć do listy przepisów',
      filtersLabel: 'Filtruj przepisy',
      emptyFilter: 'Żaden przepis nie pasuje do tego filtra.',
      season: 'Sezon:',
      versionLabel: 'Wersja przepisu',
      original: 'Oryginał',
      page: 's.',
      inRecipe: 'W przepisie:',
      inApp: 'W aplikacji to',
      notFound: 'Nie ma takiego przepisu.',
      opensBrowser: 'Otwiera stronę w przeglądarce',
      opensRecipe: 'Otwiera przepis',
      translated: '',
      polishOriginal: '',
    },
  },
  en: {
    banner: {
      title: 'Recipes from old cookbooks',
      history: 'This is culinary history, not advice on whether a mushroom can be eaten.',
      onlySureLead: 'Cook only with mushrooms that are certain:',
      onlySureRest:
        ' bought in a shop or at a market (wild mushrooms must have a certificate) or assessed by a certified mushroom expert at Sanepid (the Polish sanitary inspection). This advice is free of charge.',
      skipped: 'Old books sometimes recommended mushrooms that are now considered dangerous. We leave such recipes out.',
      sanepidButton: 'How to find Sanepid',
    },
    warning: {
      title: 'Before you cook',
      items: [
        [{ text: 'Use only mushrooms that are certain — with a certificate or assessed by a certified mushroom expert.' }],
        [{ text: 'Do not eat mushrooms raw.', bold: true }],
        [{ text: 'Mushrooms are not recommended for children, pregnant and breastfeeding women, older people and people with digestive system diseases.' }],
        [{ text: 'Feeling unwell after eating mushrooms? ' }, { text: 'Call 112.', bold: true }],
      ] as Segment[][],
      sources: 'Sources: Polish Ministry of Health, Chief Sanitary Inspectorate ·',
      sourcesLink: 'How do we know?',
    },
    warningSources: [
      { who: 'Polish Ministry of Health:', title: 'Bezpieczne grzybobranie (Safe mushroom picking)', url: MZ_PAGE },
      { who: 'Chief Sanitary Inspectorate (GIS):', title: 'Dla miłośników zbierania grzybów (For mushroom-picking enthusiasts)', url: GIS_PAGE },
    ] as WarningSource[],
    actSourceLabel: 'Polish Minister of Health (certificate, § 4(1)):',
    speciesNote:
      ' — on the list of mushrooms approved for sale (Polish Minister of Health). This does not mean that your specimen is fit to eat.',
    speciesCardButton: 'Species card',
    speciesBrief: { 'Lactarius deliciosus': 'the old name covered several milk caps' } as Record<string, string>,
    source: {
      lead: 'Source:',
      scanLead: 'Scan:',
      scanLink: 'Wikimedia Commons',
      and: ' and ',
      publicDomain: 'Public domain.',
      spelling: 'Polish text in the original spelling. „[…]” marks an omitted passage.',
      wikiPrefix: 'Polish text from: Wikisource (Wikiźródła), compared with the scan ·',
      wikiLink: 'pl.wikisource.org',
    },
    adaptation: {
      heading: 'Modern version',
      ingredients: 'Ingredients',
      steps: 'Method',
      showAll: 'Show the whole modern version',
      creditLead: 'Adaptation:',
      basedOn: ' — based on a recipe from the book:',
      changed: 'We changed the measures and the description of the steps. This is not the original text from the book.',
      license: '[Adaptation licence — TO BE DECIDED]',
    },
    shelf: {
      title: 'Shelf — books about mushrooms and official materials',
      learnLead: 'A book helps you learn, but ',
      learnBold: 'it will not replace a certified mushroom expert',
      notAffiliated: 'The authors and publishers of these books are not affiliated with Grzybodex.',
    },
    filters: { all: 'All', rydz: 'Saffron milk cap', borowik: 'Porcini', season: 'In season now' },
    scanAlt: {
      'rydze-w-masle-cwierczakiewiczowa-1871':
        'Cut-out of the scan of page 209 of the book, heading „36. Rydze w maśle.” (36. Saffron milk caps in butter.)',
    } as Record<string, string>,
    ui: {
      screenTitle: 'Recipes',
      back: 'Back to the recipe list',
      filtersLabel: 'Filter recipes',
      emptyFilter: 'No recipe matches this filter.',
      season: 'Season:',
      versionLabel: 'Recipe version',
      original: 'Original',
      page: 'p.',
      inRecipe: 'In the recipe:',
      inApp: 'In the app this is',
      notFound: 'There is no such recipe.',
      opensBrowser: 'Opens the page in the browser',
      opensRecipe: 'Opens the recipe',
      translated: 'Translated from the Polish original',
      polishOriginal: 'Polish original',
    },
  },
});

export type RecipeStrings = (typeof recipeStrings)['pl'];
