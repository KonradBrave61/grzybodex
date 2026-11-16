// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import type { Species } from '@/data/atlas';
import { collectionStrings } from '@/i18n/collection';
import { locale, useLang, useStrings } from '@/i18n/i18n';
import { CategoryChip } from '@/ui/category-chip';
import { useTheme } from '@/ui/theme';

/** Deterministic small tilt per card so the grid looks hand-made but stays stable between renders. */
const tiltOf = (id: number) => (((id * 37) % 5) - 2) * 0.75;

/**
 * RESPONSIBILITY: Karteczka okazu w kolekcji (zdjęcie, taśma, nazwa, data, kategoria); nowy wpis „przykleja się” animacją
 * INPUTS:         id: number (wiersz bazy); photoUri: string (plik w katalogu aplikacji); name, latin: string; createdAt: Date;
 *                 species: Species | null; fresh: boolean — true tylko dla właśnie zapisanego skanu
 * OUTPUTS:        karta; fresh → spadek z góry z obrotem i sprężyną (~450 ms), potem taśma doklejana (scaleX 0→1, 180 ms);
 *                 przy „ogranicz ruch” — bez animacji
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        files (odczyt zdjęcia)
 * ERRORS:         none (brak pliku → szare tło zamiast zdjęcia)
 */
export function StickyNote({ id, photoUri, name, latin, createdAt, species, fresh }: { id: number; photoUri: string; name: string; latin: string; createdAt: Date; species: Species | null; fresh: boolean }) {
  const { colors, type } = useTheme();
  const t = useStrings(collectionStrings);
  const date = createdAt.toLocaleDateString(locale(useLang()));
  const reduced = useReducedMotion();
  const tilt = tiltOf(id);
  const animate = fresh && !reduced;
  const drop = useSharedValue(animate ? 0 : 1);
  const tape = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (!animate) return;
    drop.set(withSpring(1, { damping: 13, stiffness: 140, mass: 0.9 }));
    tape.set(withDelay(380, withTiming(1, { duration: 180 })));
  }, [animate, drop, tape]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, drop.value * 1.6),
    transform: [{ translateY: (1 - drop.value) * -140 }, { rotate: `${tilt + (1 - drop.value) * -9}deg` }, { scale: 1 + (1 - drop.value) * 0.08 }],
  }));
  const tapeStyle = useAnimatedStyle(() => ({ opacity: 0.75 * tape.value, transform: [{ rotate: `${tilt * 2}deg` }, { scaleX: tape.value }] }));

  return (
    <Animated.View style={[note.card, { backgroundColor: colors.card, borderColor: colors.line }, cardStyle]} accessibilityLabel={`${name}, ${date}`}>
      <Image source={{ uri: photoUri }} style={[note.photo, { backgroundColor: colors.panel }]} contentFit="cover" accessibilityLabel={t.yourPhoto(name)} />
      <Animated.View style={[note.tape, { backgroundColor: colors.mustard }, tapeStyle]} />
      <Text style={[type.tileTitle, note.name, { color: colors.ink }]} numberOfLines={2}>
        {name}
      </Text>
      {name !== latin && (
        <Text style={[type.latin, { color: colors.ink2 }]} numberOfLines={1}>
          {latin}
        </Text>
      )}
      <Text style={[type.caption, { color: colors.ink2 }]}>{t.found(date)}</Text>
      {species && (
        <View style={note.chip}>
          <CategoryChip raw={species.category} protectedSpecies={species.protected} conflict={species.conflict?.category} />
        </View>
      )}
    </Animated.View>
  );
}

const note = StyleSheet.create({
  card: { flex: 1, padding: 8, paddingBottom: 12, borderRadius: 4, borderWidth: 1, gap: 4, elevation: 3, shadowColor: '#2E2A24', shadowOpacity: 0.16, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  photo: { width: '100%', height: 92, borderRadius: 2 },
  tape: { position: 'absolute', alignSelf: 'center', top: -4, width: 44, height: 12 },
  name: { marginTop: 4, minHeight: 50 },
  chip: { marginTop: 4 },
});
