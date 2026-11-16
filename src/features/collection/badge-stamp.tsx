// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { collectionStrings } from '@/i18n/collection';
import { locale, useLang, useStrings } from '@/i18n/i18n';
import { Icon } from '@/ui/icons';
import { useTheme } from '@/ui/theme';

import type { BadgeState } from './badges';

const TONES: Record<BadgeState['tone'], { ring: string; bg: string; fg: string }> = {
  bolete: { ring: '#8B4A22', bg: '#F3E1D3', fg: '#8B4A22' },
  gold: { ring: '#A8701A', bg: '#F6E7C4', fg: '#8A5A12' },
  blue: { ring: '#3D6C99', bg: '#DCE7F2', fg: '#2F5A80' },
  moss: { ring: '#3E5A2A', bg: '#E3EDD5', fg: '#3E5A2A' },
  plum: { ring: '#6E3A55', bg: '#F0E1E9', fg: '#6E3A55' },
};
const tiltOf = (id: string) => ((id.length * 7) % 13) - 6;
/** The stamp falls for this long, accelerating, before it hits the paper. */
const DROP_MS = 190;
/** In the toast the stamp starts falling once the card has settled. */
const TOAST_STAMP_DELAY = 260;

/**
 * RESPONSIBILITY: Krążek pieczątki zdobytej odznaki; przy `animate` — „przybicie”: spada z góry z przyspieszeniem,
 *                 przy uderzeniu lekko się spłaszcza i rozchodzi się od niego ślad tuszu
 * INPUTS:         badge: BadgeState (trusted); size: średnica w px; animate: boolean; delay: ms przed spadaniem
 * OUTPUTS:        krążek size×size; bez animacji od razu w pozycji końcowej
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function StampDisc({ badge, size, animate, delay }: { badge: BadgeState; size: number; animate: boolean; delay: number }) {
  const tone = TONES[badge.tone];
  const tilt = tiltOf(badge.id);
  const drop = useSharedValue(animate ? 0 : 1); // 0 = in the air, 1 = on the paper
  const squash = useSharedValue(1);
  const ink = useSharedValue(animate ? 0 : 1); // ink ring spread after the hit

  useEffect(() => {
    if (!animate) return;
    drop.set(withDelay(delay, withTiming(1, { duration: DROP_MS, easing: Easing.in(Easing.quad) })));
    squash.set(withDelay(delay + DROP_MS, withSequence(withTiming(0.9, { duration: 60 }), withTiming(1, { duration: 220, easing: Easing.out(Easing.back(2.2)) }))));
    ink.set(withDelay(delay + DROP_MS, withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) })));
  }, [animate, delay, drop, squash, ink]);

  const discStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, drop.value * 3),
    transform: [{ scale: (1 + (1 - drop.value) * 1.3) * squash.value }, { rotate: `${tilt - (1 - drop.value) * 16}deg` }],
  }));
  const inkStyle = useAnimatedStyle(() => ({
    opacity: ink.value > 0 && ink.value < 1 ? 0.5 * (1 - ink.value) : 0,
    transform: [{ scale: 1 + ink.value * 0.55 }],
  }));

  const ring = { width: size, height: size, borderColor: tone.ring };
  const inner = size * 0.8;
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[stampUi.ring, ring, stampUi.ink, inkStyle]} />
      <Animated.View style={[stampUi.ring, ring, { backgroundColor: tone.bg }, discStyle]}>
        <View style={[stampUi.inner, { width: inner, height: inner, borderColor: tone.ring }]}>
          <Icon name="check" size={Math.round(size * 0.38)} color={tone.fg} strokeWidth={2.4} />
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * RESPONSIBILITY: Pieczątka odznaki w siatce: zdobyta = kolorowy stempel pod kątem, niezdobyta = szary przerywany krąg z postępem
 * INPUTS:         badge: BadgeState (trusted, z computeBadges); stamp: boolean — true, gdy odznakę właśnie zdobyto
 * OUTPUTS:        stempel 68 px + tytuł + data/postęp; stamp → „przybicie” (~450 ms); przy „ogranicz ruch” — bez animacji
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function BadgeStamp({ badge, stamp }: { badge: BadgeState; stamp: boolean }) {
  const { colors, type } = useTheme();
  const t = useStrings(collectionStrings);
  const lang = useLang();
  const reduced = useReducedMotion();
  return (
    <View style={stampUi.cell} accessibilityLabel={`${badge.title}: ${badge.done ? t.earned : badge.progress}`}>
      {badge.done ? (
        <StampDisc badge={badge} size={68} animate={stamp && !reduced} delay={120} />
      ) : (
        <View style={[stampUi.ring, stampUi.locked, { borderColor: '#B8AA90', backgroundColor: colors.panel }]}>
          <Icon name="collection" size={24} color="#8C8170" />
        </View>
      )}
      <Text style={[type.tileTitle, stampUi.title, { color: colors.ink }]} numberOfLines={2}>
        {badge.title}
      </Text>
      <Text style={[type.caption, { color: colors.ink2 }]}>{badge.done && badge.earnedAt ? badge.earnedAt.toLocaleDateString(locale(lang)) : badge.progress}</Text>
    </View>
  );
}

/**
 * RESPONSIBILITY: Dymek „Nowa odznaka” nad ekranem Kolekcji: karta wjeżdża, pieczątka zostaje przybita, karta lekko drga
 * INPUTS:         badge: BadgeState (trusted, właśnie zdobyta); onClose: () => void — dotknięcie w dowolnym miejscu zamyka
 * OUTPUTS:        półprzezroczyste tło na cały ekran + karta 240 px z pieczątką 104 px i nazwą odznaki;
 *                 przy „ogranicz ruch” — bez animacji
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function BadgeToast({ badge, onClose }: { badge: BadgeState; onClose: () => void }) {
  const { colors, type } = useTheme();
  const t = useStrings(collectionStrings);
  const reduced = useReducedMotion();
  const jolt = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    jolt.set(withDelay(TOAST_STAMP_DELAY + DROP_MS, withSequence(withTiming(5, { duration: 50 }), withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) }))));
  }, [reduced, jolt]);
  const joltStyle = useAnimatedStyle(() => ({ transform: [{ translateY: jolt.value }] }));

  return (
    <Animated.View entering={reduced ? undefined : FadeIn.duration(200)} exiting={reduced ? undefined : FadeOut.duration(220)} style={stampUi.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.closeToastA11y} />
      <Animated.View entering={reduced ? undefined : FadeInDown.duration(260)} pointerEvents="none">
        <Animated.View
          style={[stampUi.card, { backgroundColor: colors.paper, borderColor: colors.ink }, joltStyle]}
          accessibilityRole="alert"
          accessibilityLabel={t.newBadgeA11y(badge.title)}>
          <Text style={[type.label, { color: colors.ink2 }]}>{t.newBadge}</Text>
          <StampDisc badge={badge} size={104} animate={!reduced} delay={TOAST_STAMP_DELAY} />
          <Animated.Text
            entering={reduced ? undefined : FadeIn.delay(TOAST_STAMP_DELAY + DROP_MS + 80).duration(260)}
            style={[type.cardTitle, stampUi.toastTitle, { color: colors.ink }]}
            numberOfLines={2}>
            {badge.title}
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const stampUi = StyleSheet.create({
  cell: { flex: 1, alignItems: 'center', gap: 4 },
  ring: { width: 68, height: 68, borderRadius: 999, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  ink: { position: 'absolute', left: 0, top: 0 },
  inner: { borderRadius: 999, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  locked: { borderStyle: 'dashed' },
  title: { textAlign: 'center', minHeight: 50 },
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(30,26,21,0.35)' },
  card: { width: 240, paddingTop: 16, paddingBottom: 20, paddingHorizontal: 16, borderRadius: 16, borderWidth: 2, alignItems: 'center', gap: 14 },
  toastTitle: { textAlign: 'center' },
});
