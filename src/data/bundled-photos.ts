// Metro needs static `require` calls, so the bundled sample photos are listed here.
// Metadata (species, author, licence) lives in samples.json and is shown on the licences screen.
export const BUNDLED_PHOTOS: Record<string, number> = {
  pieprznik: require('../../assets/samples/pieprznik.jpg'),
  'muchomor-zielonawy': require('../../assets/samples/muchomor-zielonawy.jpg'),
  'muchomor-czerwony': require('../../assets/samples/muchomor-czerwony.jpg'),
  helmowka: require('../../assets/samples/helmowka.jpg'),
  'borowik-usiatkowany': require('../../assets/samples/borowik-usiatkowany.jpg'),
  dzwonkowka: require('../../assets/samples/dzwonkowka.jpg'),
};
