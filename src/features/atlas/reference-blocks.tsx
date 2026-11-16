// code-guard: intentional-duplicate - small UI names (section, credit, photo) fuzzy-match other screens; no logic is duplicated.
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Description, ReferencePhoto } from '@/data/reference';
import { atlasStrings } from '@/i18n/atlas';
import { useLang, useStrings } from '@/i18n/i18n';
import { openExternal } from '@/ui/link';
import { RADIUS, SPACE, useTheme } from '@/ui/theme';

/**
 * RESPONSIBILITY: Podpis zdjęcia wzorcowego: autor + licencja, dotknięcie otwiera stronę pliku w Wikimedia Commons
 * INPUTS:         photo: ReferencePhoto
 * OUTPUTS:        link tekstowy ≥ 44 px wysokości
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        external-api (otwiera przeglądarkę na żądanie użytkownika)
 * ERRORS:         none
 */
export function PhotoCredit({ photo }: { photo: ReferencePhoto }) {
  const { colors, type } = useTheme();
  const s = useStrings(atlasStrings);
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={s.photoCreditLabel(photo.author, photo.license)} onPress={() => openExternal(photo.page)} style={blockUi.credit}>
      <Text style={[type.caption, { color: colors.ink2 }]} numberOfLines={2}>
        {s.photoCredit(photo.author, photo.license)}
      </Text>
    </Pressable>
  );
}

/**
 * RESPONSIBILITY: Sekcja „Zdjęcie wzorcowe” na karcie gatunku, gdy polaroid pokazuje już Twoje zdjęcie — do porównania
 * INPUTS:         photo: ReferencePhoto; name: nazwa gatunku do opisu dla czytnika
 * OUTPUTS:        duże zdjęcie (4:3) z podpisem autora i licencji
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function ReferenceSection({ photo, name }: { photo: ReferencePhoto; name: string }) {
  const { colors, type } = useTheme();
  const s = useStrings(atlasStrings);
  return (
    <View style={blockUi.section}>
      <Text style={[type.section, { color: colors.ink }]} accessibilityRole="header">
        {s.referenceSection}
      </Text>
      <Image source={photo.source} style={[blockUi.big, { backgroundColor: colors.panel }]} contentFit="cover" accessibilityLabel={s.referencePhoto(name)} />
      <PhotoCredit photo={photo} />
    </View>
  );
}

/**
 * RESPONSIBILITY: Sekcja „Opis” z polskiej Wikipedii (lub jej tłumaczenie): wstęp, wygląd, siedlisko, gatunki podobne + uznanie autorstwa (CC BY-SA)
 * INPUTS:         d: Description (tekst bez zdań o jadalności; d.lang = język tekstu)
 * OUTPUTS:        nagłówki i akapity; w wersji angielskiej bez tłumaczenia — dopisek „tylko po polsku”; link do cytowanej wersji artykułu
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        external-api (link do Wikipedii otwierany na żądanie)
 * ERRORS:         none
 */
export function DescriptionSection({ d }: { d: Description }) {
  const { colors, type } = useTheme();
  const s = useStrings(atlasStrings);
  const polishOnly = useLang() === 'en' && d.lang === 'pl';
  return (
    <View style={blockUi.section}>
      <Text style={[type.section, { color: colors.ink }]} accessibilityRole="header">
        {s.descriptionSection}
      </Text>
      {polishOnly && <Text style={[type.caption, { color: colors.ink2 }]}>{s.descriptionPolishOnly}</Text>}
      {d.sections.map((sec) => (
        <View key={sec.head || 'lead'} style={blockUi.para}>
          {sec.head ? <Text style={[type.tileTitle, { color: colors.ink }]}>{sec.head}</Text> : null}
          <Text style={[type.body, { color: colors.ink }]}>{sec.text}</Text>
        </View>
      ))}
      <View style={[blockUi.source, { borderColor: colors.line }]}>
        <Text style={[type.caption, { color: colors.ink2 }]}>
          {(d.translated ? s.descriptionSource : s.descriptionSourceOriginal)(d.title, d.license)}
          {d.edibilityRemoved ? s.edibilityRemoved : ''}
        </Text>
        <Pressable accessibilityRole="link" onPress={() => openExternal(d.url)} style={blockUi.credit}>
          <Text style={[type.label, { color: colors.mossText, textDecorationLine: 'underline' }]}>{s.fullArticle}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const blockUi = StyleSheet.create({
  section: { gap: SPACE.s },
  para: { gap: 2 },
  big: { width: '100%', aspectRatio: 4 / 3, borderRadius: RADIUS.card },
  credit: { minHeight: 44, justifyContent: 'center' },
  source: { borderTopWidth: 1, paddingTop: SPACE.s },
});
