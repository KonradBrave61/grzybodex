// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useStrings } from '@/i18n/i18n';
import { recipeStrings } from '@/i18n/recipes';
import { openExternal } from '@/ui/link';
import { FONT } from '@/ui/theme';

import type { Segment } from './logic';
import { Glyph } from './glyphs';
import { useRecipePalette } from './palette';


/**
 * RESPONSIBILITY: Składa akapit z fragmentów cytowania (tytuły kursywą, wyróżnienia pogrubione)
 * INPUTS:         segments: Segment[] (trusted); style: styl akapitu; children?: wstawka przed fragmentami (np. plakietka)
 * OUTPUTS:        element <Text> z zagnieżdżonymi fragmentami
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function Segments({ segments, style, children }: { segments: readonly Segment[]; style: StyleProp<TextStyle>; children?: ReactNode }) {
  return (
    <Text style={style}>
      {children}
      {segments.map((s, i) => (
        <Text key={i} style={s.italic ? parts.italic : s.bold ? parts.bold : undefined}>
          {s.text}
        </Text>
      ))}
    </Text>
  );
}

/**
 * RESPONSIBILITY: Przycisk obrysowany 44 px z ikoną (np. „Jak znaleźć Sanepid”, „Karta gatunku”)
 * INPUTS:         label: string; icon?: ReactNode; onPress: () => void; hint?: opis dla czytnika ekranu
 * OUTPUTS:        Pressable (rola button), wysokość 44 px, przyciśnięcie = lekkie zmniejszenie
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function OutlineButton({ label, icon, onPress, hint }: { label: string; icon?: ReactNode; onPress: () => void; hint?: string }) {
  const { colors, type } = useRecipePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [parts.outline, { borderColor: colors.ink, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
      {icon}
      <Text style={[type.button, { color: colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * RESPONSIBILITY: Link do strony urzędowej (podkreślony tytuł + ikona „otwiera przeglądarkę”), cel dotyku ≥ 44 px
 * INPUTS:         label: string (tytuł strony); url: string (trusted, z danych)
 * OUTPUTS:        Pressable (rola link) otwierający przeglądarkę
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        network (przez openExternal)
 * ERRORS:         jak openExternal
 */
export function ExternalLink({ label, url }: { label: string; url: string }) {
  const { colors, type } = useRecipePalette();
  const s = useStrings(recipeStrings);
  return (
    <Pressable accessibilityRole="link" accessibilityHint={s.ui.opensBrowser} onPress={() => openExternal(url)} style={parts.external}>
      <Text style={[type.button, parts.underline, parts.flexText, { color: colors.ink }]}>{label}</Text>
      <Glyph name="external" size={18} color={colors.ink} />
    </Pressable>
  );
}

/**
 * RESPONSIBILITY: Mały link w podpisie (np. „Skąd to wiemy?”, „Wikimedia Commons”); wizualnie 21 px, dotyk 45 px (hitSlop)
 * INPUTS:         label: string; onPress: () => void; external?: true = otwiera przeglądarkę (rola link); expanded?: stan rozwinięcia
 * OUTPUTS:        Pressable z podkreślonym tekstem w rozmiarze podpisu
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none (akcja w onPress)
 * ERRORS:         none
 */
export function InlineLink({ label, onPress, external, expanded }: { label: string; onPress: () => void; external?: boolean; expanded?: boolean }) {
  const { colors, type } = useRecipePalette();
  const s = useStrings(recipeStrings);
  return (
    <Pressable
      accessibilityRole={external ? 'link' : 'button'}
      accessibilityHint={external ? s.ui.opensBrowser : undefined}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      hitSlop={{ top: 12, bottom: 12, left: 4, right: 4 }}
      onPress={onPress}>
      <Text style={[type.caption, parts.underline, { color: colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * RESPONSIBILITY: Lista punktowana (kropka w 22-px wcięciu jak w projekcie)
 * INPUTS:         items: Segment[][] (każda pozycja to akapit z fragmentów); color: kolor tekstu
 * OUTPUTS:        kolumna wierszy z „•”; czytnik ekranu czyta treść bez kropek
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function Bullets({ items, color }: { items: readonly (readonly Segment[])[]; color: string }) {
  const { type } = useRecipePalette();
  return (
    <View style={parts.bullets}>
      {items.map((segments, i) => (
        <View key={i} style={parts.bulletRow}>
          <Text style={[type.body, parts.bulletDot, { color }]} accessibilityElementsHidden importantForAccessibility="no">
            •
          </Text>
          <Segments segments={segments} style={[type.body, parts.flexText, { color }]} />
        </View>
      ))}
    </View>
  );
}

/**
 * RESPONSIBILITY: Zanik papieru (24 px) przy dolnej krawędzi przewijanej treści — sygnał, że jest więcej
 * INPUTS:         none (kolor papieru z motywu)
 * OUTPUTS:        nakładka SVG, bez obsługi dotyku, ukryta przed czytnikiem ekranu
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function PaperFade() {
  const { colors } = useRecipePalette();
  return (
    <View pointerEvents="none" style={parts.fade} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="recipesPaperFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.paper} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.paper} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#recipesPaperFade)" />
      </Svg>
    </View>
  );
}

const parts = StyleSheet.create({
  italic: { fontFamily: FONT.italic },
  bold: { fontFamily: FONT.semibold },
  underline: { textDecorationLine: 'underline' },
  flexText: { flexShrink: 1 },
  outline: {
    alignSelf: 'flex-start',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 2,
  },
  external: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  bullets: { gap: 2 },
  bulletRow: { flexDirection: 'row' },
  bulletDot: { width: 22 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 24 },
});
