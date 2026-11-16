import Svg, { Path } from 'react-native-svg';

/**
 * RESPONSIBILITY: Sylwetka grzyba dla gatunków jeszcze niezeskanowanych (kafelek atlasu „do odkrycia”)
 * INPUTS:         color: string — kolor wypełnienia; size?: wysokość w px (domyślnie 72)
 * OUTPUTS:        element SVG, dekoracyjny
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function MushroomSilhouette({ color, size = 72 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M6 30 C 8 14, 56 14, 58 30 C 58 33, 52 34, 32 34 C 12 34, 6 33, 6 30 Z" fill={color} />
      <Path d="M25 34 L 39 34 C 40 44, 42 52, 44 58 L 20 58 C 22 52, 24 44, 25 34 Z" fill={color} opacity={0.8} />
    </Svg>
  );
}
