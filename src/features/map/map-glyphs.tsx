// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import { Circle, Rect } from 'react-native-svg';

import { LineGlyph } from '@/ui/icons';

/** Line glyphs of the map boards (C2-Mapa, C2-Nawigacja), 24×24, stroke = colour. Shared icons stay in ui/icons.tsx. */
const GLYPHS = {
  basket: ['M7 10C7 4.5 17 4.5 17 10', 'M3.5 10H20.5L18.5 20H5.5Z', 'M9 13V17M12 13V17M15 13V17'],
  car: ['M3 16V12.5L6 7H18L21 12.5V16Z'],
  pinPlus: ['M12 21s-6-6.2-6-11a6 6 0 0 1 12 0c0 4.8-6 11-6 11z', 'M12 7.5v5M9.5 10h5'],
  device: ['M11 18h2'],
  plus: ['M12 5v14M5 12h14'],
  minus: ['M5 12h14'],
  noSignal: ['M4 20h.01M9 20v-4M14 20v-8M19 20V8', 'M3 3l18 18'],
  target: ['M12 2v3M12 19v3M2 12h3M19 12h3'],
  phone: ['M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2'],
  arrow: ['M12 20V4', 'M6 10l6-6 6 6'],
  trail: ['M4 20c3-2 2-6 6-7s3-6 7-8', 'M17 5h3v3'],
  trash: ['M4 7h16', 'M9.5 7V4.5h5V7', 'M6.5 7l1 13h9l1-13'],
  demo: ['M12 8v5', 'M12 16.5v.5', 'M10.3 3.9L2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'],
} as const;

export type GlyphName = keyof typeof GLYPHS;

const EXTRAS: Partial<Record<GlyphName, (c: string, w: number) => React.ReactNode>> = {
  car: (c, w) => (
    <>
      <Circle cx={7.5} cy={16.5} r={2} stroke={c} strokeWidth={w} />
      <Circle cx={16.5} cy={16.5} r={2} stroke={c} strokeWidth={w} />
    </>
  ),
  device: (c, w) => <Rect x={6.5} y={2.5} width={11} height={19} rx={2} stroke={c} strokeWidth={w} />,
  target: (c, w) => (
    <>
      <Circle cx={12} cy={12} r={7.5} stroke={c} strokeWidth={w} />
      <Circle cx={12} cy={12} r={2.5} stroke={c} strokeWidth={w} />
    </>
  ),
};

/**
 * RESPONSIBILITY: Rysuje ikonę liniową z ekranów mapy (koszyk, auto, telefon, strzałka kierunku…)
 * INPUTS:         glyph: GlyphName; color: string; size?: px (domyślnie 20); strokeWidth?: number (domyślnie 2)
 * OUTPUTS:        element SVG ukryty dla czytników ekranu (opis daje rodzic)
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function MapGlyph({ glyph, color, size = 20, strokeWidth = 2 }: { glyph: GlyphName; color: string; size?: number; strokeWidth?: number }) {
  return <LineGlyph paths={GLYPHS[glyph]} extra={EXTRAS[glyph]?.(color, strokeWidth)} size={size} color={color} strokeWidth={strokeWidth} />;
}
