// code-guard: intentional-duplicate - palette field names fuzzy-match theme.ts; recipe-only colours, no logic is duplicated.
import { type Palette, type TypeScale, useTheme } from '@/ui/theme';

/**
 * RESPONSIBILITY: Kolory tablic C2-Przepisy / C2-Przepis bez tokenu w theme.ts (jasny = wartości z tablic,
 *                 ciemny = tokeny motywu lub wartości z ciemnych tablic, np. D-Karta: ramka ostrzeżenia #3A2420 / #F2A285)
 * INPUTS:         c: Palette bieżącego trybu (trusted); isDark: boolean
 * OUTPUTS:        obiekt z dodatkowymi kolorami (chip, ostrzeżenie, papier oryginału, półka, cień, bez koloru paska nagłówka — ten jest w motywie)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
const extraFor = (c: Palette, isDark: boolean) =>
  isDark
    ? {
        chip: c.panelStrong,
        chipText: c.ink,
        cardBorder: c.line,
        text2: '#E2D5BD',
        warnBg: '#3A2420',
        warnStrong: '#F2A285',
        warnTitle: '#F2A285',
        paperBorder: '#9A7A4E',
        paperInner: c.kraft,
        paperLabel: c.bolete,
        dashed: c.line,
        stitch: '#9A7A4E',
        plank: c.kraft,
        plankShadow: '#26211A',
        shadow: 'rgba(0, 0, 0, 0.5)',
      }
    : {
        chip: '#F1E2C2',
        chipText: '#3B3326',
        cardBorder: '#E2D3B5',
        text2: '#3B342C',
        warnBg: '#F8E6DE',
        warnStrong: '#9A3B22',
        warnTitle: '#7F1D1D',
        paperBorder: '#B9A47A',
        paperInner: '#D4BC8E',
        paperLabel: '#6B3F1D',
        dashed: '#C9B48A',
        stitch: '#9C7647',
        plank: c.bolete,
        plankShadow: '#6B3F1D',
        shadow: 'rgba(46, 42, 36, 0.16)',
      };

export type RecipePalette = Palette & ReturnType<typeof extraFor>;

/**
 * RESPONSIBILITY: Zwraca kolory ekranów Przepisy: tokeny motywu + kolory tablic projektu bez tokenu (jasny/ciemny)
 * INPUTS:         none (tryb z useTheme)
 * OUTPUTS:        { colors: RecipePalette, isDark: boolean, type: TypeScale } (type = skala tekstu z Ustawień, jak w useTheme)
 * AUTHN:          none (internal)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function useRecipePalette(): { colors: RecipePalette; isDark: boolean; type: TypeScale } {
  const { colors, isDark, type } = useTheme();
  return { colors: { ...colors, ...extraFor(colors, isDark) }, isDark, type };
}
