// code-guard: intentional-duplicate - moved unchanged from src/app/onboarding/region.tsx so the Ustawienia screen can reuse it; no logic is duplicated.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { updateSettings } from '@/features/settings/settings';
import { VOIVODESHIPS, type VoivodeshipId } from '@/features/settings/voivodeships';
import { Icon } from '@/ui/icons';
import { RADIUS, SPACE, useTheme } from '@/ui/theme';

/**
 * RESPONSIBILITY: Chip województwa (36 px widoczne, 44 px pola dotyku) — zaznaczony: ciemne tło i ptaszek SVG
 * INPUTS:         name: oficjalna nazwa; selected; onPress
 * OUTPUTS:        Pressable z rolą checkbox i stanem checked dla czytnika ekranu
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function RegionChip({ name, selected, onPress }: { name: string; selected: boolean; onPress: () => void }) {
  const { colors, type } = useTheme();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={name} onPress={onPress} style={regionChipUi.hit}>
      <View style={[regionChipUi.chip, selected ? { backgroundColor: colors.ink, borderColor: colors.ink } : { borderColor: colors.ink2 }]}>
        {selected && <Icon name="check" size={14} color={colors.paper} strokeWidth={3} />}
        <Text style={[type.label, { color: selected ? colors.paper : colors.ink }]}>{name}</Text>
      </View>
    </Pressable>
  );
}

/**
 * RESPONSIBILITY: Wszystkie 16 województw jako chipy; dotknięcie dodaje/usuwa województwo i od razu zapisuje ustawienia
 * INPUTS:         regions: aktualnie wybrane województwa (z useSettings)
 * OUTPUTS:        zawijany rząd chipów w oficjalnej kolejności
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        db (zapis listy województw w kv-store przez updateSettings)
 * ERRORS:         none (błąd zapisu obsługuje magazyn ustawień)
 */
export function RegionChips({ regions }: { regions: readonly VoivodeshipId[] }) {
  const toggle = (id: VoivodeshipId) => {
    updateSettings({ regions: regions.includes(id) ? regions.filter((r) => r !== id) : [...regions, id] });
  };
  return (
    <View style={regionChipUi.chips}>
      {VOIVODESHIPS.map((v) => (
        <RegionChip key={v.id} name={v.name} selected={regions.includes(v.id)} onPress={() => toggle(v.id)} />
      ))}
    </View>
  );
}

const regionChipUi = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: SPACE.s },
  hit: { paddingVertical: SPACE.xs },
  chip: { minHeight: 36, paddingHorizontal: SPACE.m, borderRadius: RADIUS.chip, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
