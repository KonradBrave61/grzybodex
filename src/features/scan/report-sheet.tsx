// code-guard: intentional-duplicate - modal/button style names mirror wynik.tsx and spot-form.tsx; no logic is duplicated.
import Constants from "expo-constants";
import { Image } from "expo-image";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useStrings } from "@/i18n/i18n";
import { reportStrings } from "@/i18n/report";
import { VOIVODESHIPS, type VoivodeshipId } from "@/features/settings/voivodeships";
import { openExternal } from "@/ui/link";
import { RADIUS, SPACE, useTheme } from "@/ui/theme";

import { openReportMail } from "./report";
import {
  buildReportJson,
  HABITATS,
  LICENSES,
  localIsoDate,
  REPORT_DESCRIPTION_MAX,
  REPORT_NAME_MAX,
  REPORT_PHOTOS_MAX,
  reportMessage,
  validateReport,
  type Habitat,
  type LicenseId,
  type ReportDraft,
} from "./report-form";

/** The saved scan the report is made from (the Collection row). */
export type ReportSource = {
  photoUri: string;
  speciesId: string | null;
  createdAt: Date;
};

/**
 * RESPONSIBILITY: Rząd wyboru jednej opcji (chipy): siedlisko albo województwo
 * INPUTS:         options: {id, label}[] (trusted); value: id | null; onChange; noneLabel: opcja „brak” (null)
 * OUTPUTS:        zawijane chipy z zaznaczeniem; ponowne dotknięcie nie odznacza (jest osobna opcja „brak”)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function Chips<T extends string>({
  options,
  value,
  onChange,
  noneLabel,
}: {
  options: { id: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
  noneLabel?: string;
}) {
  const { colors, type } = useTheme();
  const all: { id: T | null; label: string }[] = noneLabel
    ? [{ id: null, label: noneLabel }, ...options]
    : options;
  return (
    <View style={sheet.chips}>
      {all.map((o) => {
        const on = value === o.id;
        return (
          <Pressable
            key={o.id ?? "none"}
            onPress={() => onChange(o.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={[
              sheet.chip,
              on
                ? { backgroundColor: colors.ink, borderColor: colors.ink }
                : { borderColor: colors.outline },
            ]}
          >
            <Text
              style={[type.label, { color: on ? colors.paper : colors.ink }]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * RESPONSIBILITY: Jedna licencja jako rozwijana pozycja (accordion): wybór (radio) + opis po rozwinięciu + link do pełnego tekstu
 * INPUTS:         id: LicenseId; selected, expanded: boolean; onSelect, onToggle
 * OUTPUTS:        pozycja; opis i link widoczne tylko po rozwinięciu
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        external (link do creativecommons.org otwierany dopiero po dotknięciu)
 * ERRORS:         none
 */
