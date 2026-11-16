// code-guard: intentional-duplicate - test names fuzzy-match production identifiers; no logic is duplicated.
import { mapStrings } from '@/i18n/map';

const { pl, en } = mapStrings;

describe('map texts', () => {
  it('turns stored pack error codes into text in each language', () => {
    expect(pl.packError({ code: 'unpublished' })).toBe('Paczki map nie są jeszcze opublikowane.');
    expect(en.packError({ code: 'unpublished' })).toBe('Map packs are not published yet.');
    expect(pl.packError({ code: 'network' })).toBe('Pobieranie przerwane (sieć?). Spróbuj ponownie.');
    expect(en.packError({ code: 'corrupt' })).toBe('The map file is damaged. Download it again.');
    expect(pl.packError({ code: 'space', need: 1.24e9, free: 68e6 })).toMatch(/^Za mało miejsca: potrzeba (ok\. )?1,2 GB, wolne 68 MB\.$/);
    expect(en.packError({ code: 'space', need: 1.24e9, free: 68e6 })).toMatch(/^Not enough space: needs (approx\. )?1\.2 GB, free 68 MB\.$/);
    expect(en.packError({ code: 'space' })).toBe('Not enough space on the phone.');
    expect(en.packError({ code: 'failed' })).toBe('The download failed. Try again.');
  });

  it('explains rejected spots and keeps the Polish wording', () => {
    expect(pl.spotError('position')).toBe('Brak położenia. Poczekaj na GPS.');
    expect(pl.spotError('nameLong')).toBe('Nazwa może mieć najwyżej 60 znaków.');
    expect(en.spotError('nameLong')).toBe('The name can have at most 60 characters.');
    expect(en.spotError('noteLong')).toBe('The note can have at most 200 characters.');
  });

  it('builds directions and counts', () => {
    expect(`410 m ${pl.toward('północny zachód')}`).toBe('410 m na północny zachód');
    expect(`410 m ${en.toward('north-west')}`).toBe('410 m north-west');
    expect([pl.savedCount(1), pl.savedCount(3), pl.savedCount(5)]).toEqual(['1 zapisana', '3 zapisane', '5 zapisanych']);
    expect(en.savedCount(3)).toBe('3 saved');
    expect(en.demoSpots).toHaveLength(pl.demoSpots.length);
  });
});
