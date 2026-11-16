// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { atlasStrings } from '@/i18n/atlas';
import { useStrings } from '@/i18n/i18n';
import { RADIUS, SPACE, useTheme } from '@/ui/theme';

import type { FeatureFilters } from './filters';

/**
 * RESPONSIBILITY: Grupa przełączników jednej cechy (np. „Spód kapelusza”) w panelu filtrów
 * INPUTS:         title: string; values: string[] (z danych, po polsku); selected: Set<string>; onToggle(v)
 * OUTPUTS:        nagłówek + zawijany rząd przełączników ≥ 44 px (role checkbox); napisy wartości w bieżącym języku
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function ChipGroup({ title, values, selected, onToggle }: { title: string; values: string[]; selected: Set<string>; onToggle: (v: string) => void }) {
  const { colors, type } = useTheme();
  const s = useStrings(atlasStrings);
  return (
    <View style={sheet.group}>
      <Text style={[type.section, { color: colors.ink }]}>{title}</Text>
      <View style={sheet.chips}>
        {values.map((v) => {
          const on = selected.has(v);
          return (
            <Pressable
              key={v}
              onPress={() => onToggle(v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={[sheet.chip, on ? { backgroundColor: colors.ink, borderColor: colors.ink } : { borderColor: colors.outline }]}>
              <Text style={[type.label, { color: on ? colors.paper : colors.ink }]}>{s.feature(v)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * RESPONSIBILITY: Panel filtrów cech atlasu (spód kapelusza, trzon, stan kolekcji) w arkuszu od dołu
 * INPUTS:         visible: boolean; value: FeatureFilters; options: wartości cech z danych; onChange(next); onClose()
 * OUTPUTS:        modal z grupami przełączników; „Wyczyść” zeruje filtry; informacja o źródle i lukach danych
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function FilterSheet({
  visible,
  value,
  options,
  resultCount,
  onChange,
  onClose,
}: {
  visible: boolean;
  value: FeatureFilters;
  options: { underside: string[]; stem: string[] };
  resultCount: number;
  onChange: (next: FeatureFilters) => void;
  onClose: () => void;
}) {
  const { colors, type } = useTheme();
  const s = useStrings(atlasStrings);
  const toggle = (key: 'underside' | 'stem') => (v: string) => {
    const next = new Set(value[key]);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange({ ...value, [key]: next });
  };
  const scannedOpts: { key: FeatureFilters['scanned']; label: string }[] = [
    { key: 'all', label: s.scannedAll },
    { key: 'yes', label: s.scannedYes },
    { key: 'no', label: s.scannedNo },
  ];
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={sheet.backdrop}>
        <View style={[sheet.panel, { backgroundColor: colors.paper }]}>
          <View style={sheet.head}>
            <Text style={[type.cardTitle, { color: colors.ink }]}>{s.filters}</Text>
            <Pressable onPress={() => onChange({ underside: new Set(), stem: new Set(), scanned: 'all' })} accessibilityRole="button" style={sheet.link}>
              <Text style={[type.button, { color: colors.mossText, textDecorationLine: 'underline' }]}>{s.clear}</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={sheet.body}>
            <ChipGroup title={s.underside} values={options.underside} selected={value.underside} onToggle={toggle('underside')} />
            <ChipGroup title={s.stem} values={options.stem} selected={value.stem} onToggle={toggle('stem')} />
            <Text style={[type.caption, { color: colors.ink2 }]}>{s.volvaNote}</Text>
            <View style={sheet.group}>
              <Text style={[type.section, { color: colors.ink }]}>{s.collection}</Text>
              <View style={sheet.chips}>
                {scannedOpts.map((o) => (
                  <Pressable
                    key={o.key}
                    onPress={() => onChange({ ...value, scanned: o.key })}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: value.scanned === o.key }}
                    style={[sheet.chip, value.scanned === o.key ? { backgroundColor: colors.ink, borderColor: colors.ink } : { borderColor: colors.outline }]}>
                    <Text style={[type.label, { color: value.scanned === o.key ? colors.paper : colors.ink }]}>{o.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <Text style={[type.caption, { color: colors.ink2 }]}>{s.featuresNote}</Text>
          </ScrollView>
          <Pressable onPress={onClose} style={[sheet.apply, { backgroundColor: colors.moss }]} accessibilityRole="button">
            <Text style={[type.button, { color: '#FBF5E6' }]}>{s.showResults(resultCount)}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const sheet = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  panel: { maxHeight: '88%', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { minHeight: 44, justifyContent: 'center' },
  body: { gap: SPACE.l, paddingBottom: 8 },
  group: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 12, borderRadius: RADIUS.chip, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  apply: { minHeight: 52, borderRadius: RADIUS.card, alignItems: 'center', justifyContent: 'center' },
});
