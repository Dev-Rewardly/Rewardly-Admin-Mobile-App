// constants/design.ts
// Admin app design tokens. NAVY is structure and action; neutrals carry
// everything else. Status colours appear only as small dots and banners.
// Screens paint colours only from here; `npm run tokens:check` enforces it.
//
// Existing token names are kept so nothing outside the screens breaks.

export const color = {
  brand: '#1E3A8A',
  brandPressed: '#16306F',
  brandTint: '#E8ECF6',
  onBrand: '#FFFFFF',

  background: '#FFFFFF',
  surface: '#F6F7F9',
  surfaceMuted: '#F1F2F5',
  skeleton: '#EEF0F3',
  border: '#E6E8EC',
  borderStrong: '#DADDE3',
  divider: '#F0F1F4',

  textPrimary: '#0E1525',
  textBody: '#3E4757',
  textSecondary: '#5B6475',
  /** Icons and placeholders only — below 4.5:1 for body text. */
  textTertiary: '#8A92A0',

  success: '#0F6E56',
  successSurface: '#EEF6F3',
  warning: '#B7791F',
  error: '#A32D2D',
  errorPressed: '#8E2424',
  errorText: '#8E2424',
  errorSurface: '#FBF1F1',
  errorHover: '#FBF6F6',

  adminBadge: '#0E1525',
  onAdminBadge: '#FFFFFF',
  scrim: 'rgba(14,21,37,0.42)',
  toast: '#0E1525',
  onToast: '#FFFFFF',
} as const;

/** Loaded in app/_layout.tsx. Android ignores fontWeight on custom fonts, so each weight is its own family. */
export const font = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
  mono: 'GeistMono_600SemiBold',
} as const;

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { xs: 5, sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

/** Minimum touch target. Controls are 44 (in-card) or 48–52 (primary). */
export const hit = { min: 44, comfortable: 48, large: 52 } as const;

export const type = {
  largeTitle: { fontFamily: font.semibold, fontSize: 32, lineHeight: 36, letterSpacing: -0.9 },
  title: { fontFamily: font.semibold, fontSize: 28, lineHeight: 33, letterSpacing: -0.7 },
  sheetTitle: { fontFamily: font.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  headline: { fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 23 },
  bodySmall: { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  button: { fontFamily: font.semibold, fontSize: 15, lineHeight: 20 },
  buttonLarge: { fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
  label: { fontFamily: font.medium, fontSize: 14, lineHeight: 20 },
  meta: { fontFamily: font.regular, fontSize: 13.5, lineHeight: 19 },
  caption: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  micro: { fontFamily: font.medium, fontSize: 12, lineHeight: 16 },
  tab: { fontFamily: font.medium, fontSize: 11.5 },
  badge: { fontFamily: font.semibold, fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase' as const },
  amount: { fontFamily: font.mono, fontSize: 15.5, lineHeight: 22, fontVariant: ['tabular-nums' as const] },
};

export const shadow = {
  sm: {
    shadowColor: '#0E1525',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  lg: {
    shadowColor: '#0E1525',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} as const;
