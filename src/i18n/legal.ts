// code-guard: intentional-duplicate - short text keys (title, accepted) fuzzy-match other namespaces; texts only, no logic.
/**
 * Privacy and safety-rules screens + the four safety rules (docs/legal/teksty-w-aplikacji.md §2), shared by onboarding O4 and /zasady.
 * Safety texts: English keeps the meaning 1:1 — never soften. The privacy policy itself is in features/legal/privacy-policy(.en).json.
 */
import { defineStrings } from './i18n';

export const legalStrings = defineStrings({
  pl: {
    privacyTitle: 'Prywatność',
    rulesScreenTitle: 'Zasady',
    rulesHeading: 'Zasady bezpieczeństwa',
    acceptedOn: 'Zaakceptowano',
    fieldHeading: 'W lesie: dotykanie i zdjęcia',
    fieldIntro: 'Zalecenia Sanepidu (cytaty):',
    fieldQuotes: [
      'po powrocie z lasu należy zawsze starannie umyć ręce',
      'nawet, gdy zabierasz dziecko do lasu wyłącznie na spacer, zwracaj baczną uwagę aby nie zrywało grzybów i roślin, gdyż na rękach mogą pozostać trujące substancje',
      'Grzyby wykręcaj delikatnie z podłoża dbając o zachowanie wszystkich jego elementów potrzebnych do identyfikacji',
      'Podstawa trzonu może posiadać cechy niezbędne do identyfikacji grzyba (np. pochwę, inne zabarwienie lub charakterystyczny kształt).',
    ],
    fieldPhoto: 'Do zdjęcia spodu kapelusza nie musisz zrywać ani dotykać grzyba: połóż telefon pod kapeluszem albo odchyl go patykiem. Podstawę odsłoń patykiem.',
    fieldSource: 'Źródło: PSSE w Lubartowie, „Zapobiegajmy zatruciom grzybami” (gov.pl).',
    rule1Title: 'To atlas i kolekcja zdjęć.',
    rule1Body: 'Grzybodex pomaga poznawać grzyby.',
    rule1Strong: 'Nie służy do sprawdzania, czy grzyb można zjeść.',
    rule2Title: 'Komputer może się pomylić.',
    rule2Body: 'O jedzeniu grzyba decyduje grzyboznawca, nie aplikacja. Porada w Sanepidzie jest bezpłatna.',
    rule3Title: 'Grzyby chronione — tylko zdjęcie.',
    rule3Body: 'Nie zrywaj ich i nie niszcz. Kolekcję tworzysz ze zdjęć.',
    rule4Title: 'Twoje zdjęcia zostają w telefonie.',
    rule4Body: 'Grzyby rozpoznajemy na telefonie. Zdjęć nigdzie nie wysyłamy i nie zapisujemy na żadnym serwerze.',
  },
  en: {
    privacyTitle: 'Privacy',
    rulesScreenTitle: 'Rules',
    rulesHeading: 'Safety rules',
    acceptedOn: 'Accepted on',
    fieldHeading: 'In the forest: touching and photos',
    fieldIntro: 'Advice from Sanepid (the Polish sanitary inspection), quoted (translated):',
    fieldQuotes: [
      'after coming back from the forest, always wash your hands carefully',
      'even when you take a child to the forest only for a walk, watch closely that they do not pick mushrooms and plants, because poisonous substances can stay on the hands',
      'twist mushrooms gently out of the ground, keeping all of their parts needed for identification',
      'The base of the stem can have features needed to identify the mushroom (e.g. a volva, a different colour or a characteristic shape).',
    ],
    fieldPhoto: 'To photograph the underside of the cap you do not have to pick or touch the mushroom: put the phone under the cap or tilt the cap with a stick. Uncover the base with a stick.',
    fieldSource: 'Source: PSSE Lubartów, „Zapobiegajmy zatruciom grzybami” (gov.pl).',
    rule1Title: 'This is an atlas and a photo collection.',
    rule1Body: 'Grzybodex helps you get to know mushrooms.',
    rule1Strong: 'It is not for checking whether a mushroom can be eaten.',
    rule2Title: 'The computer can be wrong.',
    rule2Body:
      'Whether a mushroom can be eaten is decided by a mushroom expert (grzyboznawca), not by the app. Advice at Sanepid (the Polish sanitary-epidemiological station) is free of charge.',
    rule3Title: 'Protected mushrooms — photo only.',
    rule3Body: 'Do not pick or damage them. You build your collection from photos.',
    rule4Title: 'Your photos stay on your phone.',
    rule4Body: 'Mushrooms are recognised on the phone. We do not send your photos anywhere or store them on any server.',
  },
});
