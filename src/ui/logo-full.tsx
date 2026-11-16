// code-guard: intentional-duplicate - SVG element names (Path, Rect, Pattern) and logo naming fuzzy-match logo.tsx; this is the detailed variant, no logic is duplicated.
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Path, Pattern, Rect } from 'react-native-svg';

import { useStrings } from '@/i18n/i18n';
import { shellStrings } from '@/i18n/shell';

import { FONT, useTheme } from './theme';

const INK = '#2E2A24';
const BRAND_BROWN = '#6B3F1D';
const WEAVE_DARK = '#7A4A22';
const WEAVE_LIGHT = '#E0AE62';
const WEAVE_MID = '#C98F45';

/**
 * RESPONSIBILITY: Rysuje pełne logo Grzybodexu z tablicy Main: wiklinowe koszyki (splot), pas z liny, kłódka-borowik; opcjonalnie znak słowny Caveat
 * INPUTS:         width?: px (domyślnie 220; proporcje 264×240 jak w projekcie); wordmark?: pokaż napis „Grzybodex” pod znakiem
 * OUTPUTS:        widok z obrazem SVG; dla czytnika ekranu jeden element „obraz” z opisem logo
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function LogoFull({ width = 220, wordmark = false }: { width?: number; wordmark?: boolean }) {
  const { colors } = useTheme();
  const s = useStrings(shellStrings);
  return (
    <View
      style={logoFullUi.root}
      accessible
      accessibilityRole="image"
      accessibilityLabel={s.logo}>
      <Svg width={width} height={(width * 240) / 264} viewBox="-12 0 264 240">
        <Defs>
          <Pattern id="gdxWeave" width={18} height={14} patternUnits="userSpaceOnUse">
            <Rect width={18} height={14} fill={WEAVE_DARK} />
            <Rect x={1} y={1} width={14} height={5} rx={2.5} fill={WEAVE_LIGHT} />
            <Rect x={-8} y={8} width={14} height={5} rx={2.5} fill={WEAVE_MID} />
            <Rect x={10} y={8} width={14} height={5} rx={2.5} fill={WEAVE_MID} />
          </Pattern>
          <Pattern id="gdxRope" x={8} y={104} width={14} height={32} patternUnits="userSpaceOnUse">
            <Rect width={14} height={32} fill={WEAVE_DARK} />
            <Rect x={-1} y={6} width={16} height={5} rx={2.5} fill={WEAVE_LIGHT} transform="rotate(-32 7 8.5)" />
            <Rect x={-1} y={21} width={16} height={5} rx={2.5} fill={WEAVE_MID} transform="rotate(32 7 23.5)" />
          </Pattern>
        </Defs>
        <Rect x={56} y={32} width={128} height={11} rx={3} fill={BRAND_BROWN} stroke={INK} strokeWidth={3} />
        <Path d="M18 118 L36 50 Q38 42 46 42 L194 42 Q202 42 204 50 L222 118 Z" fill="url(#gdxWeave)" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
        <Rect x={56} y={197} width={128} height={11} rx={3} fill={BRAND_BROWN} stroke={INK} strokeWidth={3} />
        <Path d="M18 122 L36 190 Q38 198 46 198 L194 198 Q202 198 204 190 L222 122 Z" fill="url(#gdxWeave)" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
        <Path d="M10 110 H2 Q-6 110 -6 118 V122 Q-6 130 2 130 H10" fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" />
        <Path d="M230 110 H238 Q246 110 246 118 V122 Q246 130 238 130 H230" fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" />
        <Rect x={8} y={104} width={224} height={32} rx={8} fill="url(#gdxRope)" stroke={INK} strokeWidth={4} />
        <Path d="M12 120 H228" stroke={BRAND_BROWN} strokeWidth={2} />
        <Path d="M106 104 V 88 a14 14 0 0 1 28 0 V 104" fill="none" stroke={INK} strokeWidth={8} strokeLinecap="round" />
        <Rect x={101} y={114} width={38} height={38} rx={8} fill="#F3E6C8" stroke={INK} strokeWidth={4} />
        <Path d="M82 121 C 84 90, 156 90, 158 121 Q 120 127 82 121 Z" fill="#8B4A22" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
        <Circle cx={120} cy={133} r={5} fill={INK} />
        <Rect x={117.5} y={135} width={5} height={11} rx={2.5} fill={INK} />
      </Svg>
      {wordmark && (
        <Text style={[logoFullUi.wordmark, { color: colors.ink, fontSize: Math.round((width * 76) / 340) }]}>Grzybodex</Text>
      )}
    </View>
  );
}

const logoFullUi = StyleSheet.create({
  root: { alignItems: 'center' },
  wordmark: { fontFamily: FONT.logo },
});
