// code-guard: intentional-duplicate - local UI identifiers fuzzy-match ui/icons.tsx; extra glyphs only, no logic is duplicated.
import { LineGlyph } from '@/ui/icons';

/** Line glyphs from boards C2-Przepisy / C2-Przepis that are not in ui/icons.tsx (24×24, round caps). */
const GLYPHS = {
  mushroom: ['M3.5 11.5a8.5 7 0 0 1 17 0z', 'M9.5 11.5v6a2.5 2.5 0 0 0 5 0v-6'],
  calendar: ['M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M4 10h16', 'M9 3v4', 'M15 3v4'],
  external: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
  arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
} as const;

export type GlyphName = keyof typeof GLYPHS;

/**
 * RESPONSIBILITY: Rysuje ikonę liniową zakładki Przepisy (grzyb, kalendarz, link zewnętrzny, strzałka)
 * INPUTS:         name: GlyphName; size: px; color: string; strokeWidth?: number (domyślnie 2)
 * OUTPUTS:        element SVG, dekoracyjny (ukryty przed czytnikiem ekranu)
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function Glyph({ name, size, color, strokeWidth = 2 }: { name: GlyphName; size: number; color: string; strokeWidth?: number }) {
  return <LineGlyph paths={GLYPHS[name]} size={size} color={color} strokeWidth={strokeWidth} />;
}
