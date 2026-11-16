// Expected voivodeships are the official seats (capital cities) from the 1998 act, plus points outside Poland.
import { voivodeshipAt } from '../region-detect';

const SEATS: [string, number, number, string][] = [
  ['Wrocław', 51.1079, 17.0385, 'dolnoslaskie'],
  ['Toruń', 53.0138, 18.5984, 'kujawsko-pomorskie'],
  ['Lublin', 51.2465, 22.5684, 'lubelskie'],
  ['Zielona Góra', 51.9356, 15.5062, 'lubuskie'],
  ['Łódź', 51.7592, 19.456, 'lodzkie'],
  ['Kraków', 50.0647, 19.945, 'malopolskie'],
  ['Warszawa', 52.2297, 21.0122, 'mazowieckie'],
  ['Opole', 50.6751, 17.9213, 'opolskie'],
  ['Rzeszów', 50.0412, 21.9991, 'podkarpackie'],
  ['Białystok', 53.1325, 23.1688, 'podlaskie'],
  ['Gdańsk', 54.352, 18.6466, 'pomorskie'],
  ['Katowice', 50.2649, 19.0238, 'slaskie'],
  ['Kielce', 50.8661, 20.6286, 'swietokrzyskie'],
  ['Olsztyn', 53.7784, 20.4801, 'warminsko-mazurskie'],
  ['Poznań', 52.4064, 16.9252, 'wielkopolskie'],
  ['Szczecin', 53.4285, 14.5528, 'zachodniopomorskie'],
];

describe('voivodeshipAt', () => {
  it.each(SEATS)('%s', (_name, latitude, longitude, id) => {
    expect(voivodeshipAt({ latitude, longitude })).toBe(id);
  });

  it('returns null outside Poland and for bad input', () => {
    expect(voivodeshipAt({ latitude: 52.52, longitude: 13.405 })).toBeNull(); // Berlin
    expect(voivodeshipAt({ latitude: 50.0755, longitude: 14.4378 })).toBeNull(); // Praga
    expect(voivodeshipAt({ latitude: 55.2, longitude: 18.0 })).toBeNull(); // Bałtyk
    expect(voivodeshipAt({ latitude: Number.NaN, longitude: 19 })).toBeNull();
  });
});
