// code-guard: intentional-duplicate - modal/button style names mirror wynik.tsx and spot-form.tsx; no logic is duplicated.
import Constants from "expo-constants";
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
import { scanStrings } from "@/i18n/scan";
import { RADIUS, SPACE, useTheme } from "@/ui/theme";

import { openReportMail, reportMessage } from "./report";

const NOTE_MAX = 1000;

/**
 * RESPONSIBILITY: Okno „Zgłoś nieskatalogowanego grzyba”: notatka użytkownika → kompozytor e-mail ze zdjęciami bez EXIF
 * INPUTS:         visible; photoUris: ujęcia skanu (untrusted, ≤ 3); onClose
 * OUTPUTS:        modal; po „Otwórz pocztę” systemowy kompozytor e-mail (wysyłkę zatwierdza użytkownik)
 * AUTHN:          none
 * AUTHZ:          none — nic nie jest wysyłane bez działania użytkownika w jego poczcie
 * BLAST RADIUS:   kopie zdjęć w cache aplikacji
 * TOUCHES:        files (cache), external (kompozytor e-mail)
 * ERRORS:         brak aplikacji poczty / błąd przygotowania → komunikat w oknie, okno zostaje otwarte
 */
export function ReportSheet({
  visible,
  photoUris,
  onClose,
}: {
  visible: boolean;
  photoUris: readonly string[];
  onClose: () => void;
}) {
  const { colors, type } = useTheme();
  const t = useStrings(scanStrings);
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setError(null);
    onClose();
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const message = reportMessage(
        {
          subject: t.reportSubject,
          noteLabel: t.reportMailNote,
          noNote: t.reportMailNoNote,
          appVersion: t.reportMailVersion,
        },
        note,
        Constants.expoConfig?.version,
      );
      const outcome = await openReportMail(photoUris, message);
      if (outcome === "no_mail_app") setError(t.reportNoMail);
      else close();
    } catch {
      setError(t.reportFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <KeyboardAvoidingView behavior="padding" style={sheet.backdrop}>
        {/* Scrolls when the keyboard leaves too little room; the top inset keeps the title below the status bar. */}
        <ScrollView
          contentContainerStyle={[
            sheet.scroll,
            { paddingTop: insets.top + 20 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[sheet.card, { backgroundColor: colors.paper }]}>
            <Text
              style={[type.section, { color: colors.ink }]}
              accessibilityRole="header"
            >
              {t.reportTitle}
            </Text>
            <Text style={[type.body, { color: colors.ink }]}>
              {t.reportIntro(photoUris.length)}
            </Text>
            <Text style={[type.label, { color: colors.ink2 }]}>
              {t.reportNoteLabel}
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              maxLength={NOTE_MAX}
              multiline
              placeholder={t.reportNoteHint}
              placeholderTextColor={colors.ink2}
              accessibilityLabel={t.reportNoteLabel}
              style={[
                sheet.input,
                type.body,
                {
                  color: colors.ink,
                  backgroundColor: colors.card,
                  borderColor: colors.line,
                },
              ]}
            />
            {error && (
              <Text
                style={[type.caption, { color: colors.maple }]}
                accessibilityLiveRegion="polite"
              >
                {error}
              </Text>
            )}
            <View style={sheet.actions}>
              <Pressable
                onPress={close}
                style={[
                  sheet.btn,
                  sheet.secondary,
                  { borderColor: colors.ink },
                ]}
                accessibilityRole="button"
              >
                <Text
                  style={[type.button, sheet.center, { color: colors.ink }]}
                >
                  {t.reportCancel}
                </Text>
              </Pressable>
              <Pressable
                onPress={send}
                disabled={busy}
                style={[
                  sheet.btn,
                  { backgroundColor: colors.moss, opacity: busy ? 0.6 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityState={{ busy }}
              >
                <Text style={[type.button, sheet.center, sheet.onMoss]}>
                  {busy ? t.reportPreparing : t.reportSend}
                </Text>
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
  input: {
    minHeight: 96,
    maxHeight: 180,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: SPACE.m,
    paddingVertical: SPACE.s,
    textAlignVertical: "top",
  },
  actions: { flexDirection: "row", gap: 12 },
  btn: {
    flex: 1,
    minHeight: 52,
    borderRadius: RADIUS.card,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  secondary: { borderWidth: 2 },
  center: { textAlign: "center" },
  onMoss: { color: "#FBF5E6" },
});
