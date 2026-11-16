// code-guard: intentional-duplicate - generic names (strings, lang, plural) fuzzy-match other modules; this is the single i18n core.
/**
 * App languages. Every screen keeps its texts in one "namespace" file under src/i18n/ (e.g. atlas.ts):
 *
 *   export const atlasStrings = defineStrings({
 *     pl: { title: 'Atlas', count: (n: number) => `${n} ${plural('pl', n, ['gatunek', 'gatunki', 'gatunków'])}` },
 *     en: { title: 'Atlas', count: (n: number) => `${n} ${plural('en', n, ['species', 'species'])}` },
 *   });
 *
 * and a component reads them with `const s = useStrings(atlasStrings)`; non-React code uses `strings(atlasStrings)`.
 * TypeScript forces the English object to have exactly the same keys and value types as the Polish one.
 * Polish is the source language; for safety texts (poisoning, protected species) the meaning must stay 1:1.
 */
import { getSettings, type Language, useSettings } from '@/features/settings/settings';

export type Lang = Language;

type Shape = Record<string, unknown>;
export type Namespace<T extends Shape> = { pl: T; en: T };

/**
 * RESPONSIBILITY: Deklaruje teksty jednego ekranu/obszaru w obu językach (typ pilnuje, że angielski ma te same klucze)
 * INPUTS:         ns: { pl, en } — wartości: tekst albo funkcja zwracająca tekst
 * OUTPUTS:        ten sam obiekt (dla useStrings/strings)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none (błędy kluczy wyłapuje TypeScript)
 */
export function defineStrings<T extends Shape>(ns: { pl: T; en: { [K in keyof T]: T[K] } }): Namespace<T> {
  return ns as Namespace<T>;
}

/**
 * RESPONSIBILITY: Hook React — teksty obszaru w bieżącym języku aplikacji (przerysowanie przy zmianie języka)
 * INPUTS:         ns: Namespace z defineStrings
 * OUTPUTS:        obiekt tekstów (ns.pl albo ns.en)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        global-state (ustawienia)
 * ERRORS:         none
 */
export function useStrings<T extends Shape>(ns: Namespace<T>): T {
  return ns[useSettings().language];
}

/**
 * RESPONSIBILITY: Teksty obszaru w bieżącym języku poza komponentami (funkcje, powiadomienia, zadania w tle)
 * INPUTS:         ns: Namespace
 * OUTPUTS:        obiekt tekstów
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        global-state (odczyt ustawień)
 * ERRORS:         none
 */
export function strings<T extends Shape>(ns: Namespace<T>): T {
  return ns[getSettings().language];
}

/**
 * RESPONSIBILITY: Hook z bieżącym językiem aplikacji (do formatowania i wyboru danych)
 * INPUTS:         none
 * OUTPUTS:        Lang
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        global-state (ustawienia)
 * ERRORS:         none
 */
export function useLang(): Lang {
  return useSettings().language;
}

/**
 * RESPONSIBILITY: Forma rzeczownika dla liczby w danym języku (bez samej liczby)
 * INPUTS:         lang; n: liczba całkowita ≥ 0; forms: pl [1, 2–4, 5+] albo en [one, other]
 * OUTPUTS:        jedna z form
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function plural(lang: Lang, n: number, forms: readonly [string, string] | readonly [string, string, string]): string {
  const last = forms[forms.length - 1];
  if (n === 1) return forms[0];
  if (lang === 'en' || forms.length === 2) return last;
  const mod10 = n % 10;
  const mod100 = n % 100;
  return mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? forms[1] : last;
}

/**
 * RESPONSIBILITY: Locale BCP-47 do dat i liczb
 * INPUTS:         lang
 * OUTPUTS:        pl-PL albo en-GB
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function locale(lang: Lang): string {
  return lang === 'pl' ? 'pl-PL' : 'en-GB';
}

/**
 * RESPONSIBILITY: Liczba dziesiętna w zapisie języka (pl: przecinek, en: kropka)
 * INPUTS:         lang; value; digits: miejsca po przecinku
 * OUTPUTS:        tekst
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function decimal(lang: Lang, value: number, digits = 1): string {
  const s = value.toFixed(digits);
  return lang === 'pl' ? s.replace('.', ',') : s;
}
