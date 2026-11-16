/**
 * The 16 Polish voivodeships, official names (ustawa z 24.07.1998 o wprowadzeniu zasadniczego
 * trójstopniowego podziału terytorialnego państwa), in the order and with the ids of board O2-Region.
 */
export const VOIVODESHIPS = [
  { id: 'dolnoslaskie', name: 'dolnośląskie' },
  { id: 'kujawsko-pomorskie', name: 'kujawsko-pomorskie' },
  { id: 'lubelskie', name: 'lubelskie' },
  { id: 'lubuskie', name: 'lubuskie' },
  { id: 'lodzkie', name: 'łódzkie' },
  { id: 'malopolskie', name: 'małopolskie' },
  { id: 'mazowieckie', name: 'mazowieckie' },
  { id: 'opolskie', name: 'opolskie' },
  { id: 'podkarpackie', name: 'podkarpackie' },
  { id: 'podlaskie', name: 'podlaskie' },
  { id: 'pomorskie', name: 'pomorskie' },
  { id: 'slaskie', name: 'śląskie' },
  { id: 'swietokrzyskie', name: 'świętokrzyskie' },
  { id: 'warminsko-mazurskie', name: 'warmińsko-mazurskie' },
  { id: 'wielkopolskie', name: 'wielkopolskie' },
  { id: 'zachodniopomorskie', name: 'zachodniopomorskie' },
] as const;

export type VoivodeshipId = (typeof VOIVODESHIPS)[number]['id'];
