// code-guard: intentional-duplicate - DEADLY_ROW fuzzy-matches local `deadly` booleans; no logic is duplicated.
import type { Palette } from './theme';

/**
 * Deadly result rows keep a fixed light surface in both themes (with fixed dark text), so anything drawn on them
 * must use light-surface colours too — theme colours are meant for `colors.card`, not for this surface.
 */
export const DEADLY_ROW = { bg: '#FBEDEA', ink: '#2E2A24', ink2: '#5A5146', track: '#E9DCC0' } as const;

/**
 * RESPONSIBILITY: Dobiera kolory toru i wypełnienia paska podobieństwa do tła wiersza wyniku
 * INPUTS:         colors: paleta motywu (panelStrong, ink2); onDeadlyRow: czy pasek leży na stałym jasnym tle wiersza śmiertelnego
 * OUTPUTS:        { track, fill } — wypełnienie kontrastuje z torem ≥ 3:1 (WCAG 1.4.11) w obu motywach
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function similarityBarColors(colors: Pick<Palette, 'panelStrong' | 'ink2'>, onDeadlyRow: boolean): { track: string; fill: string } {
  if (onDeadlyRow) return { track: DEADLY_ROW.track, fill: DEADLY_ROW.ink2 };
  return { track: colors.panelStrong, fill: colors.ink2 };
}
