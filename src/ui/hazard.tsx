import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

import { useTheme } from './theme';

/**
 * RESPONSIBILITY: Ramka w ukośne żółto-czarne pasy dla ostrzeżeń o gatunkach śmiertelnie trujących
 * INPUTS:         children: ReactNode (treść ostrzeżenia); radius?: zaokrąglenie zewnętrzne (domyślnie 14)
 * OUTPUTS:        widok z paskowaną ramką 4 px (SVG pattern, kąt −45°), treść w środku
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function HazardFrame({ children, radius = 14 }: { children: ReactNode; radius?: number }) {
  const { colors } = useTheme();
  return (
    <View style={[hz.frame, { borderRadius: radius }]}>
      <Svg style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Defs>
          <Pattern id="hazard" width={16} height={16} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <Rect width={16} height={16} fill={colors.hazardB} />
            <Path d="M0 0h8v16H0z" fill={colors.hazardA} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" rx={radius} fill="url(#hazard)" />
      </Svg>
      {children}
    </View>
  );
}

const hz = StyleSheet.create({
  frame: { padding: 4, overflow: 'hidden' },
});
