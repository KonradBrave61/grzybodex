import type { ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** Line icons from the design canvas (24×24, stroke = currentColor). */
const PATHS = {
  atlas: ['M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4z', 'M20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z'],
  map: ['M12 21s-6-6.2-6-11a6 6 0 0 1 12 0c0 4.8-6 11-6 11z'],
  camera: ['M4 8h3l2-3h6l2 3h3v11H4z'],
  collection: ['M8 11V8a4 4 0 0 1 8 0v3'],
  quiz: ['M5 5h14v14H5z'],
  recipes: ['M3 12h18', 'M5 12v4.5A3.5 3.5 0 0 0 8.5 20h7a3.5 3.5 0 0 0 3.5-3.5V12', 'M9.5 3.5q-1.25 1.25 0 2.5t0 2.5', 'M14.5 3.5q-1.25 1.25 0 2.5t0 2.5'],
  search: ['M20 20l-4.5-4.5'],
  sort: ['M4 6h16', 'M7 12h10', 'M10 18h4'],
  inedible: ['M6 18L18 6'],
  edible: ['M7 3v8', 'M4.5 3v4.5a2.5 2.5 0 0 0 5 0V3', 'M7 11v10', 'M17.5 3c-1.9 0-3.2 2-3.2 4.8 0 2.4 1.2 4 3.2 4.2V21'],
  poisonous: ['M12 3.5l9.5 17h-19z', 'M12 10v4.5', 'M12 17.5v.5'],
  deadly: ['M12 3a7 7 0 0 0-7 7c0 2.6 1.4 4.3 3 5.2V19h8v-3.8c1.6-.9 3-2.6 3-5.2a7 7 0 0 0-7-7z', 'M10.5 19v-2', 'M13.5 19v-2'],
  protected: ['M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z'],
  unknown: ['M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14', 'M12 17.5v.5'],
  check: ['M20 6L9 17l-5-5'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  back: ['M15 5l-7 7 7 7'],
  gallery: ['M4 5h16v14H4z', 'M4 16l5-5 4 4 3-3 4 4'],
  flash: ['M13 3L5 14h6l-1 7 8-11h-6z'],
  settings: ['M18.8 12L21.4 12', 'M16.81 16.81L18.65 18.65', 'M12 18.8L12 21.4', 'M7.19 16.81L5.35 18.65', 'M5.2 12L2.6 12', 'M7.19 7.19L5.35 5.35', 'M12 5.2L12 2.6', 'M16.81 7.19L18.65 5.35'],
  chevron: ['M9 5l7 7-7 7'],
} as const;

const EXTRA: Partial<Record<IconName, (c: string) => React.ReactNode>> = {
  map: (c) => <Circle cx={12} cy={10} r={2.2} stroke={c} />,
  camera: (c) => <Circle cx={12} cy={13} r={3.5} stroke={c} />,
  collection: (c) => <Rect x={6} y={11} width={12} height={9} rx={2} stroke={c} />,
  quiz: (c) => (
    <>
      <Circle cx={9} cy={9} r={1} stroke={c} />
      <Circle cx={15} cy={9} r={1} stroke={c} />
      <Circle cx={12} cy={12} r={1} stroke={c} />
      <Circle cx={9} cy={15} r={1} stroke={c} />
      <Circle cx={15} cy={15} r={1} stroke={c} />
    </>
  ),
  search: (c) => <Circle cx={11} cy={11} r={6} stroke={c} />,
  inedible: (c) => <Circle cx={12} cy={12} r={8.5} stroke={c} />,
  deadly: (c) => (
    <>
      <Circle cx={9.3} cy={10.5} r={1.4} stroke={c} />
      <Circle cx={14.7} cy={10.5} r={1.4} stroke={c} />
    </>
  ),
  unknown: (c) => <Circle cx={12} cy={12} r={9} stroke={c} />,
  gallery: (c) => <Circle cx={9} cy={9} r={1.5} stroke={c} />,
  settings: (c) => (
    <>
      <Circle cx={12} cy={12} r={6.8} stroke={c} strokeWidth={1.9} />
      <Circle cx={12} cy={12} r={2.6} stroke={c} strokeWidth={1.9} />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

/**
 * RESPONSIBILITY: Rysuje ikonę liniową z zestawu projektu (SVG 24×24)
 * INPUTS:         name: IconName; size?: px (domyślnie 24); color: string; strokeWidth?: number
 * OUTPUTS:        element SVG; ikona dekoracyjna (bez etykiety dostępności — opis daje rodzic)
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function Icon({ name, size = 24, color, strokeWidth = 1.9 }: { name: IconName; size?: number; color: string; strokeWidth?: number }) {
  return <LineGlyph paths={PATHS[name]} extra={EXTRA[name]?.(color)} size={size} color={color} strokeWidth={strokeWidth} />;
}

/**
 * RESPONSIBILITY: Wspólny renderer ikon liniowych 24×24 (zaokrąglone końce) — dla zestawu wspólnego i zestawów ekranów
 * INPUTS:         paths: ścieżki SVG „d”; extra?: dodatkowe kształty (koła, prostokąty); size?: px (24); color: string; strokeWidth?: number (1.9)
 * OUTPUTS:        element SVG, dekoracyjny (ukryty przed czytnikiem ekranu — opis daje rodzic)
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function LineGlyph({
  paths,
  extra,
  size = 24,
  color,
  strokeWidth = 1.9,
}: {
  paths: readonly string[];
  extra?: ReactNode;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {paths.map((d) => (
        <Path key={d} d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {extra}
    </Svg>
  );
}
