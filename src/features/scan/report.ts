// code-guard: intentional-duplicate - short local names (longer, image, saved) fuzzy-match other files; no logic is duplicated.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File, Paths } from 'expo-file-system';
import * as MailComposer from 'expo-mail-composer';

import type { ReportData, ReportJson } from './report-form';

/**
 * Below this top-1 probability the result screen says the mushroom may be outside our catalogue (reporting is done from the Collection, not from the result).
 * Measured (ml/results/open_set_vit_int8.json, ViT int8, 2026-11-05): flags 74% of species the model does not know,
 * and also 26% of known ones (test_pl) — decided by the user 2026-11-15 (.xmo/decisions/2026-11-15-nieskatalogowany.md).
 */
export const UNCATALOGUED_BELOW = 0.9;

/**
 * Report recipient.
 * TODO(user): put the creator's e-mail address here before the release APK (the same one as in the privacy policy).
 * While null the mail composer opens without a recipient and the user types the address — the UI works either way.
 */
export const REPORT_EMAIL: string | null = null;

/** Longer side of the photo copies attached to the e-mail (enough to identify, small enough for mail). */
const REPORT_PHOTO_MAX = 1600;

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
 * RESPONSIBILITY: Zapisuje zgloszenie.json w pamięci podręcznej aplikacji (załącznik e-maila)
 * INPUTS:         json: ReportJson — z buildReportJson (bez współrzędnych)
 * OUTPUTS:        Promise<string> — URI pliku zgloszenie.json
 * AUTHN:          none
 * AUTHZ:          none
 * BLAST RADIUS:   jeden plik w cache; poprzednie zgłoszenie jest nadpisywane
 * TOUCHES:        files (cache)
 * ERRORS:         błąd zapisu → wyjątek do wywołującego
 */
async function writeReportJson(json: ReportJson): Promise<string> {
  const file = new File(Paths.cache, 'zgloszenie.json');
  file.create({ overwrite: true });
  await file.write(JSON.stringify(json, null, 2));
  return file.uri;
}

/**
 * RESPONSIBILITY: Otwiera aplikację pocztową użytkownika z gotowym zgłoszeniem grzyba z kolekcji (treść, zgloszenie.json, zdjęcia bez EXIF)
 * INPUTS:         data: ReportData — po validateReport (zdjęcia ≤ 3, untrusted pliki); message: temat i treść z reportMessage; json: z buildReportJson
 * OUTPUTS:        'opened' (kompozytor pokazany; wysyłkę zatwierdza użytkownik) | 'no_mail_app'
 * AUTHN:          none
 * AUTHZ:          none — aplikacja nic nie wysyła sama; decyzja o wysłaniu należy do użytkownika w jego poczcie
 * BLAST RADIUS:   kopie zdjęć i zgloszenie.json w cache; e-mail wychodzi tylko po zatwierdzeniu przez użytkownika
 * TOUCHES:        files (cache), external (systemowy kompozytor e-mail)
 * ERRORS:         błąd przygotowania zdjęć/pliku → wyjątek do wywołującego
 */
export async function openReportMail(data: ReportData, message: { subject: string; body: string }, json: ReportJson): Promise<ReportOutcome> {
  if (!(await MailComposer.isAvailableAsync())) return 'no_mail_app';
  const photos = await Promise.all(data.photoUris.map(strippedCopy));
  const jsonUri = await writeReportJson(json);
  await MailComposer.composeAsync({
    recipients: REPORT_EMAIL ? [REPORT_EMAIL] : [],
    subject: message.subject,
    body: message.body,
    attachments: [...photos, jsonUri],
  });
  return 'opened';
}
