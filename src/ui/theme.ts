/**
 * Design tokens of the "Notatnik grzybiarza" direction (design canvas v21: C2-System / D-System, typo-spec v2).
 * Change colours and type here only; screens read them through useTheme().
 */
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { TEXT_SCALES, useSettings } from '@/features/settings/settings';

export type CategoryKey = 'inedible' | 'edible' | 'poisonous' | 'deadly' | 'protected' | 'unknown';

const light = {
  paper: '#FBF5E6',
  card: '#FFFDF7',
  panel: '#F3E8CF',
  panelStrong: '#E9DCC0',
  line: '#D8C9AA',
  kraft: '#C9A574',
  /** Dashed stitch under the kraft bar, notebook margin line, outline of unselected chips. */
  barStitch: '#9C7647',
  marginLine: '#EBC3B5',
  outline: '#8C7F6A',
  ink: '#2E2A24',
  ink2: '#5A5146',
  moss: '#3E5A2A',
  mossText: '#2F5A2A',
  mustard: '#D9A032',
  maple: '#B5462B',
  plum: '#6E3A55',
  bolete: '#8B4A22',
  hazardA: '#F2C94C',
  hazardB: '#2E2A24',
  category: {
    inedible: { bg: '#DCCFB2', fg: '#3B3326' },
    edible: { bg: '#6DBE6A', fg: '#0F2E12' },
    poisonous: { bg: '#C2410C', fg: '#FFFFFF' },
    deadly: { bg: '#7F1D1D', fg: '#FFFFFF' },
    protected: { bg: '#3D6C99', fg: '#FFFFFF' },
    unknown: { bg: '#E9DCC0', fg: '#2E2A24' },
  } satisfies Record<CategoryKey, { bg: string; fg: string }>,
};

export type Palette = typeof light;

const dark: Palette = {
  paper: '#1C1A16',
  card: '#2A2620',
  panel: '#25221D',
  panelStrong: '#332E27',
  line: '#4A4236',
  kraft: '#5A4632',
  barStitch: '#8A6F4B',
  marginLine: '#5A3A33',
  outline: '#B8AC97',
  ink: '#F3EAD8',
  ink2: '#B8AC97',
  moss: '#527A39',
  mossText: '#A3CC8E',
  mustard: '#C9973A',
  maple: '#D06A48',
  plum: '#563046',
  bolete: '#DDA27A',
  hazardA: '#E5BC45',
  hazardB: '#0F0D0A',
  category: {
    inedible: { bg: '#C4B89D', fg: '#26211A' },
    edible: { bg: '#62AE5E', fg: '#0C220E' },
    poisonous: { bg: '#C4511C', fg: '#FFFFFF' },
    deadly: { bg: '#C0353F', fg: '#FFFFFF' },
    protected: { bg: '#3F74A8', fg: '#FFFFFF' },
    unknown: { bg: '#332E27', fg: '#F3EAD8' },
  },
};

/** Font family keys registered in useAppFonts(); RN needs one family per weight. */
export const FONT = {
  hand: 'ShantellSans-SemiBold',
  handBold: 'ShantellSans-Bold',
  logo: 'Caveat-Bold',
  regular: 'SourceSans3_400Regular',
  italic: 'SourceSans3_400Regular_Italic',
  semibold: 'SourceSans3_600SemiBold',
  bold: 'SourceSans3_700Bold',
} as const;

/** Type scale from typo-spec v2 (7 sizes, minimum 14 px). Line heights in px. */
export const TYPE = {
  screenTitle: { fontFamily: FONT.handBold, fontSize: 32, lineHeight: 40 },
  cardTitle: { fontFamily: FONT.handBold, fontSize: 28, lineHeight: 35 },
  section: { fontFamily: FONT.handBold, fontSize: 22, lineHeight: 28 },
  number: { fontFamily: FONT.hand, fontSize: 17, lineHeight: 22 },
  tileTitle: { fontFamily: FONT.semibold, fontSize: 19, lineHeight: 25 },
  body: { fontFamily: FONT.regular, fontSize: 17, lineHeight: 25 },
  button: { fontFamily: FONT.semibold, fontSize: 17, lineHeight: 21 },
  caption: { fontFamily: FONT.regular, fontSize: 15, lineHeight: 21 },
  latin: { fontFamily: FONT.italic, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: FONT.semibold, fontSize: 14, lineHeight: 18 },
} as const;

/** 4 px grid: screen margin 20, section gap 16, card padding 12–16. */
export const SPACE = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const RADIUS = { chip: 999, card: 12, sheet: 16 } as const;

export type TypeScale = { [K in keyof typeof TYPE]: { fontFamily: string; fontSize: number; lineHeight: number } };

/** Shape of one TYPE.* entry from the shared type scale. */
export type TypeStyle = { fontFamily: string; fontSize: number; lineHeight: number };

/** One step heavier for the „Pogrubiony tekst” option (italic has no heavier face loaded, so it stays). */
const HEAVIER: Record<string, string> = { [FONT.regular]: FONT.semibold, [FONT.semibold]: FONT.bold, [FONT.hand]: FONT.handBold };

/**
 * RESPONSIBILITY: Przelicza styl tekstu ze skali TYPE na wybrany rozmiar (i opcjonalnie grubszy krój)
 * INPUTS:         style: TypeStyle (TYPE.*); scale: mnożnik z TEXT_SCALES; bold: opcja „Pogrubiony tekst”
 * OUTPUTS:        nowy TypeStyle; rozmiar i interlinia zaokrąglone do całych px (17 → 19 → 21 dla tekstu)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none (czysta funkcja)
 * ERRORS:         none
 */
export function scaleType(style: TypeStyle, scale: number, bold = false): TypeStyle {
  return {
    fontFamily: bold ? (HEAVIER[style.fontFamily] ?? style.fontFamily) : style.fontFamily,
    fontSize: Math.round(style.fontSize * scale),
    lineHeight: Math.round(style.lineHeight * scale),
  };
}

/** TYPE scaled by the in-app text size (and one weight heavier for „Pogrubiony tekst”). */
function scaledType(scale: number, bold: boolean): TypeScale {
  const out = {} as Record<string, TypeStyle>;
  for (const [k, v] of Object.entries(TYPE)) out[k] = scaleType(v, scale, bold);
  return out as TypeScale;
}

/**
 * RESPONSIBILITY: Zwraca paletę (motyw z Ustawień: system/jasny/ciemny) i skalę tekstu przeliczoną na rozmiar z Ustawień
 * INPUTS:         none (ustawienia z useSettings, tryb systemu z useColorScheme)
 * OUTPUTS:        { colors: Palette, isDark: boolean, type: TypeScale } — `type` ma te same klucze co TYPE
 * AUTHN:          none (internal)
 * AUTHZ:          none
 * TOUCHES:        global-state (subskrypcja ustawień)
 * ERRORS:         none
 */
export function useTheme(): { colors: Palette; isDark: boolean; type: TypeScale } {
  const system = useColorScheme();
  const { colorScheme, textSize, boldText } = useSettings();
  const isDark = colorScheme === 'system' ? system === 'dark' : colorScheme === 'dark';
  const scale = TEXT_SCALES[textSize];
  const type = useMemo(() => scaledType(scale, boldText), [scale, boldText]);
  return { colors: isDark ? dark : light, isDark, type };
}
