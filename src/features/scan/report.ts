// code-guard: intentional-duplicate - short local names (longer, image, saved) fuzzy-match other files; no logic is duplicated.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as MailComposer from 'expo-mail-composer';

/**
 * Below this top-1 probability the result screen says the mushroom may be outside our catalogue and offers a report.
 * Measured (ml/results/open_set_vit_int8.json, ViT int8, 2026-11-05): flags 74% of species the model does not know,
 * and also 26% of known ones (test_pl) — decided by the user 2026-11-15 (.xmo/decisions/2026-11-15-nieskatalogowany.md).
 */
export const UNCATALOGUED_BELOW = 0.9;

/** Report recipient. TODO before the release APK: the creator's address (the same one as in the privacy policy). */
export const REPORT_EMAIL: string | null = null;

/** Longer side of the photo copies attached to the e-mail (enough to identify, small enough for mail). */
const REPORT_PHOTO_MAX = 1600;

export type ReportTexts = { subject: string; noteLabel: string; noNote: string; appVersion: string };

/**
 * RESPONSIBILITY: Temat i treść e-maila zgłoszenia — tylko notatka użytkownika i wersja aplikacji
 * INPUTS:         t: teksty (trusted); note: string — untrusted (wpis użytkownika); version: wersja aplikacji
 * OUTPUTS:        { subject, body } — bez lokalizacji, bez wyników modelu, bez identyfikatorów
 * AUTHN:          none
 * AUTHZ:          none
 * BLAST RADIUS:   none (czysta funkcja)
 * TOUCHES:        none
 * ERRORS:         none
 */
export function reportMessage(t: ReportTexts, note: string, version: string | undefined) {
  const text = note.trim();
  return {
    subject: t.subject,
    body: `${t.noteLabel}\n${text || t.noNote}\n\n${t.appVersion} ${version ?? '?'}`,
  };
}

/**
 * RESPONSIBILITY: Kopia zdjęcia do zgłoszenia — ponownie zakodowany JPEG bez metadanych EXIF (GPS, model telefonu, data)
 * INPUTS:         uri: string — untrusted (zdjęcie z aparatu/galerii)
 * OUTPUTS:        Promise<string> — URI nowego pliku w pamięci podręcznej aplikacji (dłuższy bok ≤ 1600 px)
 * AUTHN:          none
 * AUTHZ:          none
 * BLAST RADIUS:   nowy plik w cache; oryginał nietknięty
 * TOUCHES:        files (cache)
 * ERRORS:         błąd odczytu/zapisu obrazu → wyjątek do wywołującego
 */
async function strippedCopy(uri: string): Promise<string> {
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const longer = Math.max(original.width, original.height);
  // Re-encoding from decoded pixels writes a fresh JPEG; the manipulator does not copy EXIF into it.
  const image =
    longer > REPORT_PHOTO_MAX
      ? await ImageManipulator.manipulate(uri)
          .resize(original.width >= original.height ? { width: REPORT_PHOTO_MAX } : { height: REPORT_PHOTO_MAX })
          .renderAsync()
      : original;
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return saved.uri;
}

export type ReportOutcome = 'opened' | 'no_mail_app';

/**
 * RESPONSIBILITY: Otwiera aplikację pocztową użytkownika z gotowym zgłoszeniem nieskatalogowanego grzyba
 * INPUTS:         photoUris: string[] — untrusted (ujęcia skanu, ≤ 3); message: temat i treść z reportMessage
 * OUTPUTS:        'opened' (kompozytor pokazany; wysyłkę zatwierdza użytkownik) | 'no_mail_app'
 * AUTHN:          none
 * AUTHZ:          none — aplikacja nic nie wysyła sama; decyzja o wysłaniu należy do użytkownika w jego poczcie
 * BLAST RADIUS:   kopie zdjęć w cache; e-mail wychodzi tylko po zatwierdzeniu przez użytkownika
 * TOUCHES:        files (cache), external (systemowy kompozytor e-mail)
 * ERRORS:         błąd przygotowania zdjęć → wyjątek do wywołującego
 */
export async function openReportMail(photoUris: readonly string[], message: { subject: string; body: string }): Promise<ReportOutcome> {
  if (!(await MailComposer.isAvailableAsync())) return 'no_mail_app';
  const attachments = await Promise.all(photoUris.map(strippedCopy));
  await MailComposer.composeAsync({
    recipients: REPORT_EMAIL ? [REPORT_EMAIL] : [],
    subject: message.subject,
    body: message.body,
    attachments,
  });
  return 'opened';
}
