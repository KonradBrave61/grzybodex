// code-guard: intentional-duplicate - imported type names are flagged as new identifiers; nothing is redefined here.
import { StyleSheet, Text, View } from 'react-native';

import { displayCategory, type RawCategory } from '@/data/atlas';
import { useLang, useStrings } from '@/i18n/i18n';
import { shellStrings } from '@/i18n/shell';

import { Icon } from './icons';
import { useTheme } from './theme';

/**
 * RESPONSIBILITY: Znaczek kategorii gatunku (ikona + napis + kolor); źródła nieurzędowe w wersji z przerywaną ramką
 * INPUTS:         raw: RawCategory (trusted, z atlasu); protectedSpecies?: boolean — znaczek „Chroniony”; etykieta kategorii w języku aplikacji (displayCategory);
 *                 conflict?: RawCategory — groźniejsza kategoria z innego źródła (np. lista MZ vs zgłoszone zatrucia)
 * OUTPUTS:        rząd 1–3 znaczków; kategoria czytelna bez koloru (ikona + napis)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function CategoryChip({ raw, protectedSpecies = false, conflict }: { raw: RawCategory; protectedSpecies?: boolean; conflict?: RawCategory | null }) {
  const { colors, type } = useTheme();
  const s = useStrings(shellStrings);
  const cat = displayCategory(raw, useLang());
  const tone = colors.category[cat.key];
  const unofficialEdible = raw === 'edible_wiki';
  const deadly = cat.key === 'deadly';
  const warn = conflict === 'deadly' || conflict === 'poisonous' ? colors.category[conflict] : null;
  return (
    <View style={chip.row}>
      <View
        style={[
          chip.box,
          unofficialEdible
            ? { backgroundColor: '#DCEFD6', borderWidth: 1, borderStyle: 'dashed', borderColor: '#2F4A22' }
            : { backgroundColor: tone.bg, borderWidth: deadly ? 2 : 0, borderColor: colors.hazardA },
        ]}>
        <Icon name={cat.key} size={16} color={unofficialEdible ? '#0F2E12' : tone.fg} strokeWidth={2} />
        <Text style={[type.label, chip.text, { color: unofficialEdible ? '#0F2E12' : tone.fg }]}>{cat.label}</Text>
      </View>
      {warn && (
        <View style={[chip.box, { backgroundColor: warn.bg }]}>
          <Icon name="poisonous" size={16} color={warn.fg} strokeWidth={2} />
          <Text style={[type.label, chip.text, { color: warn.fg }]}>{s.poisoningsReported}</Text>
        </View>
      )}
      {protectedSpecies && (
        <View style={[chip.box, { backgroundColor: colors.category.protected.bg }]}>
          <Icon name="protected" size={16} color={colors.category.protected.fg} strokeWidth={2} />
          <Text style={[type.label, chip.text, { color: colors.category.protected.fg }]}>{s.protectedSpecies}</Text>
        </View>
      )}
    </View>
  );
}

const chip = StyleSheet.create({
  text: { flexShrink: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, maxWidth: '100%' },
  box: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%', minHeight: 24, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
});
