// code-guard: intentional-duplicate - small UI names (button, row, label) fuzzy-match other screens; no logic is duplicated.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { VoivodeshipId } from '@/features/settings/voivodeships';
import { useLang, useStrings } from '@/i18n/i18n';
import { mapStrings } from '@/i18n/map';
import { Icon } from '@/ui/icons';
import { RADIUS, SPACE, useTheme } from '@/ui/theme';

import { formatBytes, PACK_LEVELS, packInfo, packKey, type PackKey } from './catalog';
import type { PackState, PackStates } from './pack-manager';
import { getPackManager } from './pack-store';

type ButtonKind = 'primary' | 'secondary' | 'quiet';

/**
 * RESPONSIBILITY: Przycisk akcji paczki mapy (Pobierz / Wstrzymaj / Wznów / Anuluj / Usuń) — jeden wygląd w całym ekranie
 * INPUTS:         label; kind: primary (pełny, ciemny) | secondary (obramowany) | quiet (sam tekst); onPress; a11y?: dłuższy opis
 * OUTPUTS:        Pressable ≥ 48 px wysokości
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function PackButton({ label, kind, onPress, a11y }: { label: string; kind: ButtonKind; onPress: () => void; a11y?: string }) {
  const { colors, type } = useTheme();
  const look =
    kind === 'primary'
      ? { backgroundColor: colors.moss, borderColor: colors.moss }
      : kind === 'secondary'
        ? { backgroundColor: colors.card, borderColor: colors.ink }
        : { backgroundColor: 'transparent', borderColor: 'transparent' };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      onPress={onPress}
      style={({ pressed }) => [cardUi.btn, kind === 'primary' && cardUi.btnWide, look, { opacity: pressed ? 0.8 : 1 }]}>
      <Text style={[type.button, { color: kind === 'primary' ? colors.paper : colors.ink, textAlign: 'center' }]}>{label}</Text>
    </Pressable>
  );
}

function Progress({ written, total }: { written: number; total: number }) {
  const { colors, type } = useTheme();
  const s = useStrings(mapStrings);
  const lang = useLang();
  const pct = total > 0 ? Math.min(100, Math.round((100 * written) / total)) : 0;
  return (
    <View style={cardUi.progress} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
      <View style={[cardUi.track, { backgroundColor: colors.panelStrong }]}>
        <View style={[cardUi.fill, { width: `${pct}%`, backgroundColor: colors.moss }]} />
      </View>
      <Text style={[type.caption, { color: colors.ink2 }]}>{s.progress(formatBytes(written, false, lang), formatBytes(total, false, lang), pct)}</Text>
    </View>
  );
}

/**
 * RESPONSIBILITY: Stan i przyciski jednej paczki: pobierz → (postęp, wstrzymaj, anuluj) → w telefonie (usuń); błąd → ponów
 * INPUTS:         key: paczka (województwo + dokładność); state: jej stan (undefined = nie pobrana)
 * OUTPUTS:        pasek postępu + przyciski ≥ 48 px
 * AUTHN:          none (internal UI)
 * AUTHZ:          akcje tylko na dotknięcie użytkownika
 * TOUCHES:        filesystem, external-api (przez PackManager)
 * ERRORS:         komunikat błędu z PackManager pokazany nad przyciskiem „Spróbuj ponownie”
 */
