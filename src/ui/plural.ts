// code-guard: intentional-duplicate - short local names fuzzy-match unrelated identifiers; no logic is duplicated.
/**
 * RESPONSIBILITY: Dobiera polską formę rzeczownika do liczby (1 skan, 2 skany, 5 skanów, 22 skany, 12 skanów)
 * INPUTS:         n: liczba całkowita ≥ 0; forms: [pojedyncza, 2–4, 5+] np. ['skan', 'skany', 'skanów']
 * OUTPUTS:        string „n forma”
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function pluralPl(n: number, forms: readonly [string, string, string]): string {
  return `${n} ${pluralWord(n, forms)}`;
}

/**
 * RESPONSIBILITY: Zwraca samą polską formę rzeczownika dla liczby (bez liczby), np. 3 → „zapisane”
 * INPUTS:         n: liczba całkowita ≥ 0; forms: [pojedyncza, 2–4, 5+]
 * OUTPUTS:        string — jedna z form
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function pluralWord(n: number, forms: readonly [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  return n === 1 ? forms[0] : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? forms[1] : forms[2];
}
