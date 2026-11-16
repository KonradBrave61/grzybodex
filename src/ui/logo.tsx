import Svg, { Path, Rect } from 'react-native-svg';

/**
 * RESPONSIBILITY: Rysuje znak Grzybodexu: dwa koszyki z kłódką-grzybem (wersja mała do paska tytułu)
 * INPUTS:         size?: szerokość w px (domyślnie 34; proporcje z projektu 264×240)
 * OUTPUTS:        element SVG, dekoracyjny (ukryty przed czytnikiem ekranu)
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <Svg width={size} height={(size * 240) / 264} viewBox="-12 0 264 240" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M18 118 L36 50 Q38 42 46 42 L194 42 Q202 42 204 50 L222 118 Z" fill="#E0AE62" stroke="#2E2A24" strokeWidth={12} strokeLinejoin="round" />
      <Path d="M18 122 L36 190 Q38 198 46 198 L194 198 Q202 198 204 190 L222 122 Z" fill="#E0AE62" stroke="#2E2A24" strokeWidth={12} strokeLinejoin="round" />
      <Rect x={8} y={104} width={224} height={32} rx={8} fill="#6B3F1D" stroke="#2E2A24" strokeWidth={12} />
      <Path d="M80 122 C 82 88, 158 88, 160 122 Z" fill="#8B4A22" stroke="#2E2A24" strokeWidth={10} strokeLinejoin="round" />
    </Svg>
  );
}