function PackActions({ packId, state }: { packId: PackKey; state: PackState | undefined }) {
  const { colors, type } = useTheme();
  const s = useStrings(mapStrings);
  const lang = useLang();
  const m = getPackManager();
  const key = packId;
  if (!state) return <PackButton kind="primary" label={s.download(formatBytes(packInfo(key).bytes, undefined, lang))} onPress={() => m.download(key)} />;
  switch (state.status) {
    case 'queued':
    case 'downloading':
      return (
        <>
          <Progress written={state.written} total={state.total} />
          {state.status === 'queued' && <Text style={[type.caption, { color: colors.ink2 }]}>{s.queued}</Text>}
          <View style={cardUi.row}>
            <PackButton kind="secondary" label={s.pause} onPress={() => void m.pause(key)} />
            <PackButton kind="quiet" label={s.cancel} a11y={s.cancelDownloadA11y} onPress={() => m.cancel(key)} />
          </View>
        </>
      );
    case 'paused':
      return (
        <>
          <Progress written={state.written} total={state.total} />
          <View style={cardUi.row}>
            <PackButton kind="primary" label={state.written > 0 ? s.resume : s.start} onPress={() => m.resume(key)} />
            <PackButton kind="quiet" label={s.cancel} a11y={s.cancelDownloadA11y} onPress={() => m.cancel(key)} />
          </View>
        </>
      );
    case 'verifying':
      return <Text style={[type.caption, { color: colors.ink2 }]}>{s.verifying}</Text>;
    case 'done':
      return (
        <View style={cardUi.row}>
          <View style={cardUi.done}>
            <Icon name="check" size={20} color={colors.mossText} strokeWidth={2.4} />
            <Text style={[type.label, { color: colors.mossText }]}>{s.onPhone(formatBytes(state.bytes, false, lang))}</Text>
          </View>
          <PackButton kind="secondary" label={s.delete} a11y={s.deleteMapA11y} onPress={() => m.remove(key)} />
        </View>
      );
    case 'error':
      return (
        <>
          <Text style={[type.caption, { color: colors.maple }]}>{s.packError(state.error)}</Text>
          <View style={cardUi.row}>
            <PackButton kind="primary" label={s.retry} onPress={() => m.download(key)} />
            <PackButton kind="quiet" label={s.close} onPress={() => m.cancel(key)} />
          </View>
        </>
      );
  }
}

/**
 * RESPONSIBILITY: Karta województwa na ekranie „Mapy offline”: nazwa i osobny wiersz dla każdej dokładności (rozmiar, opis, stan, akcje) —
 *                 obie dokładności mogą być pobrane i pobierać się jednocześnie
 * INPUTS:         id, name: województwo (nazwa urzędowa, po polsku); states: stan wszystkich paczek; badge?: dopisek („Tu jesteś”, „Mój region”)
 * OUTPUTS:        karta z dwoma wierszami
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        filesystem, external-api (przez PackActions)
 * ERRORS:         jak PackActions
 */
export function PackCard({ id, name, states, badge }: { id: VoivodeshipId; name: string; states: PackStates; badge?: string }) {
  const { colors, type } = useTheme();
  const s = useStrings(mapStrings);
  const lang = useLang();
  const anyDone = PACK_LEVELS.some((l) => states[packKey(id, l.id)]?.status === 'done');
  return (
    <View style={[cardUi.card, { backgroundColor: colors.card, borderColor: anyDone ? colors.moss : colors.line }]}>
      <View style={cardUi.head}>
        <Text style={[type.tileTitle, cardUi.grow, { color: colors.ink }]} accessibilityRole="header">
          {name}
        </Text>
        {badge && <Text style={[type.label, cardUi.badge, { backgroundColor: colors.panel, color: colors.ink }]}>{badge}</Text>}
      </View>
      {PACK_LEVELS.map((l, i) => {
        const key = packKey(id, l.id);
        return (
          <View key={l.id} style={[cardUi.level, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
            <View style={cardUi.levelHead}>
              <Text style={[type.button, cardUi.grow, { color: colors.ink }]}>{s.levels[l.id].name}</Text>
              <Text style={[type.label, { color: colors.ink2 }]}>{formatBytes(packInfo(key).bytes, undefined, lang)}</Text>
            </View>
            <Text style={[type.caption, { color: colors.ink2 }]}>{s.levels[l.id].hint}</Text>
            <PackActions packId={key} state={states[key]} />
          </View>
        );
      })}
    </View>
  );
}

const cardUi = StyleSheet.create({
  card: { borderWidth: 1.5, borderRadius: RADIUS.card, padding: SPACE.l, gap: SPACE.m },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s },
  grow: { flex: 1, minWidth: 0 },
  badge: { paddingHorizontal: SPACE.s, paddingVertical: 2, borderRadius: RADIUS.chip, overflow: 'hidden' },
  level: { gap: SPACE.s, paddingTop: SPACE.m },
  levelHead: { flexDirection: 'row', alignItems: 'baseline', gap: SPACE.s },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s },
  btn: { minHeight: 48, paddingHorizontal: SPACE.l, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  btnWide: { flex: 1 },
  done: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  progress: { gap: SPACE.xs },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
});
