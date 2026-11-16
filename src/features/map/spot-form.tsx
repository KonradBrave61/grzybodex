// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useLang, useStrings } from '@/i18n/i18n';
import { mapStrings } from '@/i18n/map';
import { RADIUS, SPACE, useTheme } from '@/ui/theme';

import { formatCoordinates } from './geo';
import type { MyLocation } from './location';
import { MapGlyph } from './map-glyphs';
import { NAME_MAX, NOTE_MAX, type SpotKind, validateSpot } from './spot-model';
import { addSpot } from './spots';

/**
 * RESPONSIBILITY: Formularz „Zapisz to miejsce”: rodzaj (miejscówka/auto), nazwa, notatka; zapis w bieżącym położeniu (GPS lub demo)
 * INPUTS:         location: MyLocation (bez położenia zapis jest zablokowany); initialKind; hasCar (ostrzeżenie o zastąpieniu auta);
 *                 onSaved(id), onCancel() — tekst z pól to dane od użytkownika, walidowane w validateSpot
 * OUTPUTS:        karta z polami (cele dotyku ≥ 44 px); po zapisie wywołuje onSaved
 * AUTHN:          none (dane tylko na tym telefonie)
 * AUTHZ:          none
 * TOUCHES:        db (przez addSpot)
 * ERRORS:         błąd walidacji lub zapisu → komunikat pod polami, formularz zostaje otwarty
 */
export function SpotForm({ location, initialKind, hasCar, onSaved, onCancel }: { location: MyLocation; initialKind: SpotKind; hasCar: boolean; onSaved: (id: number) => void; onCancel: () => void }) {
  const { colors, type } = useTheme();
  const s = useStrings(mapStrings);
  const lang = useLang();
  const [kind, setKind] = useState<SpotKind>(initialKind);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fix = location.fix;
  const where = !fix
    ? s.whereSearching
    : location.status === 'demo'
      ? s.whereDemo
      : location.status === 'steps'
        ? s.whereSteps(fix.accuracy)
        : s.whereGps(formatCoordinates(fix, lang), fix.accuracy !== null ? Math.round(fix.accuracy) : null);

  const save = async () => {
    if (!fix || saving) return;
    const checked = validateSpot({ name, note, kind, latitude: fix.latitude, longitude: fix.longitude });
    if (!checked.ok) return setError(s.spotError(checked.error));
    setSaving(true);
    try {
      onSaved(await addSpot(checked.value));
    } catch {
      setError(s.saveFailed);
      setSaving(false);
    }
  };
  const field = [formUi.input, type.body, { color: colors.ink, backgroundColor: colors.card, borderColor: colors.line }];
  const kindButton = (k: SpotKind, label: string) => {
    const on = kind === k;
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: on }}
        onPress={() => setKind(k)}
        style={[formUi.kind, { backgroundColor: on ? colors.ink : 'transparent' }]}>
        <MapGlyph glyph={k === 'car' ? 'car' : 'basket'} color={on ? colors.paper : colors.ink} />
        <Text style={[type.button, { color: on ? colors.paper : colors.ink }]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[formUi.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
      <Text style={[type.section, { color: colors.ink }]} accessibilityRole="header">
        {s.newPlace}
      </Text>
      <View accessibilityRole="radiogroup" style={[formUi.kinds, { borderColor: colors.ink, backgroundColor: colors.paper }]}>
        {kindButton('spot', s.kindSpot)}
        {kindButton('car', s.car)}
      </View>
      <Text style={[type.label, { color: colors.ink2 }]}>{s.nameLabel}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        maxLength={NAME_MAX}
        placeholder={kind === 'car' ? s.car : s.namePlaceholder}
        placeholderTextColor={colors.ink2}
        accessibilityLabel={s.nameA11y}
        style={field}
      />
      <Text style={[type.label, { color: colors.ink2 }]}>{s.noteLabel}</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        maxLength={NOTE_MAX}
        placeholder={kind === 'car' ? s.notePlaceholderCar : s.notePlaceholderSpot}
        placeholderTextColor={colors.ink2}
        accessibilityLabel={s.noteA11y}
        style={field}
      />
      <Text style={[type.caption, { color: location.status === 'demo' || location.status === 'steps' ? colors.maple : colors.ink2 }]}>{where}</Text>
      {kind === 'car' && hasCar && <Text style={[type.caption, { color: colors.ink2 }]}>{s.carReplaced}</Text>}
      {error && (
        <Text style={[type.caption, { color: colors.maple }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
      <View style={formUi.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !fix || saving }}
          disabled={!fix || saving}
          onPress={save}
          style={[formUi.btn, formUi.grow, { backgroundColor: colors.moss, opacity: !fix || saving ? 0.5 : 1 }]}>
          <Text style={[type.button, { color: '#FBF5E6' }]}>{saving ? s.saving : s.save}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onCancel} style={[formUi.btn, { borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.paper }]}>
          <Text style={[type.button, { color: colors.ink }]}>{s.cancel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const formUi = StyleSheet.create({
  card: { borderRadius: RADIUS.card, borderWidth: 1, padding: SPACE.l, gap: SPACE.s },
  kinds: { flexDirection: 'row', minHeight: 48, borderRadius: RADIUS.card, borderWidth: 1.5, overflow: 'hidden', marginBottom: SPACE.xs },
  kind: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.s },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: SPACE.m, paddingVertical: SPACE.s },
  actions: { flexDirection: 'row', gap: SPACE.s, marginTop: SPACE.xs },
  btn: { minHeight: 48, paddingHorizontal: SPACE.l, borderRadius: RADIUS.card, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
});
