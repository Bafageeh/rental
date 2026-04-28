import { Ionicons } from '@expo/vector-icons';
import React, { type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radii, shadows, spacing, typography } from '../../constants/theme';

export function ScreenHero({
  eyebrow,
  title,
  subtitle,
  icon = 'sparkles-outline',
  tone = 'dark',
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icon?: any;
  tone?: 'dark' | 'primary' | 'light';
}) {
  const isLight = tone === 'light';
  const backgroundColor = tone === 'primary' ? colors.primaryDark : isLight ? colors.surface : '#111827';
  const titleColor = isLight ? colors.text : colors.textInverse;
  const subtitleColor = isLight ? colors.textSecondary : 'rgba(255,255,255,0.78)';
  const eyebrowColor = tone === 'primary' ? '#D1FAE5' : isLight ? colors.primary : '#A7F3D0';

  return (
    <View style={[styles.hero, { backgroundColor }, isLight ? styles.lightHero : null]}>
      <View style={[styles.heroIcon, isLight ? styles.lightHeroIcon : null]}>
        <Ionicons name={icon} size={26} color={isLight ? colors.primary : colors.textInverse} />
      </View>
      <View style={styles.heroCopy}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: eyebrowColor }]}>{eyebrow}</Text> : null}
        <Text style={[styles.heroTitle, { color: titleColor }]}>{title}</Text>
        {subtitle ? <Text style={[styles.heroSubtitle, { color: subtitleColor }]}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'بحث...',
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.searchWrap}>
      <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={styles.searchInput}
        textAlign="right"
        returnKeyType="search"
      />
    </View>
  );
}

export function PhaseSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export function ActionTile({
  icon,
  title,
  subtitle,
  onPress,
  adminOnly = false,
}: {
  icon: any;
  title: string;
  subtitle?: string;
  onPress: () => void;
  adminOnly?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.tile}
      onPress={onPress}
      activeOpacity={0.76}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.tileTopRow}>
        <View style={styles.tileIcon}>
          <Ionicons name={icon} size={21} color={colors.primaryDark} />
        </View>
        <Ionicons name="chevron-back" size={18} color={colors.textTertiary} />
      </View>
      <View style={styles.tileTextWrap}>
        <View style={styles.tileTitleRow}>
          {adminOnly ? <Text style={styles.adminPill}>مدير</Text> : null}
          <Text style={styles.tileTitle}>{title}</Text>
        </View>
        {subtitle ? <Text style={styles.tileSubtitle}>{subtitle}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

export function MiniAction({
  icon,
  label,
  onPress,
}: {
  icon: any;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.miniAction} onPress={onPress} activeOpacity={0.78} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={18} color={colors.primaryDark} />
      <Text style={styles.miniActionText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Stepper({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <View style={styles.stepper}>
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <View key={label} style={styles.stepItem}>
            <View style={[styles.stepCircle, done || active ? styles.stepCircleActive : null]}>
              <Text style={[styles.stepNumber, done || active ? styles.stepNumberActive : null]}>{index + 1}</Text>
            </View>
            <Text style={[styles.stepLabel, active ? styles.stepLabelActive : null]} numberOfLines={1}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function Notice({
  icon = 'information-circle-outline',
  title,
  message,
  tone = 'info',
  style,
}: {
  icon?: any;
  title?: string;
  message: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  style?: StyleProp<ViewStyle>;
}) {
  const cfg = {
    info: { bg: colors.infoBg, fg: colors.infoDark, border: '#BFDBFE' },
    success: { bg: colors.successBg, fg: colors.successDark, border: '#BBF7D0' },
    warning: { bg: colors.warningBg, fg: colors.warningDark, border: '#FDE68A' },
    danger: { bg: colors.dangerBg, fg: colors.dangerDark, border: '#FECACA' },
  }[tone];

  return (
    <View style={[styles.notice, { backgroundColor: cfg.bg, borderColor: cfg.border }, style]}>
      <Ionicons name={icon} size={20} color={cfg.fg} />
      <View style={{ flex: 1 }}>
        {title ? <Text style={[styles.noticeTitle, { color: cfg.fg }]}>{title}</Text> : null}
        <Text style={[styles.noticeText, { color: cfg.fg }]}>{message}</Text>
      </View>
    </View>
  );
}

export function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaPill}>
      <Text style={styles.metaValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii['2xl'],
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  lightHero: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.xl,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightHeroIcon: {
    backgroundColor: colors.primaryLight,
  },
  heroCopy: { flex: 1 },
  eyebrow: { ...typography.small, fontWeight: '900', textAlign: 'right', marginBottom: 4 },
  heroTitle: { ...typography.h2, fontWeight: '900', textAlign: 'right' },
  heroSubtitle: { ...typography.caption, textAlign: 'right', marginTop: 6, lineHeight: 20 },

  searchWrap: {
    minHeight: 48,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.md,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    ...typography.body,
    paddingVertical: 10,
  },

  section: { marginBottom: spacing.xl },
  sectionHeader: { marginBottom: spacing.sm },
  sectionTitle: { ...typography.h4, color: colors.text, textAlign: 'right' },
  sectionSubtitle: { ...typography.caption, color: colors.textSecondary, textAlign: 'right', marginTop: 3 },
  sectionBody: { gap: spacing.sm },

  tile: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    ...shadows.sm,
  },
  tileTopRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  tileIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTextWrap: { marginTop: spacing.md },
  tileTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm },
  tileTitle: { ...typography.bodyBold, color: colors.text, textAlign: 'right', flex: 1 },
  tileSubtitle: { ...typography.caption, color: colors.textSecondary, textAlign: 'right', marginTop: 4, lineHeight: 19 },
  adminPill: {
    ...typography.small,
    color: colors.warningDark,
    backgroundColor: colors.warningBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    overflow: 'hidden',
  },

  miniAction: {
    flex: 1,
    minHeight: 42,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  miniActionText: { ...typography.captionBold, color: colors.primaryDark, textAlign: 'center' },

  stepper: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  stepItem: { flex: 1, alignItems: 'center', gap: 6 },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepNumber: { ...typography.captionBold, color: colors.textSecondary },
  stepNumberActive: { color: colors.textInverse },
  stepLabel: { ...typography.small, color: colors.textSecondary, textAlign: 'center' },
  stepLabelActive: { color: colors.primaryDark, fontWeight: '900' },

  notice: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  noticeTitle: { ...typography.captionBold, textAlign: 'right', marginBottom: 2 },
  noticeText: { ...typography.caption, textAlign: 'right', lineHeight: 19 },

  metaPill: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metaLabel: { ...typography.captionBold, color: colors.primaryDark },
  metaValue: { ...typography.captionBold, color: colors.text, flex: 1, textAlign: 'right' },
});
