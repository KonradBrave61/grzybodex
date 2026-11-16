// code-guard: intentional-duplicate - SVG icon names (Svg, Path, size, color) fuzzy-match ui/icons.tsx; these are onboarding-only glyphs missing from the shared set.
import Svg, { Ellipse, Path } from 'react-native-svg';

import { LineGlyph } from '@/ui/icons';

/** Line glyphs from boards O4 (24×24, stroke = color) that are not in the shared ui/icons.tsx set. */
const GLYPHS = {
  /** Scanner frame with a question mark — „Komputer może się pomylić”. */
  scanQuestion: [
    'M4 8V6a2 2 0 0 1 2-2h2',
    'M16 4h2a2 2 0 0 1 2 2v2',
    'M20 16v2a2 2 0 0 1-2 2h-2',
    'M8 20H6a2 2 0 0 1-2-2v-2',
    'M9.5 10a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5v.2',
    'M12 16.5v.01',
  ],
  /** Crossed-out fork and knife — „Nie służy do sprawdzania, czy grzyb można zjeść”. */
  noEating: ['M7 3v8', 'M4.5 3v4.5a2.5 2.5 0 0 0 5 0V3', 'M7 11v10', 'M17.5 3c-1.9 0-3.2 2-3.2 4.8 0 2.4 1.2 4 3.2 4.2V21', 'M3 21L21 3'],
} as const;

export type GlyphName = keyof typeof GLYPHS;

/**
 * RESPONSIBILITY: Rysuje ikonę liniową z tablic onboardingu, której nie ma we wspólnym zestawie ikon
 * INPUTS:         name: GlyphName; color: string; size?: px (domyślnie 24)
 * OUTPUTS:        element SVG, dekoracyjny (opis daje tekst obok)
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function Glyph({ name, color, size = 24 }: { name: GlyphName; color: string; size?: number }) {
  return <LineGlyph paths={GLYPHS[name]} size={size} color={color} strokeWidth={2} />;
}

/**
 * RESPONSIBILITY: Rysuje małą sylwetkę borowika z podglądu wiersza atlasu (tablica O3)
 * INPUTS:         size?: px (domyślnie 28)
 * OUTPUTS:        element SVG, dekoracyjny
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function BoleteSilhouette({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="8 6 48 44" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Ellipse cx={32} cy={45} rx={18} ry={2.5} fill="#E2D3B5" />
      <Path d="M24 44c-2-8-1-14 2-18h12c3 4 4 10 2 18z" fill="#F3E6C8" stroke="#2E2A24" strokeWidth={2.4} strokeLinejoin="round" />
      <Path d="M10 26c1-14 43-14 44 0-8 3-36 3-44 0z" fill="#8B4A22" stroke="#2E2A24" strokeWidth={2.4} strokeLinejoin="round" />
    </Svg>
  );
}
