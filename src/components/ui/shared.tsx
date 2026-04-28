import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator, Animated, Easing, StyleSheet, Text,
  TouchableOpacity, View, type ViewStyle, type StyleProp,
} from 'react-native';
import { colors, radii, shadows, spacing, typography, getStatusConfig, money } from '../../constants/theme';

// ─────────────────────────────────────────────────────────
// StatusBadge — small status pill
// ─────────────────────────────────────────────────────────

export function StatusBadge({ status, size = 'md' }: { status?: string | null; size?: 'sm' | 'md' }) {
  const cfg = getStatusConfig(status);
  const sm  = size === 'sm';
  return (
    <View
      style={[
        s.badge,
        { backgroundColor: cfg.bg },
        sm && { paddingHorizontal: 8, paddingVertical: 2 },
      ]}
      accessibilityLabel={`الحالة: ${cfg.label}`}
    >
      <View style={[s.badgeDot, { backgroundColor: cfg.color }]} />
      <Text style={[s.badgeText, { color: cfg.color }, sm && { fontSize: 11 }]}>{cfg.label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────
// Card — base content container
// ─────────────────────────────────────────────────────────

export function Card({ children, style, onPress, padded = true, disabled = false }: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
  disabled?: boolean;
}) {
  const inner = <View style={[s.card, padded && s.cardPadded, style]}>{children}</View>;
  if (!onPress) return inner;
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled}
      style={disabled ? { opacity: 0.6 } : undefined}
    >
      {inner}
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────
// StatCard — single number + label
// ─────────────────────────────────────────────────────────

export function StatCard({ label, value, color: vc, subtitle, onPress }: {
  label: string; value: string | number; color?: string; subtitle?: string; onPress?: () => void;
}) {
  return (
    <Card onPress={onPress} style={s.statCard}>
      <Text style={s.statLabel} numberOfLines={1}>{label}</Text>
      <Text style={[s.statValue, vc ? { color: vc } : null]} numberOfLines={1}>
        {typeof value === 'number' ? value.toLocaleString('ar-SA') : value}
      </Text>
      {subtitle ? <Text style={s.statSub} numberOfLines={1}>{subtitle}</Text> : null}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
// MoneyCard — money amount with semantic variant
// ─────────────────────────────────────────────────────────

export function MoneyCard({ label, amount, variant = 'neutral' }: {
  label: string; amount: number; variant?: 'income' | 'expense' | 'neutral' | 'warning';
}) {
  const colorMap = {
    income: colors.success,
    expense: colors.danger,
    warning: colors.warning,
    neutral: colors.text,
  };
  return <StatCard label={label} value={money(amount)} color={colorMap[variant]} />;
}

// ─────────────────────────────────────────────────────────
// SectionHeader
// ─────────────────────────────────────────────────────────

export function SectionHeader({ title, action, onAction }: {
  title: string; action?: string; onAction?: () => void;
}) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {action && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={s.sectionAction}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────
// InfoRow — label/value pair for details screens
// ─────────────────────────────────────────────────────────

export function InfoRow({ label, value, valueColor, isLast = false }: {
  label: string;
  value?: string | number | null;
  valueColor?: string;
  isLast?: boolean;
}) {
  return (
    <View style={[s.infoRow, isLast && { borderBottomWidth: 0 }]}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, valueColor ? { color: valueColor } : null]} numberOfLines={2}>
        {value ?? '-'}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────
// Button — primary action button with variants
// ─────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: string;
}) {
  const vMap: Record<ButtonVariant, { bg: string; text: string; border?: string }> = {
    primary:   { bg: colors.primary, text: colors.textInverse },
    secondary: { bg: 'transparent', text: colors.primary, border: colors.primary },
    danger:    { bg: colors.danger,  text: colors.textInverse },
    success:   { bg: colors.success, text: colors.textInverse },
    ghost:     { bg: 'transparent',  text: colors.textSecondary },
  };
  const szMap: Record<ButtonSize, { h: number; px: number; fs: number }> = {
    sm: { h: 36, px: 14, fs: 13 },
    md: { h: 44, px: 20, fs: 15 },
    lg: { h: 52, px: 24, fs: 16 },
  };
  const v = vMap[variant];
  const sz = szMap[size];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        {
          height: sz.h,
          paddingHorizontal: sz.px,
          backgroundColor: v.bg,
          borderRadius: radii.md,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          opacity: isDisabled ? 0.5 : 1,
        },
        v.border ? { borderWidth: 1.5, borderColor: v.border } : null,
        fullWidth ? { width: '100%' } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.text} />
      ) : (
        <>
          {icon ? <Text style={{ fontSize: sz.fs + 2 }}>{icon}</Text> : null}
          <Text style={{ fontSize: sz.fs, fontWeight: '600', color: v.text }}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────
// EmptyState — friendly empty placeholder
// ─────────────────────────────────────────────────────────

export function EmptyState({
  title = 'لا توجد بيانات',
  message,
  actionLabel,
  onAction,
  icon = '📋',
}: {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: string;
}) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIconWrap}>
        <Text style={{ fontSize: 40 }}>{icon}</Text>
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      {message ? <Text style={s.emptyMsg}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity style={s.emptyBtn} onPress={onAction} activeOpacity={0.85}>
          <Text style={s.emptyBtnTxt}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────
// LoadingState — full-screen loading
// ─────────────────────────────────────────────────────────

export function LoadingState({ message = 'جاري التحميل...' }: { message?: string }) {
  return (
    <View style={s.center} accessibilityRole="progressbar" accessibilityLabel={message}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={s.loadingTxt}>{message}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────
// ErrorState — full-screen error with retry
// ─────────────────────────────────────────────────────────

export function ErrorState({
  message = 'حدث خطأ',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={s.empty}>
      <View style={[s.emptyIconWrap, { backgroundColor: colors.dangerBg }]}>
        <Text style={{ fontSize: 40 }}>⚠️</Text>
      </View>
      <Text style={s.emptyTitle}>خطأ في التحميل</Text>
      <Text style={s.emptyMsg}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity style={s.emptyBtn} onPress={onRetry} activeOpacity={0.85}>
          <Text style={s.emptyBtnTxt}>إعادة المحاولة</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────
// Divider — horizontal separator
// ─────────────────────────────────────────────────────────

export function Divider({ vSpacing = spacing.md }: { vSpacing?: number }) {
  return <View style={{ height: 1, backgroundColor: colors.borderLight, marginVertical: vSpacing }} />;
}

// ─────────────────────────────────────────────────────────
// Skeleton — animated placeholder for loading states
// ─────────────────────────────────────────────────────────

export function Skeleton({
  width = '100%',
  height = 16,
  radius = radii.sm,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius: radius,
          backgroundColor: colors.surfaceSubtle,
          opacity,
        },
        style,
      ]}
    />
  );
}

// ─────────────────────────────────────────────────────────
// SkeletonCard — Card-shaped skeleton for list items
// ─────────────────────────────────────────────────────────

export function SkeletonCard() {
  return (
    <View style={s.card}>
      <View style={s.cardPadded}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Skeleton width={44} height={44} radius={22} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="40%" height={12} />
          </View>
          <Skeleton width={48} height={20} radius={radii.full} />
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────
// SkeletonList — list of skeleton cards
// ─────────────────────────────────────────────────────────

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <View style={{ padding: spacing.lg, gap: spacing.sm }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────
// IconButton — round icon-only button (for headers etc)
// ─────────────────────────────────────────────────────────

export function IconButton({
  icon,
  onPress,
  variant = 'subtle',
  size = 36,
  accessibilityLabel,
}: {
  icon: string;
  onPress: () => void;
  variant?: 'subtle' | 'primary' | 'ghost';
  size?: number;
  accessibilityLabel?: string;
}) {
  const v = {
    subtle:  { bg: colors.surfaceSubtle, color: colors.text, border: colors.borderLight },
    primary: { bg: colors.primary, color: colors.textInverse, border: colors.primary },
    ghost:   { bg: 'transparent', color: colors.text, border: 'transparent' },
  }[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: v.bg,
        borderWidth: variant === 'ghost' ? 0 : 1,
        borderColor: v.border,
      }}
    >
      <Text style={{ fontSize: Math.round(size * 0.5), color: v.color }}>{icon}</Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────

const s = StyleSheet.create({
  badge:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.full },
  badgeDot:   { width: 6, height: 6, borderRadius: 3 },
  badgeText:  { ...typography.small },

  card:       { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderLight, ...shadows.sm },
  cardPadded: { padding: spacing.lg },

  statCard:  { flex: 1, minWidth: 130 },
  statLabel: { ...typography.caption, color: colors.textSecondary, textAlign: 'right', marginBottom: 4 },
  statValue: { ...typography.number, color: colors.text, textAlign: 'right' },
  statSub:   { ...typography.small, color: colors.textTertiary, textAlign: 'right', marginTop: 2 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  sectionTitle:  { ...typography.h4, color: colors.text, textAlign: 'right' },
  sectionAction: { ...typography.captionBold, color: colors.primary },

  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  infoLabel: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  infoValue: { ...typography.body, color: colors.text, flex: 2, textAlign: 'right' },

  empty:        { alignItems: 'center', paddingVertical: spacing['5xl'], paddingHorizontal: spacing['2xl'] },
  emptyIconWrap:{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surfaceSubtle, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  emptyTitle:   { ...typography.h3, color: colors.text, marginBottom: spacing.sm, textAlign: 'center' },
  emptyMsg:     { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  emptyBtn:     { marginTop: spacing.xl, paddingHorizontal: spacing['2xl'], paddingVertical: spacing.md, backgroundColor: colors.primary, borderRadius: radii.md },
  emptyBtnTxt:  { ...typography.bodyBold, color: colors.textInverse },

  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing['5xl'], gap: spacing.lg },
  loadingTxt: { ...typography.caption, color: colors.textSecondary },
});
