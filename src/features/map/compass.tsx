// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, type SharedValue, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { type Palette, TYPE, useTheme } from '@/ui/theme';

import { unwrapAngle } from './geo';

const VIEW = 240;
const LETTER_RADIUS = 82;
const LETTERS = [
  { text: 'N', deg: 0 },
  { text: 'E', deg: 90 },
  { text: 'S', deg: 180 },
  { text: 'W', deg: 270 },
] as const;
const TICKS = Array.from({ length: 12 }, (_, i) => i * 30);
const TURN = { duration: 300, easing: Easing.out(Easing.cubic) };

/** Dial letter that orbits with the dial but stays upright (readable at any heading). Fixed TYPE.number on purpose: the letter is part of the fixed-size dial graphic (offsets tuned to 17 px), not body text. */
function DialLetter({ text, deg, dial, size, color }: { text: string; deg: number; dial: SharedValue<number>; size: number; color: string }) {
  const r = (LETTER_RADIUS * size) / VIEW;
  const orbit = useAnimatedStyle(() => {
    const a = ((deg + dial.value) * Math.PI) / 180;
    return { transform: [{ translateX: r * Math.sin(a) }, { translateY: -r * Math.cos(a) }] };
  });
  return (
    <Animated.Text style={[TYPE.number, compassUi.letter, { left: size / 2 - 14, top: size / 2 - 11, color }, orbit]} importantForAccessibility="no">
      {text}
    </Animated.Text>
  );
}

function Rim({ colors }: { colors: Palette }) {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW} ${VIEW}`} style={StyleSheet.absoluteFill}>
      <Circle cx={120} cy={120} r={110} fill={colors.card} stroke={colors.ink} strokeWidth={2.5} />
      <Circle cx={120} cy={120} r={70} fill="none" stroke={colors.line} strokeWidth={1.5} strokeDasharray="4 4" />
    </Svg>
  );
}

/**
 * RESPONSIBILITY: Kompas prowadzenia: tarcza obraca się z telefonem, strzałka wskazuje cel; obroty płynne (300 ms), najkrótszą drogą
 * INPUTS:         bearing: azymut do celu w stopniach albo null (brak położenia → bez strzałki);
 *                 heading: kierunek telefonu albo null (brak kompasu → tarcza „północ u góry”); label: opis dla czytnika ekranu; size?: px
 * OUTPUTS:        widok size×size; przy „ogranicz ruch” obroty bez animacji
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function Compass({ bearing, heading, label, size = 240 }: { bearing: number | null; heading: number | null; label: string; size?: number }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const dial = useSharedValue(-(heading ?? 0));
  const arrow = useSharedValue((bearing ?? 0) - (heading ?? 0));
  useEffect(() => {
    const dialNext = unwrapAngle(dial.get(), -(heading ?? 0));
    const arrowNext = unwrapAngle(arrow.get(), (bearing ?? 0) - (heading ?? 0));
    dial.set(reduced ? dialNext : withTiming(dialNext, TURN));
    arrow.set(reduced ? arrowNext : withTiming(arrowNext, TURN));
  }, [bearing, heading, reduced, dial, arrow]);
  const dialSpin = useAnimatedStyle(() => ({ transform: [{ rotate: `${dial.value}deg` }] }));
  const arrowSpin = useAnimatedStyle(() => ({ transform: [{ rotate: `${arrow.value}deg` }] }));

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={[compassUi.root, { width: size, height: size }]}>
      <Rim colors={colors} />
      <Animated.View style={[StyleSheet.absoluteFill, dialSpin]}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW} ${VIEW}`}>
          {TICKS.map((t) => (
            <Path key={t} d={t % 90 === 0 ? 'M120 12V22' : 'M120 12V18'} transform={`rotate(${t} 120 120)`} stroke={colors.ink} strokeWidth={2} strokeLinecap="round" />
          ))}
        </Svg>
      </Animated.View>
      {LETTERS.map((l) => (
        <DialLetter key={l.text} text={l.text} deg={l.deg} dial={dial} size={size} color={l.text === 'N' ? colors.maple : colors.ink} />
      ))}
      {bearing !== null && (
        <Animated.View style={[StyleSheet.absoluteFill, arrowSpin]}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW} ${VIEW}`}>
            <Path d="M120 40L152 104L128 96V170H112V96L88 104Z" fill={colors.moss} stroke={colors.ink} strokeWidth={2.5} strokeLinejoin="round" />
          </Svg>
        </Animated.View>
      )}
      <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW} ${VIEW}`} style={StyleSheet.absoluteFill}>
        <Path d="M120 0l-7 10h14z" fill={colors.ink} />
        <Circle cx={120} cy={120} r={9} fill={colors.paper} stroke={colors.ink} strokeWidth={2.5} />
      </Svg>
    </View>
  );
}

const compassUi = StyleSheet.create({
  root: { alignSelf: 'center' },
  letter: { position: 'absolute', width: 28, height: 22, textAlign: 'center' },
});
