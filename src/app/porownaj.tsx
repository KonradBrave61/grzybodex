// code-guard: intentional-duplicate - local UI identifiers (Header, Section, styles) fuzzy-match other screens; no logic is duplicated.
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dangerOfLatin, displayName, speciesByLatin } from '@/data/atlas';
import { compareSpecies, type Comparison } from '@/data/traits';
import { atlasStrings } from '@/i18n/atlas';
import { compareStrings } from '@/i18n/compare';
import { useLang, useStrings } from '@/i18n/i18n';
import { CategoryChip } from '@/ui/category-chip';
import { openExternal } from '@/ui/link';
import { NotebookScreen } from '@/ui/screen';
import { RADIUS, SPACE, useTheme } from '@/ui/theme';

/**
 * RESPONSIBILITY: Nazwa gatunku z kategorią (atlas) albo stopniem zagrożenia (gatunek spoza atlasu z tabeli sobowtórów)
 * INPUTS:         latin: dwumian (trusted po sprawdzeniu w ekranie); onPress: otwarcie karty, gdy gatunek jest w atlasie
 * OUTPUTS:        wiersz ≥ 44 px
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function SpeciesHead({ latin }: { latin: string }) {
  const { colors, type } = useTheme();
  const lang = useLang();
  const a = useStrings(atlasStrings);
  const sp = speciesByLatin(latin);
  const danger = sp ? null : dangerOfLatin(latin);
  return (
    <Pressable
      disabled={!sp}
      onPress={() => sp && router.push({ pathname: '/gatunek/[id]', params: { id: sp.id } })}
      style={ui.head}
      accessibilityRole={sp ? 'button' : undefined}>
      <View style={ui.flex}>
        <Text style={[type.tileTitle, { color: colors.ink }]}>{displayName(latin, lang)}</Text>
        <Text style={[type.latin, { color: colors.ink2 }]}>{latin}</Text>
      </View>
      {sp && <CategoryChip raw={sp.category} conflict={sp.conflict?.category} />}
      {danger && <Text style={[type.label, { color: colors.category[danger].bg }]}>{danger === 'deadly' ? a.dangerDeadly : a.dangerPoisonous}</Text>}
    </Pressable>
  );
}

function Quote({ text }: { text: string }) {
  const { colors, type } = useTheme();
  const a = useStrings(atlasStrings);
  return <Text style={[type.body, { color: colors.ink }]}>{a.quoted(text)}</Text>;
}

/**
 * RESPONSIBILITY: Jedno pole budowy (np. trzon) dla obu gatunków, jeden pod drugim (ekran telefonu jest za wąski na kolumny)
 * INPUTS:         label: nazwa pola; rows: dwumian, dosłowne zdania albo null (brak w haśle), język hasła przetłumaczonego (albo null)
 * OUTPUTS:        karta z dwoma blokami; brak pola → „Hasło nie opisuje tej cechy.”
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function FieldCard({ label, rows }: { label: string; rows: { latin: string; texts: string[] | null; translatedFrom: string | null }[] }) {
  const { colors, type } = useTheme();
  const s = useStrings(compareStrings);
  const lang = useLang();
  return (
    <View style={[ui.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
      <Text style={[type.label, { color: colors.bolete }]}>{label}</Text>
      {rows.map((r, i) => (
        <View key={r.latin} style={[ui.side, i > 0 && { borderTopColor: colors.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
          <Text style={[type.label, { color: colors.ink2 }]}>{displayName(r.latin, lang)}</Text>
          {r.texts ? <Quote text={r.texts.join(' ')} /> : <Text style={[type.caption, { color: colors.ink2 }]}>{s.missing}</Text>}
          {r.texts && r.translatedFrom ? <Text style={[type.caption, { color: colors.ink2 }]}>{s.translatedFrom(r.translatedFrom)}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function Sentences({ c }: { c: Comparison }) {
  const { colors, type } = useTheme();
  const s = useStrings(compareStrings);
  if (c.sentences.length === 0) return null;
  const src = (latin: string) => c.sources.find((x) => x.latin === latin);
  const groups = [...new Set(c.sentences.map((x) => x.from))];
  return (
    <View style={ui.section}>
      <Text style={[type.section, { color: colors.ink }]}>{s.sentencesHeader}</Text>
      {groups.map((from) => (
        <View key={from} style={[ui.card, { backgroundColor: colors.panel, borderColor: colors.maple }]}>
          <Quote text={c.sentences.filter((x) => x.from === from).map((x) => x.text).join(' ')} />
          <Text style={[type.caption, { color: colors.ink2 }]}>{s.sentenceFrom(src(from)?.title ?? from, src(from)?.translatedFrom ?? null)}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * RESPONSIBILITY: Sekcja tekstów urzędowych (Sanepid, Lasy Państwowe) — przed zdaniami z Wikipedii
 * INPUTS:         c: Comparison (official: akapity różnic i hasła broszury)
 * OUTPUTS:        notka „krótkie fragmenty” + karty z cytatem, nagłówkiem akapitu albo nazwą gatunku, źródłem i linkiem; nic, gdy brak tekstów
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        network (tylko po dotknięciu linku)
 * ERRORS:         none
 */
