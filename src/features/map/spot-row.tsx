// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { useLang, useStrings } from '@/i18n/i18n';
import { mapStrings } from '@/i18n/map';
import { RADIUS, SPACE, useTheme } from '@/ui/theme';

import { compassWord, distanceMeters, formatDistance, formatShortDate, initialBearing, type LatLon } from './geo';
import { MapGlyph } from './map-glyphs';
import { shownName, type Spot } from './spot-model';
import { deleteSpot } from './spots';

/**
 * RESPONSIBILITY: Rozwinięcie wiersza: „Usuń” → potwierdzenie w interfejsie → usunięcie z lokalnej bazy
 * INPUTS:         spot: Spot; onDeleted(): po udanym usunięciu
 * OUTPUTS:        pasek akcji (wjeżdża 200 ms, bez animacji przy „ogranicz ruch”); przyciski 44 px
 * AUTHN:          none (dane tylko na tym telefonie)
 * AUTHZ:          none
 * TOUCHES:        db (przez deleteSpot)
 * ERRORS:         błąd usuwania → komunikat w wierszu
 */
function RowActions({ spot, onDeleted }: { spot: Spot; onDeleted: () => void }) {
  const { colors, type } = useTheme();
  const s = useStrings(mapStrings);
  const reduced = useReducedMotion();
  const [confirm, setConfirm] = useState(false);
  const [failed, setFailed] = useState(false);
  const show = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) show.set(withTiming(1, { duration: 200 }));
  }, [show, reduced]);
  const reveal = useAnimatedStyle(() => ({ opacity: show.value, transform: [{ translateY: (1 - show.value) * -6 }] }));
  const remove = () => {
    setFailed(false);
    deleteSpot(spot.id).then(onDeleted, () => setFailed(true));
  };

  return (
    <Animated.View style={[rowUi.actions, { borderTopColor: colors.line }, reveal]}>
      {!confirm ? (
        <Pressable accessibilityRole="button" onPress={() => setConfirm(true)} style={[rowUi.smallBtn, { borderColor: colors.maple }]}>
          <MapGlyph glyph="trash" color={colors.maple} />
          <Text style={[type.button, { color: colors.maple }]}>{s.delete}</Text>
        </Pressable>
      ) : (
        <>
          <Text style={[type.body, { color: colors.ink }]} accessibilityLiveRegion="polite">
            {s.confirmDelete(shownName(spot, s.car))}
          </Text>
          <View style={rowUi.confirmRow}>
            <Pressable
              accessibilityRole="button"
              onPress={remove}
              style={[rowUi.smallBtn, rowUi.grow, { backgroundColor: colors.category.deadly.bg, borderColor: colors.category.deadly.bg }]}>
              <Text style={[type.button, { color: colors.category.deadly.fg }]}>{s.yesDelete}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setConfirm(false)} style={[rowUi.smallBtn, rowUi.grow, { borderColor: colors.ink }]}>
              <Text style={[type.button, { color: colors.ink }]}>{s.keep}</Text>
            </Pressable>
          </View>
        </>
      )}
      {failed && <Text style={[type.caption, { color: colors.maple }]}>{s.deleteFailed}</Text>}
    </Animated.View>
  );
}

/**
 * RESPONSIBILITY: Wiersz listy „Moje miejscówki”: numer pinezki, nazwa, notatka · data, odległość i kierunek, przycisk „Prowadź”
 * INPUTS:         spot; n: numer pinezki (null = auto); me: bieżące położenie albo null; expanded; onToggle(); onGuide(); onDeleted()
 * OUTPUTS:        karta; dotknięcie rozwija akcje (usuń z potwierdzeniem) i zaznacza pinezkę na mapie
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        db (pośrednio, przez RowActions)
 * ERRORS:         none
 */
export function SpotRow({ spot, n, me, expanded, onToggle, onGuide, onDeleted }: { spot: Spot; n: number | null; me: LatLon | null; expanded: boolean; onToggle: () => void; onGuide: () => void; onDeleted: () => void }) {
  const { colors, type } = useTheme();
  const s = useStrings(mapStrings);
  const lang = useLang();
  const name = shownName(spot, s.car);
  const bearing = me ? initialBearing(me, spot) : null;
  const subtitle = [spot.note, formatShortDate(spot.createdAt, lang)].filter(Boolean).join(' · ');
  const away = me && bearing !== null ? `${formatDistance(distanceMeters(me, spot), lang)} · ${s.toward(compassWord(bearing, lang))}` : null;

  return (
    <View style={[rowUi.card, { backgroundColor: colors.card, borderColor: expanded ? colors.ink : colors.line }]}>
      <View style={rowUi.main}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityHint={s.rowHint}
          onPress={onToggle}
          style={rowUi.info}>
          <View style={rowUi.titleRow}>
            <View style={[rowUi.badge, { backgroundColor: colors.ink }]}>
              {n !== null ? <Text style={[type.label, { color: colors.paper }]}>{n}</Text> : <MapGlyph glyph="car" size={16} color={colors.paper} />}
            </View>
            <Text style={[type.tileTitle, rowUi.shrink, { color: colors.ink }]} numberOfLines={1}>
              {name}
            </Text>
          </View>
          {subtitle !== '' && (
            <Text style={[type.caption, { color: colors.ink2 }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
          {away && bearing !== null && (
            <View style={rowUi.awayRow}>
              <View style={{ transform: [{ rotate: `${bearing}deg` }] }}>
                <MapGlyph glyph="arrow" size={18} color={colors.ink} strokeWidth={2.2} />
              </View>
              <Text style={[type.caption, { color: colors.ink }]}>{away}</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={s.guideTo(name)}
          onPress={onGuide}
          style={({ pressed }) => [rowUi.guide, { borderColor: colors.ink, backgroundColor: colors.paper, transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
          <Text style={[type.button, { color: colors.ink }]}>{s.guide}</Text>
        </Pressable>
      </View>
      {expanded && <RowActions spot={spot} onDeleted={onDeleted} />}
    </View>
  );
}

const rowUi = StyleSheet.create({
  card: { borderRadius: RADIUS.card, borderWidth: 1, paddingVertical: SPACE.s, paddingHorizontal: SPACE.m },
  main: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m },
  info: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s },
  badge: { width: 22, height: 22, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  shrink: { flexShrink: 1 },
  awayRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  guide: { minHeight: 44, paddingHorizontal: SPACE.l, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  actions: { marginTop: SPACE.s, paddingTop: SPACE.s, borderTopWidth: 1, gap: SPACE.s },
  confirmRow: { flexDirection: 'row', gap: SPACE.s },
  smallBtn: { minHeight: 44, paddingHorizontal: SPACE.l, borderRadius: 10, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.s, alignSelf: 'flex-start' },
  grow: { flex: 1 },
});
