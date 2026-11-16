// code-guard: intentional-duplicate - local UI identifiers (confirm, smallBtn) mirror spot-row.tsx; no logic is duplicated.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLang, useStrings } from '@/i18n/i18n';
import { mapStrings } from '@/i18n/map';
import { RADIUS, SPACE, useTheme } from '@/ui/theme';

import { formatDistance } from './geo';
import { MapGlyph } from './map-glyphs';
import { clearTrail, startTrail, stopTrail, type TrailState } from './trail';
import { trailLengthMeters } from './trail-model';

/**
 * RESPONSIBILITY: Karta „Ślad drogi” pod mapą: nagrywaj / zatrzymaj / nagrywaj nowy / usuń (z potwierdzeniem, gdy kasuje stary ślad)
 * INPUTS:         trail: TrailState z useTrail
 * OUTPUTS:        karta; nagrywanie działa też z wygaszonym ekranem (usługa z powiadomieniem)
 * AUTHN:          none (bez kont; ślad tylko na tym telefonie)
 * AUTHZ:          systemowa zgoda na lokalizację (pytana przy pierwszym „Nagrywaj ślad”)
 * TOUCHES:        db + external-api (przez startTrail / stopTrail / clearTrail)
 * ERRORS:         brak zgody / wyłączona lokalizacja / błąd usługi → komunikat w karcie
 */
export function TrailPanel({ trail }: { trail: TrailState }) {
  const { colors, type } = useTheme();
  const s = useStrings(mapStrings);
  const lang = useLang();
  const [confirm, setConfirm] = useState<'new' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const points = trail.points ?? [];
  const has = points.length > 1;
  const length = formatDistance(trailLengthMeters(points), lang);
  const message = error ?? (trail.failed ? s.trailLoadFailed : null);

  const act = (job: () => Promise<string | null>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setConfirm(null);
    job()
      .then(setError, () => setError(s.actionFailed))
      .finally(() => setBusy(false));
  };
  const start = () => act(async () => {
    const r = await startTrail();
    return r === 'ok' ? null : r === 'denied' ? s.trailDenied : s.trailOff;
  });
  const stop = () => act(async () => {
    await stopTrail();
    return null;
  });
  const remove = () => act(async () => {
    await clearTrail();
    return null;
  });
  const button = (label: string, onPress: () => void, filled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={[panelUi.btn, { borderColor: colors.ink, backgroundColor: filled ? colors.ink : colors.paper, opacity: busy ? 0.6 : 1 }]}>
      <Text style={[type.button, { color: filled ? colors.paper : colors.ink }]}>{label}</Text>
    </Pressable>
  );

  let title = s.trailTitle;
  let body = s.trailBody;
  if (trail.recording) {
    title = s.recordingTitle(length);
    body = s.recordingBody;
  } else if (has) {
    title = s.trailDone(length);
    body = s.trailDoneBody;
  }

  return (
    <View style={[panelUi.card, { borderColor: trail.recording ? colors.maple : colors.line, backgroundColor: colors.card }]}>
      <View style={panelUi.head}>
        {trail.recording ? <View style={[panelUi.rec, { backgroundColor: colors.maple }]} /> : <MapGlyph glyph="trail" color={colors.ink} />}
        <Text style={[type.label, panelUi.grow, { color: colors.ink }]} accessibilityLiveRegion="polite">
          {title}
        </Text>
      </View>
      <Text style={[type.caption, { color: colors.ink2 }]}>{body}</Text>
      {confirm ? (
        <>
          <Text style={[type.body, { color: colors.ink }]} accessibilityLiveRegion="polite">
            {confirm === 'new' ? s.confirmNewTrail : s.confirmDeleteTrail}
          </Text>
          <View style={panelUi.row}>
            {button(confirm === 'new' ? s.yesRecordNew : s.yesDelete, confirm === 'new' ? start : remove, true)}
            {button(s.keep, () => setConfirm(null), false)}
          </View>
        </>
      ) : (
        <View style={panelUi.row}>
          {trail.recording && button(s.stop, stop, true)}
          {!trail.recording && !has && button(s.record, start, true)}
          {!trail.recording && has && button(s.recordNew, () => setConfirm('new'), true)}
          {!trail.recording && has && button(s.deleteTrail, () => setConfirm('delete'), false)}
        </View>
      )}
      {message && <Text style={[type.caption, { color: colors.maple }]}>{message}</Text>}
    </View>
  );
}

const panelUi = StyleSheet.create({
  card: { borderRadius: RADIUS.card, borderWidth: 1.5, padding: SPACE.m, gap: SPACE.s },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s },
  rec: { width: 12, height: 12, borderRadius: 6, marginHorizontal: 4 },
  grow: { flex: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s },
  btn: { minHeight: 44, flexGrow: 1, paddingHorizontal: SPACE.l, borderRadius: RADIUS.card, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
