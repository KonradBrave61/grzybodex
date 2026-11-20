// code-guard: intentional-duplicate - local variable names in UI components fuzzy-match other files; no logic is duplicated.
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStrings } from '@/i18n/i18n';
import { shellStrings } from '@/i18n/shell';

import { Icon, type IconName } from './icons';
import { useTheme } from './theme';

type ShellKey = keyof (typeof shellStrings)['pl'];

const TABS: Record<string, { label: ShellKey; icon: IconName }> = {
  index: { label: 'tabAtlas', icon: 'atlas' },
  mapa: { label: 'tabMap', icon: 'map' },
  kolekcja: { label: 'tabCollection', icon: 'collection' },
  quiz: { label: 'tabQuiz', icon: 'quiz' },
};

function Indicator({ active, color }: { active: boolean; color: string }) {
  const reduced = useReducedMotion();
  const grow = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    grow.set(reduced ? (active ? 1 : 0) : withTiming(active ? 1 : 0, { duration: 220 }));
  }, [active, reduced, grow]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scaleX: grow.value }], opacity: grow.value }));
  return <Animated.View style={[bar.indicator, { backgroundColor: color }, animated]} />;
}

/**
 * RESPONSIBILITY: Dolne menu w stylu notatnika: zakładki w dwóch równych połówkach + środkowy przycisk „Skanuj” (zawsze na środku)
 * INPUTS:         BottomTabBarProps z expo-router (stan i nawigacja zakładek, trusted)
 * OUTPUTS:        pasek kraft 80 px + wcięcie systemowe; aktywna zakładka = kreska 20×3 (animowana, bez zmiany grubości)
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none (nawigacja)
 * ERRORS:         none
 */
export function NotebookTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const { colors, isDark, type } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useStrings(shellStrings);
  const ink = isDark ? colors.ink : '#2E2A24';
  const items = state.routes.filter((r) => TABS[r.name]);
  const half = Math.ceil(items.length / 2);
  const renderTab = (route: (typeof items)[number]) => {
    const meta = TABS[route.name];
    const focused = state.routes[state.index]?.key === route.key;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={s[meta.label]}
        onPress={() => !focused && navigateToTab(route.key)}
        style={bar.item}>
        <Icon name={meta.icon} color={ink} strokeWidth={focused ? 2 : 1.8} />
        <Text style={[type.label, { color: ink }]}>{s[meta.label]}</Text>
        <Indicator active={focused} color={ink} />
      </Pressable>
    );
  };
  return (
    <View style={[bar.root, { height: 80 + insets.bottom, paddingBottom: insets.bottom, backgroundColor: isDark ? colors.kraft : '#C9A574' }]}>
      <View style={bar.half}>{items.slice(0, half).map(renderTab)}</View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={s.scan}
        onPress={() => router.push('/skan')}
        style={({ pressed }) => [bar.scan, { backgroundColor: colors.moss, borderColor: colors.paper, transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
        <Icon name="camera" size={28} color="#FBF5E6" />
      </Pressable>
      <View style={bar.half}>{items.slice(half).map(renderTab)}</View>
    </View>
  );
}

const bar = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  half: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  item: { flex: 1, minWidth: 0, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2 },
  indicator: { width: 20, height: 3, borderRadius: 2 },
  scan: { width: 64, height: 64, marginTop: -28, borderRadius: 999, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
});
