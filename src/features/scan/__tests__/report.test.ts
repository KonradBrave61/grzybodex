// code-guard: intentional-duplicate - test fixture names fuzzy-match production identifiers; no logic is duplicated.
import { REPORT_EMAIL, UNCATALOGUED_BELOW } from '../report';

jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: {} }));
jest.mock('expo-mail-composer', () => ({}));
jest.mock('expo-file-system', () => ({ File: class {}, Paths: {} }));

describe('uncatalogued mushroom report', () => {
  it('uses the threshold measured on the open-set test (0.9)', () => {
    expect(UNCATALOGUED_BELOW).toBe(0.9);
  });

  it('has no recipient yet — the creator address is still to be filled in before the APK', () => {
    expect(REPORT_EMAIL).toBeNull();
  });
});
