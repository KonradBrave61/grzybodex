// code-guard: intentional-duplicate - short text keys (back, settings, atlas) fuzzy-match other namespaces; texts only, no logic.
/** App shell: tab bar, screen header, logo, category chips (src/ui). Category labels themselves come from displayCategory (i18n/atlas.ts) so every screen uses one term. */
import { defineStrings } from './i18n';

export const shellStrings = defineStrings({
  pl: {
    tabAtlas: 'Atlas',
    tabMap: 'Mapa',
    tabCollection: 'Kolekcja',
    tabQuiz: 'Quiz',
    tabRecipes: 'Przepisy',
    scan: 'Skanuj grzyba',
    back: 'Wróć',
    settings: 'Ustawienia',
    logo: 'Logo Grzybodex: dwa wiklinowe koszyki, górny odwrócony na dolnym, spięte kłódką w kształcie borowika',
    poisoningsReported: 'Zgłaszane zatrucia',
    protectedSpecies: 'Chroniony',
  },
  en: {
    tabAtlas: 'Atlas',
    tabMap: 'Map',
    tabCollection: 'Collection',
    tabQuiz: 'Quiz',
    tabRecipes: 'Recipes',
    scan: 'Scan a mushroom',
    back: 'Back',
    settings: 'Settings',
    logo: 'Grzybodex logo: two wicker baskets, the upper one upside down on the lower one, joined by a padlock shaped like a bolete',
    poisoningsReported: 'Poisonings reported',
    protectedSpecies: 'Protected species',
  },
});
