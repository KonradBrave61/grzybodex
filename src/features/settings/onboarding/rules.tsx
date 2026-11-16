// code-guard: intentional-duplicate - moved unchanged from src/app/onboarding/zasady.tsx so the Ustawienia preview shows the same rules; no logic is duplicated.
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useStrings } from '@/i18n/i18n';
import { legalStrings } from '@/i18n/legal';
import { Icon } from '@/ui/icons';
import { FONT, RADIUS, SPACE, useTheme } from '@/ui/theme';

import { Glyph } from './glyphs';

/**
 * RESPONSIBILITY: Karta jednej zasady z tablicy O4: ikona w kafelku 40 px, tytuł i opis; wariant „ważne” z przerywaną czerwoną ramką
 * INPUTS:         icon: ReactNode (gotowa ikona); title; children: opis; important?: wyróżnienie
 * OUTPUTS:        karta ≥ 80 px czytana przez czytnik ekranu jako jeden element (tytuł + opis)
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function RuleCard({ icon, title, children, important = false }: { icon: ReactNode; title: string; children: ReactNode; important?: boolean }) {
  const { colors, type } = useTheme();
  return (
    <View
      accessible
      style={[
        rulesUi.card,
        important
          ? { backgroundColor: `${colors.maple}1A`, borderColor: colors.maple, borderWidth: 2, borderStyle: 'dashed', padding: 11 }
          : { backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, padding: SPACE.m },
      ]}>
      <View style={[rulesUi.iconTile, { backgroundColor: important ? colors.paper : colors.panel }]}>{icon}</View>
      <View style={rulesUi.text}>
        <Text style={[type.tileTitle, { color: colors.ink }]}>{title}</Text>
        <Text style={[type.body, { color: colors.ink2 }]}>{children}</Text>
      </View>
    </View>
  );
}

/**
 * RESPONSIBILITY: Cztery zasady bezpieczeństwa z ekranu O4 (teksty z docs/legal/teksty-w-aplikacji.md §2, po angielsku w i18n/legal.ts) — jedno źródło dla onboardingu i Ustawień
 * INPUTS:         none
 * OUTPUTS:        kolumna 4 kart zasad
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function SafetyRules() {
  const { colors } = useTheme();
  const s = useStrings(legalStrings);
  return (
    <View style={rulesUi.list}>
      <RuleCard important title={s.rule1Title} icon={<Glyph name="noEating" color={colors.maple} />}>
        {s.rule1Body} <Text style={rulesUi.strong}>{s.rule1Strong}</Text>
      </RuleCard>
      <RuleCard title={s.rule2Title} icon={<Glyph name="scanQuestion" color={colors.ink} />}>
        {s.rule2Body}
      </RuleCard>
      <RuleCard title={s.rule3Title} icon={<Icon name="protected" color={colors.ink} strokeWidth={2} />}>
        {s.rule3Body}
      </RuleCard>
      <RuleCard title={s.rule4Title} icon={<Icon name="collection" color={colors.ink} strokeWidth={2} />}>
        {s.rule4Body}
      </RuleCard>
    </View>
  );
}

const rulesUi = StyleSheet.create({
  list: { gap: SPACE.s },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.m, minHeight: 80, borderRadius: RADIUS.card },
  iconTile: { width: 40, height: 40, borderRadius: RADIUS.card, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  strong: { fontFamily: FONT.semibold },
});
