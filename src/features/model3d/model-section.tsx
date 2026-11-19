// code-guard: intentional-duplicate - local UI names (section, chip, caption) fuzzy-match other components; no logic is duplicated.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { model3dStrings } from '@/i18n/model3d';
import { useStrings } from '@/i18n/i18n';
import { RADIUS, SPACE, useTheme } from '@/ui/theme';

import { type Focus, Mushroom3D } from './mushroom-3d';

const PARTS: Focus[] = ['all', 'cap', 'warts', 'gills', 'ring', 'stem', 'bulb'];

/**
 * RESPONSIBILITY: Sekcja „Model 3D” na karcie gatunku: obracany model i przyciski cech, które przenoszą kamerę i podświetlają część
 * INPUTS:         name: nazwa gatunku do opisu dla czytnika ekranu
 * OUTPUTS:        nagłówek, widok 3D, rząd przycisków cech, opis wybranej cechy i źródło
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        GPU (przez Mushroom3D)
 * ERRORS:         none (błąd GL obsługuje Mushroom3D)
 */
export function ModelSection({ name }: { name: string }) {
  const { colors, type } = useTheme();
  const s = useStrings(model3dStrings);
  const [focus, setFocus] = useState<Focus>('all');
  return (
    <View style={ui.section}>
      <Text style={[type.section, { color: colors.ink }]} accessibilityRole="header">
        {s.title}
      </Text>
      <View style={[ui.frame, { borderColor: colors.line }]}>
        <Mushroom3D height={300} background={colors.card} focus={focus} accessibilityLabel={s.a11y(name)} />
      </View>
      <Text style={[type.caption, { color: colors.ink2 }]}>{s.drag}</Text>
      <View style={ui.chips}>
        {PARTS.map((p) => {
          const on = p === focus;
          return (
            <Pressable
              key={p}
              onPress={() => setFocus(p)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[ui.chip, { backgroundColor: on ? colors.ink : colors.panel, borderColor: on ? colors.ink : colors.line }]}>
              <Text style={[type.label, { color: on ? colors.paper : colors.ink }]}>{s[p]}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[type.body, { color: colors.ink }]} accessibilityLiveRegion="polite">
        {s.about[focus]}
      </Text>
      <Text style={[type.caption, { color: colors.ink2 }]}>{s.source}</Text>
    </View>
  );
}

const ui = StyleSheet.create({
  section: { gap: 8 },
  frame: { borderWidth: 1, borderRadius: RADIUS.card, overflow: 'hidden' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s },
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: RADIUS.chip, borderWidth: 1, justifyContent: 'center' },
});