function Official({ c }: { c: Comparison }) {
  const { colors, type } = useTheme();
  const s = useStrings(compareStrings);
  const lang = useLang();
  if (c.official.length === 0) return null;
  return (
    <View style={ui.section}>
      <Text style={[type.section, { color: colors.ink }]}>{s.officialHeader}</Text>
      <Text style={[type.caption, { color: colors.ink2 }]}>{s.officialExcerpt}</Text>
      {c.official.map((o, i) => (
        <View key={i} style={[ui.card, { backgroundColor: colors.panel, borderColor: colors.moss }]}>
          <Text style={[type.label, { color: colors.bolete }]}>{o.heading ?? displayName(o.about ?? '', lang)}</Text>
          <Quote text={o.text} />
          <Text style={[type.caption, { color: colors.ink2 }]}>{o.translated ? `${o.title}${s.officialTranslatedNote}` : o.title}</Text>
          <Pressable onPress={() => openExternal(o.url)} accessibilityRole="link" style={ui.link}>
            <Text style={[type.label, { color: colors.mossText, textDecorationLine: 'underline' }]}>{s.officialOpen}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function Sources({ c }: { c: Comparison }) {
  const { colors, type } = useTheme();
  const s = useStrings(compareStrings);
  if (c.sources.length === 0) return null;
  return (
    <View style={ui.section}>
      <Text style={[type.caption, { color: colors.ink2 }]}>{s.source(c.sources[0].license)}</Text>
      {c.sources.map((src) => (
        <Pressable key={src.latin} onPress={() => openExternal(src.url)} accessibilityRole="link" style={ui.link}>
          <Text style={[type.label, { color: colors.mossText, textDecorationLine: 'underline' }]}>{s.openArticle(src.title)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * RESPONSIBILITY: Ekran „Jak odróżnić”: dwa gatunki — zdania o różnicach z Wikipedii, potem cechy budowy pole po polu
 * INPUTS:         parametry trasy a, b: dwumiany (untrusted — brak/nieznane → komunikat o braku opisu)
 * OUTPUTS:        przewijany ekran tylko do czytania; ostrzeżenie o próbowaniu na surowo (Sanepid); linki do wersji haseł
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        network (tylko po dotknięciu linku do hasła)
 * ERRORS:         brak danych → tekst noData zamiast pól
 */
export default function CompareScreen() {
  const { colors, type } = useTheme();
  const s = useStrings(compareStrings);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ a?: string; b?: string }>();
  const a = String(params.a ?? '');
  const b = String(params.b ?? '');
  const lang = useLang();
  const c = useMemo(() => compareSpecies(a, b, lang), [a, b, lang]);
  const complete = c.sources.length === 2 || c.official.length > 0;
  const from = (latin: string) => c.sources.find((x) => x.latin === latin)?.translatedFrom ?? null;
  return (
    <NotebookScreen title={s.title} onBack={() => router.back()}>
      <ScrollView contentContainerStyle={[ui.page, { paddingBottom: SPACE.xxxl + insets.bottom }]}>
        <View style={ui.section}>
          <SpeciesHead latin={a} />
          <Text style={[type.label, { color: colors.ink2 }]}>{s.versus}</Text>
          <SpeciesHead latin={b} />
        </View>
        <Text style={[type.body, { color: colors.ink }]}>{s.intro}</Text>
        {s.polishOnly ? <Text style={[type.caption, { color: colors.ink2 }]}>{s.polishOnly}</Text> : null}
        {!complete && (
          <View style={[ui.card, { backgroundColor: colors.panel, borderColor: colors.ink }]} accessibilityRole="alert">
            <Text style={[type.body, { color: colors.ink }]}>{s.noData}</Text>
          </View>
        )}
        <Official c={c} />
        <Sentences c={c} />
        <View style={[ui.card, { backgroundColor: colors.panel, borderColor: colors.category.poisonous.bg }]}>
          <Text style={[type.tileTitle, { color: colors.ink }]}>{s.tasteTitle}</Text>
          <Text style={[type.body, { color: colors.ink }]}>{s.tasteBody}</Text>
          <Text style={[type.caption, { color: colors.ink2 }]}>{s.tasteSource}</Text>
        </View>
        {c.fields.length > 0 && (
          <View style={ui.section}>
            <Text style={[type.section, { color: colors.ink }]}>{s.fieldsHeader}</Text>
            {c.fields.map((f) => (
              <FieldCard key={f.key} label={s.fields[f.key]} rows={[{ latin: a, texts: f.a, translatedFrom: from(a) }, { latin: b, texts: f.b, translatedFrom: from(b) }]} />
            ))}
          </View>
        )}
        <Text style={[type.body, { color: colors.ink }]}>{s.expert}</Text>
        <Sources c={c} />
      </ScrollView>
    </NotebookScreen>
  );
}

const ui = StyleSheet.create({
  page: { paddingLeft: 28, paddingRight: SPACE.xl, paddingTop: SPACE.l, gap: SPACE.l },
  section: { gap: SPACE.s },
  flex: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  card: { borderWidth: 1, borderRadius: RADIUS.card, padding: 12, gap: 6 },
  side: { gap: 4, paddingTop: 6 },
  link: { minHeight: 44, justifyContent: 'center' },
});
