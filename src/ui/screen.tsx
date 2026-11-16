import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStrings } from '@/i18n/i18n';
import { shellStrings } from '@/i18n/shell';

import { Icon } from './icons';
import { LogoMark } from './logo';
import { useTheme } from './theme';

/** Kraft bar height below the system inset (px). */
export const BAR_HEIGHT = 64;

/**
 * RESPONSIBILITY: Pasek kraft u góry ekranu: tło, wcięcie systemowe, przeszyta linia — treść (strzałka, tytuł, akcje) daje rodzic
 * INPUTS:         children: zawartość paska (w rzędzie, rozłożona na boki); style?: dopełnienie układu danego ekranu
 * OUTPUTS:        widok paska; co najmniej BAR_HEIGHT + wcięcie, rośnie przy dużym tekście
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function KraftBar({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[frame.bar, { paddingTop: insets.top, minHeight: BAR_HEIGHT + insets.top, backgroundColor: colors.kraft }, style]}>
      {children}
      <View style={[frame.stitch, { borderColor: colors.barStitch }]} />
    </View>
  );
}

/**
 * RESPONSIBILITY: Pionowa linia marginesu „notatnika” pod paskiem kraft
 * INPUTS:         bottom?: odstęp od dołu ekranu w px (domyślnie 0)
 * OUTPUTS:        widok pozycjonowany absolutnie (lewa krawędź, od dołu paska)
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function MarginLine({ bottom = 0 }: { bottom?: number }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return <View style={[frame.margin, { top: BAR_HEIGHT + insets.top, bottom, backgroundColor: colors.marginLine }]} />;
}

/**
 * RESPONSIBILITY: Szkielet ekranu „notatnika”: pasek kraft z logo i tytułem, linia marginesu, tło papieru
 * INPUTS:         title: string; action?: ReactNode (przycisk po prawej, ≥ 44 px); onBack?: () => void (strzałka zamiast logo);
 *                 withSettings?: zębatka „Ustawienia” po prawej (44×44, otwiera /ustawienia) — dla głównych ekranów (zakładek); children: treść ekranu
 * OUTPUTS:        widok pełnoekranowy; pasek respektuje wcięcie systemowe u góry; długi tytuł zmniejsza się, żeby zmieścić się w pasku
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function NotebookScreen({
  title,
  action,
  onBack,
  withSettings = false,
  children,
}: {
  title: string;
  action?: ReactNode;
  onBack?: () => void;
  withSettings?: boolean;
  children: ReactNode;
}) {
  const { colors, type } = useTheme();
  const s = useStrings(shellStrings);
  return (
    <View style={[frame.root, { backgroundColor: colors.paper }]}>
      <KraftBar style={frame.notebookBar}>
        <View style={frame.titleRow}>
          {onBack ? (
            <Pressable onPress={onBack} style={frame.back} accessibilityRole="button" accessibilityLabel={s.back}>
              <Icon name="back" color={colors.ink} />
            </Pressable>
          ) : (
            <LogoMark />
          )}
          <Text style={[type.screenTitle, frame.title, { color: colors.ink }]} accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>
            {title}
          </Text>
        </View>
        <View style={frame.actions}>
          {action}
          {withSettings && (
            <Pressable onPress={() => router.push('/ustawienia')} style={frame.iconBtn} accessibilityRole="button" accessibilityLabel={s.settings} hitSlop={4}>
              <Icon name="settings" color={colors.ink} />
            </Pressable>
          )}
        </View>
      </KraftBar>
      <MarginLine />
      <View style={frame.body}>{children}</View>
    </View>
  );
}

const frame = StyleSheet.create({
  root: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notebookBar: { paddingLeft: 16, paddingRight: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0 },
  title: { flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  stitch: { position: 'absolute', left: 12, right: 12, bottom: 6, borderTopWidth: 2, borderStyle: 'dashed' },
  margin: { position: 'absolute', left: 11, width: 2 },
  body: { flex: 1 },
});
