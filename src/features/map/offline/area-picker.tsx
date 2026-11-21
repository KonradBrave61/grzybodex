// code-guard: intentional-duplicate - small UI names (chip, button, row) fuzzy-match pack-card.tsx / region-chip.tsx; no logic is duplicated.
import { Paths } from 'expo-file-system';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { VOIVODESHIPS, type VoivodeshipId } from '@/features/settings/voivodeships';
import { useLang, useStrings } from '@/i18n/i18n';
import { mapStrings } from '@/i18n/map';
import { RADIUS, SPACE, useTheme } from '@/ui/theme';

import { formatBytes, packKey, PACK_LEVELS, type PackKey, type PackLevel } from './catalog';
import type { PackStates } from './pack-manager';
import { getPackManager } from './pack-store';
import { ALL_IDS, checkSpace, poland, summarizeSelection, toggleId } from './selection';

/**
 * RESPONSIBILITY: Mapa konturowa Polski: dotknięcie województwa zaznacza/odznacza je (podświetlenie); dla czytników ekranu ukryta — to samo daje lista
 * INPUTS:         selected: zaznaczone id; onToggle(id)
 * OUTPUTS:        SVG (ścieżki liczone raz na uruchomienie aplikacji)
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function PolandMap({ selected, onToggle }: { selected: readonly VoivodeshipId[]; onToggle: (id: VoivodeshipId) => void }) {
  const { colors } = useTheme();
  const map = poland();
  return (
    <View style={pickUi.map} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Svg width="100%" viewBox={`0 0 ${map.width} ${map.height}`} style={{ aspectRatio: map.width / map.height }}>
        {ALL_IDS.map((id) => {
          const on = selected.includes(id);
          return (
            <Path
              key={id}
              d={map.paths[id]}
              fill={on ? colors.moss : colors.panelStrong}
              stroke={on ? colors.ink : colors.outline}
              strokeWidth={on ? 1.6 : 1}
              strokeLinejoin="round"
              onPress={() => onToggle(id)}
            />
          );
        })}
      </Svg>
    </View>
  );
}

/**
 * RESPONSIBILITY: Przycisk-chip (zakres / poziom / województwo) z accessibilityState selected
 * INPUTS:         label; selected; role: 'button' | 'radio'; onPress
 * OUTPUTS:        Pressable ≥ 48 px
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function PickChip({ label, selected, role, onPress }: { label: string; selected: boolean; role: 'button' | 'radio'; onPress: () => void }) {
  const { colors, type } = useTheme();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        pickUi.chip,
        { backgroundColor: selected ? colors.moss : colors.card, borderColor: selected ? colors.moss : colors.ink, opacity: pressed ? 0.8 : 1 },
      ]}>
      <Text style={[type.label, { color: selected ? colors.paper : colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * RESPONSIBILITY: Podsumowanie zaznaczenia: łączna waga (dokładna), pobrane/kolejkowane, wolne miejsce i ostrzeżenie, błąd z PackManager
 * INPUTS:         selected; level; states
 * OUTPUTS:        teksty podsumowania
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        filesystem (odczyt wolnego miejsca)
 * ERRORS:         błąd pierwszej zaznaczonej paczki w stanie „error” pokazany tekstem (np. „nie opublikowane”)
 */
function Summary({ selected, level, states }: { selected: readonly VoivodeshipId[]; level: PackLevel; states: PackStates }) {
  const { colors, type } = useTheme();
  const s = useStrings(mapStrings);
  const lang = useLang();
  const bytes = (n: number) => formatBytes(n, false, lang);
  const sel = summarizeSelection(selected, level, states);
  const space = checkSpace(sel, Paths.availableDiskSpace);
  const failed = selected.map((id) => states[packKey(id, level)]).find((st) => st?.status === 'error');
  return (
    <View style={pickUi.summary}>
      <Text style={[type.button, { color: colors.ink }]} accessibilityLiveRegion="polite">
        {selected.length === 0 ? s.pickNothing : s.pickTotal(selected.length, bytes(sel.newBytes))}
      </Text>
      {sel.doneCount > 0 && <Text style={[type.caption, { color: colors.mossText }]}>{s.pickAlready(sel.doneCount, bytes(sel.doneBytes))}</Text>}
      {sel.busyCount > 0 && <Text style={[type.caption, { color: colors.ink2 }]}>{s.pickBusy(sel.busyCount)}</Text>}
      <Text style={[type.caption, { color: colors.ink2 }]}>{s.pickFree(bytes(space.free))}</Text>
      {space.short && <Text style={[type.label, { color: colors.maple }]}>{s.pickSpace(bytes(space.need), bytes(space.free))}</Text>}
      {failed?.status === 'error' && <Text style={[type.caption, { color: colors.maple }]}>{s.packError(failed.error)}</Text>}
    </View>
  );
}

