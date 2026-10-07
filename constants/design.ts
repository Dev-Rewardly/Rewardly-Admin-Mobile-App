// constants/design.ts
// Admin app design tokens. Same palette as the Customer app (NAVY is structure
// and action; GOLD is value and only value) so the two read as one family. The
// Admin app is told apart by its "Admin" marker, not by a different palette.
// Screens paint colours only from here; `npm run tokens:check` enforces it.

export const color = {
  brand: '#1E3A8A',
  onBrand: '#FFFFFF',
  background: '#FFFFFF',
  surface: '#F6F8FB',
  border: '#E6EBF2',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  success: '#0F6E56',
  error: '#A32D2D',
  errorSurface: '#FDF1F1',
  adminBadge: '#0F172A',
  onAdminBadge: '#FFFFFF',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const type = {
  title: { fontSize: 24, fontWeight: '700' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  label: { fontSize: 14, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
};
