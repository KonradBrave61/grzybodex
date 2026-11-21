// code-guard: intentional-duplicate - short UI names (item, section, link) fuzzy-match other screens; no logic is duplicated.
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { creditSections, type CreditItem } from '@/features/credits/credits';
import { creditsStrings } from '@/i18n/credits';
import { useLang, useStrings } from '@/i18n/i18n';
import { openExternal } from '@/ui/link';
import { NotebookScreen } from '@/ui/screen';
import { SPACE, useTheme } from '@/ui/theme';

/**
 * RESPONSIBILITY: Jedna pozycja atrybucji: tytuł, opis (autor, licencja, zmiany) i linki do źródła i licencji
 * INPUTS:         item: CreditItem (dane z paczki, trusted)
 * OUTPUTS:        blok tekstu; pozycja bez linków (biblioteka) to jedna zwarta linia
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        network (openExternal otwiera przeglądarkę po dotknięciu linku)
 * ERRORS:         none (brak przeglądarki → błąd ignorowany w openExternal, ekran działa dalej)
 */
function Credit({ item }: { item: CreditItem }) {
  const { colors, type } = useTheme();
  if (item.links.length === 0) {
    return (
      <Text style={[type.caption, { color: colors.ink2 }]}>
        <Text style={{ color: colors.ink }}>{item.title}</Text> {item.detail}
      </Text>
    );
  }
  return (
    <View style={lic.item}>
      <Text style={[type.tileTitle, { color: colors.ink }]}>{item.title}</Text>
      <Text style={[type.caption, { color: colors.ink2 }]}>{item.detail}</Text>
      <View style={lic.links}>
        {item.links.map((l) => (
          <Pressable key={l.url} onPress={() => openExternal(l.url)} accessibilityRole="link" style={lic.link}>
            <Text style={[type.label, { color: colors.mossText, textDecorationLine: 'underline' }]}>{l.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * RESPONSIBILITY: Ekran „Licencje i autorzy”: atrybucje modelu, zdjęć, danych, czcionek i bibliotek
 * INPUTS:         none (treść z creditSections() w języku aplikacji)
 * OUTPUTS:        przewijana lista sekcji z linkami do źródeł i licencji
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        network (tylko po dotknięciu linku)
 * ERRORS:         none
 */
export default function Licences() {
  const { colors, type } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useStrings(creditsStrings);
  const lang = useLang();
  const sections = useMemo(() => creditSections(lang).map((sec) => ({ ...sec, data: sec.items })), [lang]);
  // SectionList renders only what is on screen: the list has over a thousand rows (one per bundled photo and library).
  return (
    <NotebookScreen title={s.title} onBack={() => router.back()}>
      <SectionList
        sections={sections}
        keyExtractor={(item, i) => `${i}-${item.title}`}
        contentContainerStyle={[lic.page, { paddingBottom: SPACE.xxxl + insets.bottom }]}
        stickySectionHeadersEnabled={false}
        initialNumToRender={12}
        ListHeaderComponent={<Text style={[type.body, { color: colors.ink }]}>{s.intro}</Text>}
        renderSectionHeader={({ section: sec }) => (
          <View style={lic.section}>
            <Text style={[type.section, { color: colors.ink }]} accessibilityRole="header">
              {sec.title}
            </Text>
            {sec.intro && <Text style={[type.caption, { color: colors.ink2 }]}>{sec.intro}</Text>}
          </View>
        )}
        renderItem={({ item }) => <Credit item={item} />}
        ItemSeparatorComponent={Gap}
      />
    </NotebookScreen>
  );
}

function Gap() {
  return <View style={lic.gap} />;
}

const lic = StyleSheet.create({
  page: { paddingLeft: 28, paddingRight: SPACE.xl, paddingTop: SPACE.l },
  section: { gap: SPACE.m, paddingTop: SPACE.xxl, paddingBottom: SPACE.m },
  gap: { height: SPACE.m },
  item: { gap: 2 },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: SPACE.l },
  link: { minHeight: 44, justifyContent: 'center' },
});
