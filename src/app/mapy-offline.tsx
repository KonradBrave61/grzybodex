// code-guard: intentional-duplicate - section/list UI names fuzzy-match ustawienia.tsx; download logic lives in features/map/offline.
import { Paths } from 'expo-file-system';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMyLocation } from '@/features/map/location';
import { AreaPicker } from '@/features/map/offline/area-picker';
import { formatBytes, OVERVIEW_BYTES } from '@/features/map/offline/catalog';
import { PackCard } from '@/features/map/offline/pack-card';
import { getPackManager, usePackStates } from '@/features/map/offline/pack-store';
import { voivodeshipAt } from '@/features/map/offline/region-detect';
import { RegionChips } from '@/features/settings/onboarding/region-chip';
import { useSettings } from '@/features/settings/settings';
import { VOIVODESHIPS } from '@/features/settings/voivodeships';
import { useLang, useStrings } from '@/i18n/i18n';
import { mapStrings } from '@/i18n/map';
import { NotebookScreen } from '@/ui/screen';
import { RADIUS, SPACE, useTheme } from '@/ui/theme';

function voivodeshipName(id: string): string {
  return VOIVODESHIPS.find((v) => v.id === id)?.name ?? id;
}

/**
 * RESPONSIBILITY: Ekran „Mapy offline”: województwo z GPS na górze, moje regiony (zmiana w miejscu), reszta województw;
 *                 pobieranie map w dwóch dokładnościach z postępem, wstrzymaniem, wznowieniem, anulowaniem i usuwaniem; zajęte/wolne miejsce
 * INPUTS:         none (położenie z useMyLocation, regiony z ustawień, stan paczek z PackManager)
 * OUTPUTS:        przewijany ekran kart województw
 * AUTHN:          none (aplikacja bez kont)
 * AUTHZ:          none
 * TOUCHES:        filesystem, external-api (pobieranie paczek map), db (stan paczek i regionów w kv-store)
 * ERRORS:         błędy pobierania pokazuje karta województwa; brak GPS → bez sekcji „Tu jesteś”
 */
export default function OfflineMapsScreen() {
  const { colors, type } = useTheme();
  const insets = useSafeAreaInsets();
  const states = usePackStates();
  const { regions } = useSettings();
  const location = useMyLocation();
  const here = location.status === 'gps' || location.status === 'steps' ? voivodeshipAt(location.fix) : null;
  const mine = regions.filter((r) => r !== here);
  const rest = VOIVODESHIPS.filter((v) => v.id !== here && !mine.includes(v.id));
  const used = getPackManager().usedBytes();
  const s = useStrings(mapStrings);
  const lang = useLang();

  return (
    <NotebookScreen title={s.offlineTitle} onBack={() => router.back()}>
      <ScrollView contentContainerStyle={[pageUi.page, { paddingBottom: SPACE.xxxl + insets.bottom }]}>
        <View style={[pageUi.intro, { backgroundColor: colors.panel }]}>
          <Text style={[type.body, { color: colors.ink }]}>
            {s.offlineIntro(formatBytes(OVERVIEW_BYTES, false, lang))}
          </Text>
          <Text style={[type.caption, { color: colors.ink2 }]}>{s.offlineIntroHint}</Text>
          <Text style={[type.label, { color: colors.ink }]}>{s.offlineUsage(formatBytes(used, false, lang), formatBytes(Paths.availableDiskSpace, false, lang))}</Text>
        </View>

        <AreaPicker states={states} />

        <View style={pageUi.section}>
          <Text style={[type.section, { color: colors.ink }]} accessibilityRole="header">
            {s.here}
          </Text>
          {here ? (
            <PackCard id={here} name={voivodeshipName(here)} states={states} badge={s.here} />
          ) : (
            <Text style={[type.caption, { color: colors.ink2 }]}>
              {location.status === 'searching' ? s.searching : s.hereUnknown}
            </Text>
          )}
        </View>

        <View style={pageUi.section}>
          <Text style={[type.section, { color: colors.ink }]} accessibilityRole="header">
            {s.myRegions}
          </Text>
          <Text style={[type.caption, { color: colors.ink2 }]}>{s.myRegionsHint}</Text>
          <RegionChips regions={regions} />
          {mine.map((id) => (
            <PackCard key={id} id={id} name={voivodeshipName(id)} states={states} badge={s.myRegion} />
          ))}
        </View>

        <View style={pageUi.section}>
          <Text style={[type.section, { color: colors.ink }]} accessibilityRole="header">
            {s.otherVoivodeships}
          </Text>
          {rest.map((v) => (
            <PackCard key={v.id} id={v.id} name={v.name} states={states} />
          ))}
        </View>

        <Text style={[type.caption, { color: colors.ink2 }]}>{s.offlineCredit}</Text>
      </ScrollView>
    </NotebookScreen>
  );
}

const pageUi = StyleSheet.create({
  page: { paddingLeft: 28, paddingRight: SPACE.xl, paddingTop: SPACE.l, gap: SPACE.xxl },
  intro: { borderRadius: RADIUS.card, padding: SPACE.l, gap: SPACE.s },
  section: { gap: SPACE.m },
});