function LicenseOption({
  id,
  selected,
  expanded,
  onSelect,
  onToggle,
}: {
  id: LicenseId;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const { colors, type } = useTheme();
  const t = useStrings(reportStrings);
  const info = t.licenses[id];
  const url = LICENSES.find((l) => l.id === id)?.url ?? null;
  return (
    <View style={[sheet.lic, { borderColor: selected ? colors.moss : colors.line, backgroundColor: colors.card }]}>
      <View style={sheet.licHead}>
        <Pressable
          onPress={onSelect}
          accessibilityRole="radio"
          accessibilityState={{ selected }}
          accessibilityLabel={info.title}
          style={sheet.tap}
        >
          <View style={[sheet.radio, { borderColor: colors.ink }]}>
            {selected && <View style={[sheet.radioDot, { backgroundColor: colors.moss }]} />}
          </View>
        </Pressable>
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          style={sheet.licTitle}
        >
          <Text style={[type.button, sheet.flex, { color: colors.ink }]}>{info.title}</Text>
          <Text style={[type.button, { color: colors.ink }]}>{expanded ? "−" : "+"}</Text>
        </Pressable>
      </View>
      {expanded && (
        <View style={sheet.licBody}>
          <Text style={[type.body, { color: colors.ink }]}>{info.body}</Text>
          {url && (
            <Pressable onPress={() => openExternal(url)} accessibilityRole="link" style={sheet.linkBtn}>
              <Text style={[type.button, { color: colors.ink, textDecorationLine: "underline" }]}>
                {t.licenseFull}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

/**
 * RESPONSIBILITY: Pole wyboru z checkboxem (oświadczenie autorstwa, zgoda)
 * INPUTS:         checked: boolean; onChange; label: string
 * OUTPUTS:        wiersz z polem i tekstem; cały wiersz jest celem dotyku
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function CheckRow({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  const { colors, type } = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={sheet.checkRow}
    >
      <View style={[sheet.box, { borderColor: colors.ink, backgroundColor: checked ? colors.moss : "transparent" }]}>
        {checked && <Text style={sheet.tick}>✓</Text>}
      </View>
      <Text style={[type.body, sheet.flex, { color: colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * RESPONSIBILITY: Blok „Co się stanie” — jasny komunikat o e-mailu, załącznikach, adresie nadawcy i weryfikacji
 * INPUTS:         none (teksty z reportStrings)
 * OUTPUTS:        ramka z punktami
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function Notice() {
  const { colors, type } = useTheme();
  const t = useStrings(reportStrings);
  return (
    <View style={[sheet.notice, { backgroundColor: colors.panel, borderColor: colors.line }]}>
      <Text style={[type.tileTitle, { color: colors.ink }]}>{t.noticeTitle}</Text>
      {t.noticeItems.map((item) => (
        <Text key={item} style={[type.body, { color: colors.ink }]}>
          {`• ${item}`}
        </Text>
      ))}
    </View>
  );
}

type Texts = (typeof reportStrings)["pl"];
type SetField = <K extends keyof ReportDraft>(key: K, value: ReportDraft[K]) => void;

/**
 * RESPONSIBILITY: Waliduje formularz i otwiera kompozytor e-mail (zgloszenie.json + zdjęcia bez EXIF)
 * INPUTS:         draft: ReportDraft — untrusted (wpis użytkownika); source: ReportSource; t: teksty
 * OUTPUTS:        Promise<string[]> — komunikaty błędów; pusta lista = kompozytor otwarty
 * AUTHN:          none
 * AUTHZ:          none — wysyłkę zatwierdza użytkownik w swojej poczcie
 * BLAST RADIUS:   kopie zdjęć i zgloszenie.json w cache
 * TOUCHES:        files (cache), external (kompozytor e-mail)
 * ERRORS:         błędy przygotowania są przechwycone i zwrócone jako komunikat
 */
async function submitReport(draft: ReportDraft, source: ReportSource, t: Texts): Promise<string[]> {
  const checked = validateReport(draft, localIsoDate(new Date()));
  if (!checked.ok) return checked.errors.map((e) => t.errors[e]);
  try {
    const version = Constants.expoConfig?.version;
    const labels = {
      subject: t.mailSubject,
      name: t.mailName,
      description: t.mailDescription,
      habitat: t.mailHabitat,
      found: t.mailFound,
      region: t.mailRegion,
      license: t.mailLicense,
      appVersion: t.mailVersion,
      none: t.mailNone,
      habitatNames: t.habitats,
    };
    const message = reportMessage(labels, checked.value, version);
    const json = buildReportJson(checked.value, { appVersion: version, speciesId: source.speciesId });
    const outcome = await openReportMail(checked.value, message, json);
    return outcome === "no_mail_app" ? [t.noMail] : [];
  } catch {
    return [t.failed];
  }
}

/**
 * RESPONSIBILITY: Pola formularza zgłoszenia (zdjęcia, nazwa, opis, siedlisko, data, województwo, licencje, oświadczenia)
 * INPUTS:         draft: ReportDraft; set: zmiana jednego pola
 * OUTPUTS:        pola; licencje jako rozwijane pozycje (jedna otwarta naraz)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function ReportFields({ draft, set }: { draft: ReportDraft; set: SetField }) {
  const { colors, type } = useTheme();
  const t = useStrings(reportStrings);
  const [openLicense, setOpenLicense] = useState<LicenseId | null>(null);
  const inputStyle = [sheet.input, type.body, { color: colors.ink, backgroundColor: colors.card, borderColor: colors.line }];
  const label = (text: string) => <Text style={[type.label, { color: colors.ink2 }]}>{text}</Text>;
  return (
    <>
      {label(t.photosLabel(draft.photoUris.length))}
      <View style={sheet.photos}>
        {draft.photoUris.slice(0, REPORT_PHOTOS_MAX).map((uri) => (
          <Image key={uri} source={{ uri }} style={sheet.photo} contentFit="cover" />
        ))}
      </View>
      {label(t.nameLabel)}
      <TextInput value={draft.name} onChangeText={(v) => set("name", v)} maxLength={REPORT_NAME_MAX} placeholder={t.nameHint} placeholderTextColor={colors.ink2} accessibilityLabel={t.nameLabel} style={inputStyle} />
      {label(t.descriptionLabel)}
      <TextInput value={draft.description} onChangeText={(v) => set("description", v)} maxLength={REPORT_DESCRIPTION_MAX} multiline placeholder={t.descriptionHint} placeholderTextColor={colors.ink2} accessibilityLabel={t.descriptionLabel} style={[inputStyle, sheet.multiline]} />
      {label(t.habitatLabel)}
      <Chips<Habitat> options={HABITATS.map((h) => ({ id: h, label: t.habitats[h] }))} value={draft.habitat} onChange={(v) => set("habitat", v)} noneLabel={t.regionNone} />
      {label(t.dateLabel)}
      <TextInput value={draft.foundOn} onChangeText={(v) => set("foundOn", v)} maxLength={10} keyboardType="numbers-and-punctuation" accessibilityLabel={t.dateLabel} style={inputStyle} />
      {label(t.regionLabel)}
      <Chips<VoivodeshipId> options={VOIVODESHIPS.map((v) => ({ id: v.id, label: v.name }))} value={draft.voivodeship} onChange={(v) => set("voivodeship", v)} noneLabel={t.regionNone} />
      <Text style={[type.caption, { color: colors.ink2 }]}>{t.regionNote}</Text>
      {label(t.licenseLabel)}
      <Text style={[type.caption, { color: colors.ink }]}>{t.licenseIrrevocable}</Text>
      {LICENSES.map((l) => (
        <LicenseOption key={l.id} id={l.id} selected={draft.license === l.id} expanded={openLicense === l.id} onSelect={() => set("license", l.id)} onToggle={() => setOpenLicense(openLicense === l.id ? null : l.id)} />
      ))}
      <CheckRow checked={draft.ownPhotos} onChange={(v) => set("ownPhotos", v)} label={t.ownPhotos} />
      <CheckRow checked={draft.consent} onChange={(v) => set("consent", v)} label={t.consent} />
    </>
  );
}

/**
 * RESPONSIBILITY: Okno „Zgłoś grzyba do atlasu” (otwierane z Kolekcji): komunikat, formularz, wysyłka do kompozytora e-mail
 * INPUTS:         source: ReportSource (zapisany skan, trusted); onClose; rodzic montuje okno z kluczem = id skanu (świeży stan)
 * OUTPUTS:        modal; po „Otwórz pocztę” systemowy kompozytor e-mail (wysyłkę zatwierdza użytkownik)
 * AUTHN:          none
 * AUTHZ:          none — nic nie jest wysyłane bez działania użytkownika w jego poczcie
 * BLAST RADIUS:   kopie zdjęć i zgloszenie.json w cache aplikacji
 * TOUCHES:        files (cache), external (kompozytor e-mail)
 * ERRORS:         błąd walidacji / brak poczty / błąd przygotowania → komunikat w oknie, okno zostaje otwarte
 */
export function ReportSheet({ source, onClose }: { source: ReportSource; onClose: () => void }) {
  const { colors, type } = useTheme();
  const t = useStrings(reportStrings);
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<ReportDraft>({
    photoUris: [source.photoUri],
    name: "",
    description: "",
    habitat: null,
    foundOn: localIsoDate(source.createdAt),
    voivodeship: null,
    license: null,
    ownPhotos: false,
    consent: false,
  });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const set: SetField = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

  const send = async () => {
    setBusy(true);
    const result = await submitReport(draft, source, t);
    setErrors(result);
    setBusy(false);
    if (result.length === 0) onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={sheet.backdrop}>
        <ScrollView contentContainerStyle={[sheet.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]} keyboardShouldPersistTaps="handled">
          <View style={[sheet.card, { backgroundColor: colors.paper }]}>
            <Text style={[type.section, { color: colors.ink }]} accessibilityRole="header">
              {t.title}
            </Text>
            <Notice />
            <ReportFields draft={draft} set={set} />
            {errors.length > 0 && (
              <View accessibilityLiveRegion="polite">
                {errors.map((e) => (
                  <Text key={e} style={[type.caption, { color: colors.maple }]}>
                    {e}
                  </Text>
                ))}
              </View>
            )}
            <View style={sheet.actions}>
              <Pressable onPress={onClose} style={[sheet.btn, sheet.secondary, { borderColor: colors.ink }]} accessibilityRole="button">
                <Text style={[type.button, sheet.center, { color: colors.ink }]}>{t.cancel}</Text>
              </Pressable>
              <Pressable onPress={send} disabled={busy} style={[sheet.btn, { backgroundColor: colors.moss, opacity: busy ? 0.6 : 1 }]} accessibilityRole="button" accessibilityState={{ busy }}>
                <Text style={[type.button, sheet.center, sheet.onMoss]}>{busy ? t.preparing : t.send}</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const sheet = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 20 },
  card: { borderRadius: 16, padding: 20, gap: SPACE.m },
  flex: { flex: 1 },
  notice: { padding: 12, borderRadius: RADIUS.card, borderWidth: 1, gap: 6 },
  photos: { flexDirection: "row", gap: 8 },
  photo: { width: 72, height: 72, borderRadius: 8 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: SPACE.m, paddingVertical: SPACE.s },
  multiline: { minHeight: 96, maxHeight: 180, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 12, borderRadius: RADIUS.chip, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  lic: { borderWidth: 2, borderRadius: 10, overflow: "hidden" },
  licHead: { flexDirection: "row", alignItems: "center" },
  tap: { width: 52, minHeight: 52, alignItems: "center", justifyContent: "center" },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  licTitle: { flex: 1, minHeight: 52, flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 12 },
  licBody: { paddingHorizontal: 12, paddingBottom: 12, gap: 4 },
  linkBtn: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, minHeight: 44 },
  box: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  tick: { color: "#FBF5E6", fontWeight: "700" },
  actions: { flexDirection: "row", gap: 12 },
  btn: { flex: 1, minHeight: 52, borderRadius: RADIUS.card, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  secondary: { borderWidth: 2 },
  center: { textAlign: "center" },
  onMoss: { color: "#FBF5E6" },
});
