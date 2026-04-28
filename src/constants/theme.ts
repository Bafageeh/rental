// ─────────────────────────────────────────────────────────
// Color Palette — base color tokens
// ─────────────────────────────────────────────────────────

export const palette = {
  teal: {
    50: '#EDFAF6', 100: '#C9F0E3', 200: '#8FE0C5', 300: '#4FCBA3',
    400: '#22B585', 500: '#0F9B6F', 600: '#0A7D5A', 700: '#065F44',
    800: '#03412F', 900: '#01231A',
  },
  amber: {
    50: '#FFF8EB', 100: '#FEECBF', 200: '#FADA82', 300: '#F5C549',
    400: '#EAAD1C', 500: '#D49610', 600: '#AB770A', 700: '#825906',
  },
  gray: {
    50: '#F7F6F4', 100: '#EDECE9', 200: '#DDDBD6', 300: '#C4C1BB',
    400: '#A09C95', 500: '#7A766F', 600: '#5E5B55', 700: '#44423D',
    800: '#2D2B28', 900: '#1A1917',
  },
  red:    { 50: '#FEF2F2', 100: '#FDE8E8', 500: '#DC3545', 700: '#9B1C2C' },
  green:  { 50: '#F0FDF4', 100: '#E8F5E9', 500: '#22A356', 700: '#1A7A40' },
  blue:   { 50: '#EFF6FF', 100: '#E3F2FD', 500: '#1976D2', 700: '#0D47A1' },
  orange: { 50: '#FFF7ED', 100: '#FFF3E0', 500: '#EF6C00', 700: '#B74D00' },
  white: '#FFFFFF',
  black: '#0F0E0D',
} as const;

// ─────────────────────────────────────────────────────────
// Semantic Colors — what consumers should reference
// ─────────────────────────────────────────────────────────

export const colors = {
  background: palette.gray[50],
  surface: palette.white,
  surfaceElevated: palette.white,
  surfaceSubtle: palette.gray[100],
  surfaceMuted: palette.gray[50],

  primary: palette.teal[500],
  primaryDark: palette.teal[700],
  primaryLight: palette.teal[50],
  primaryMuted: palette.teal[100],

  accent: palette.amber[400],
  accentDark: palette.amber[600],
  accentLight: palette.amber[50],

  text: palette.gray[900],
  textSecondary: palette.gray[500],
  textTertiary: palette.gray[400],
  textInverse: palette.white,

  border: palette.gray[200],
  borderLight: palette.gray[100],
  borderFocus: palette.teal[300],

  success: palette.green[500],
  successBg: palette.green[100],
  successDark: palette.green[700],
  danger: palette.red[500],
  dangerBg: palette.red[100],
  dangerDark: palette.red[700],
  warning: palette.amber[500],
  warningBg: palette.amber[50],
  warningDark: palette.amber[700],
  info: palette.blue[500],
  infoBg: palette.blue[100],
  infoDark: palette.blue[700],

  paid: palette.green[500],    paidBg: palette.green[100],
  due: palette.amber[500],     dueBg: palette.amber[50],
  overdue: palette.red[500],   overdueBg: palette.red[100],
  active: palette.teal[500],   activeBg: palette.teal[50],
  ended: palette.gray[400],    endedBg: palette.gray[100],

  // Overlay colors for modals, scrims
  overlay: 'rgba(15, 14, 13, 0.45)',
  overlayLight: 'rgba(15, 14, 13, 0.2)',
} as const;

// ─────────────────────────────────────────────────────────
// Typography Scale
// ─────────────────────────────────────────────────────────

export const typography = {
  h1:          { fontSize: 28, fontWeight: '700' as const, lineHeight: 36, letterSpacing: -0.5 },
  h2:          { fontSize: 22, fontWeight: '700' as const, lineHeight: 30, letterSpacing: -0.3 },
  h3:          { fontSize: 18, fontWeight: '600' as const, lineHeight: 26 },
  h4:          { fontSize: 16, fontWeight: '600' as const, lineHeight: 24 },
  body:        { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyBold:    { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  caption:     { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  captionBold: { fontSize: 13, fontWeight: '600' as const, lineHeight: 18 },
  small:       { fontSize: 11, fontWeight: '500' as const, lineHeight: 16 },
  number:      { fontSize: 24, fontWeight: '700' as const, lineHeight: 32, letterSpacing: -0.5 },
  numberLarge: { fontSize: 32, fontWeight: '800' as const, lineHeight: 40, letterSpacing: -1 },
  numberSmall: { fontSize: 18, fontWeight: '700' as const, lineHeight: 24, letterSpacing: -0.3 },
} as const;

// ─────────────────────────────────────────────────────────
// Spacing & Radius & Shadows
// ─────────────────────────────────────────────────────────

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20,
  '2xl': 24, '3xl': 32, '4xl': 40, '5xl': 48,
} as const;

export const radii = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, full: 9999,
} as const;

export const shadows = {
  none: {},
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,  elevation: 1 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,  elevation: 3 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 6 },
  xl: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.10, shadowRadius: 24, elevation: 10 },
} as const;