/** Adds each pack to the PackManager queue (no baseUrl → the manager records an 'unpublished' error per pack). */
function queueAll(keys: readonly PackKey[]): void {
  for (const key of keys) getPackManager().download(key);
}

/**
 * RESPONSIBILITY: Panel „Wybór zakresu” na ekranie Mapy offline: Cała Polska / województwa (mapa + lista), poziom, łączna waga na żywo,
 *                 „Pobierz zaznaczone” dodaje do kolejki PackManager paczki jeszcze niepobrane
 * INPUTS:         states: stan paczek z PackManager
 * OUTPUTS:        panel z mapą konturową, chipami, podsumowaniem i przyciskiem
 * AUTHN:          none (internal UI)
 * AUTHZ:          akcja tylko na dotknięcie użytkownika
 * TOUCHES:        filesystem, external-api (przez PackManager.download)
 * ERRORS:         brak adresu paczek → PackManager zapisuje błąd „unpublished” (pokazany w podsumowaniu i na kartach); przycisk nie udaje sukcesu
 */
export function AreaPicker({ states }: { states: PackStates }) {
  const { colors, type } = useTheme();
  const s = useStrings(mapStrings);
  const [selected, setSelected] = useState<readonly VoivodeshipId[]>([]);
  const [level, setLevel] = useState<PackLevel>('z13');
  const lang = useLang();
  const sel = summarizeSelection(selected, level, states);
  const allOn = selected.length === ALL_IDS.length;
  const label = sel.toDownload.length > 0 ? s.pickDownload(sel.toDownload.length, formatBytes(sel.newBytes, false, lang)) : s.pickDownloadNone;
  return (
    <View style={[pickUi.panel, { backgroundColor: colors.panel }]}>
      <Text style={[type.section, { color: colors.ink }]} accessibilityRole="header">
        {s.pickTitle}
      </Text>
      <Text style={[type.caption, { color: colors.ink2 }]}>{s.pickHint}</Text>
      <View style={pickUi.row}>
        <PickChip label={s.pickPoland} selected={allOn} role="button" onPress={() => setSelected(allOn ? [] : ALL_IDS)} />
        <PickChip label={s.pickClear} selected={false} role="button" onPress={() => setSelected([])} />
      </View>
      <PolandMap selected={selected} onToggle={(id) => setSelected((cur) => toggleId(cur, id))} />
      <View style={pickUi.row}>
        {VOIVODESHIPS.map((v) => (
          <PickChip key={v.id} label={v.name} selected={selected.includes(v.id)} role="button" onPress={() => setSelected((cur) => toggleId(cur, v.id))} />
        ))}
      </View>
      <Text style={[type.label, { color: colors.ink }]}>{s.pickLevel}</Text>
      <View style={pickUi.row} accessibilityRole="radiogroup">
        {PACK_LEVELS.map((l) => (
          <PickChip key={l.id} label={s.levels[l.id].name} selected={level === l.id} role="radio" onPress={() => setLevel(l.id)} />
        ))}
      </View>
      <Summary selected={selected} level={level} states={states} />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: sel.toDownload.length === 0 }}
        disabled={sel.toDownload.length === 0}
        onPress={() => queueAll(sel.toDownload)}
        style={({ pressed }) => [pickUi.go, { backgroundColor: colors.moss, opacity: sel.toDownload.length === 0 ? 0.4 : pressed ? 0.8 : 1 }]}>
        <Text style={[type.button, { color: colors.paper, textAlign: 'center' }]}>{label}</Text>
      </Pressable>
      {selected.length > 0 && sel.toDownload.length === 0 && <Text style={[type.caption, { color: colors.ink2 }]}>{s.pickAllDone}</Text>}
      <Text style={[type.caption, { color: colors.ink2 }]}>{s.pickAbroad}</Text>
    </View>
  );
}

const pickUi = StyleSheet.create({
  panel: { borderRadius: RADIUS.card, padding: SPACE.l, gap: SPACE.m },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s },
  map: { width: '100%', alignSelf: 'center' },
  chip: { minHeight: 48, paddingHorizontal: SPACE.l, borderRadius: RADIUS.chip, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  summary: { gap: SPACE.xs },
  go: { minHeight: 48, paddingHorizontal: SPACE.l, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