// ─────────────────────────────────────────────────────────
// Layout Constants
// ─────────────────────────────────────────────────────────

export const layout = {
  screenPadding: spacing.lg,
  cardPadding: spacing.lg,
  tabBarHeight: 60,
  headerHeight: 56,
  inputHeight: 48,
  buttonHeight: 50,
  hitSlop: { top: 8, bottom: 8, left: 8, right: 8 },
} as const;

// ─────────────────────────────────────────────────────────
// Status Configuration
// ─────────────────────────────────────────────────────────

export const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  paid:        { label: 'مدفوعة',  color: colors.paid,    bg: colors.paidBg    },
  due:         { label: 'مستحقة',  color: colors.due,     bg: colors.dueBg     },
  overdue:     { label: 'متأخرة',  color: colors.overdue, bg: colors.overdueBg },
  active:      { label: 'نشط',     color: colors.active,  bg: colors.activeBg  },
  ended:       { label: 'منتهي',   color: colors.ended,   bg: colors.endedBg   },
  cancelled:   { label: 'ملغى',    color: colors.danger,  bg: colors.dangerBg  },
  available:   { label: 'متاحة',   color: colors.success, bg: colors.successBg },
  rented:      { label: 'مؤجرة',   color: colors.info,    bg: colors.infoBg    },
  maintenance: { label: 'صيانة',   color: colors.warning, bg: colors.warningBg },
  reserved:    { label: 'محجوزة',  color: colors.accent,  bg: colors.dueBg     },
  pending:     { label: 'قيد المراجعة', color: colors.info, bg: colors.infoBg },
  approved:    { label: 'معتمد',   color: colors.success, bg: colors.successBg },
  rejected:    { label: 'مرفوض',   color: colors.danger,  bg: colors.dangerBg  },
};

export function getStatusConfig(status?: string | null) {
  return statusConfig[status ?? ''] ?? { label: status || '-', color: colors.textSecondary, bg: colors.surfaceSubtle };
}

// ─────────────────────────────────────────────────────────
// Number / Money Formatting Helpers
// ─────────────────────────────────────────────────────────

export function money(value: unknown): string {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '0 ريال';
  return `${Math.round(n).toLocaleString('ar-SA')} ريال`;
}

export function moneyShort(value: unknown): string {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '0 ريال';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} مليون ريال`;
  if (Math.abs(n) >= 1_000)     return `${(n / 1_000).toFixed(0)} ألف ريال`;
  return `${Math.round(n)} ريال`;
}

export function moneyCompact(value: unknown): string {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '0 ر.س';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}م ر.س`;
  if (Math.abs(n) >= 1_000)     return `${(n / 1_000).toFixed(0)}ك ر.س`;
  return `${Math.round(n).toLocaleString('ar-SA')} ر.س`;
}

export function formatNumber(value: unknown): string {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('ar-SA');
}

export function formatDate(value?: string | null): string {
  if (!value) return '-';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString('ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return value;
  }
}


// ─────────────────────────────────────────────────────────
// Backward-compatible Expo template exports
// بعض ملفات Expo القديمة في المشروع تستخدم هذه الأسماء بحروف كبيرة.
// نُبقيها هنا كطبقة توافق بدون تغيير التصميم الحالي.
// ─────────────────────────────────────────────────────────

export const Colors = {
  light: {
    ...colors,
    background: colors.background,
    backgroundElement: colors.surface,
    backgroundSelected: colors.primaryLight,
    text: colors.text,
    textSecondary: colors.textSecondary,
    tint: colors.primary,
    icon: colors.textSecondary,
    tabIconDefault: colors.textSecondary,
    tabIconSelected: colors.primary,
  },
  dark: {
    ...colors,
    background: palette.gray[900],
    backgroundElement: palette.gray[800],
    backgroundSelected: palette.gray[700],
    surface: palette.gray[800],
    surfaceElevated: palette.gray[800],
    surfaceSubtle: palette.gray[700],
    text: palette.white,
    textSecondary: palette.gray[200],
    textTertiary: palette.gray[300],
    border: palette.gray[700],
    tint: colors.primary,
    icon: palette.gray[300],
    tabIconDefault: palette.gray[300],
    tabIconSelected: colors.primary,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 20,
  six: 24,
  seven: 32,
  eight: 40,
  xs: spacing.xs,
  sm: spacing.sm,
  md: spacing.md,
  lg: spacing.lg,
  xl: spacing.xl,
} as const;

export const Fonts = {
  mono: 'SpaceMono',
} as const;

export const MaxContentWidth = 960;
export const BottomTabInset = 80;
