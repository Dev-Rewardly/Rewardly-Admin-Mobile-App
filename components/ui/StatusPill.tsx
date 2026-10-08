import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { color, radius, space, type } from '@/constants/design';

const DOT: Record<string, string> = {
  under_review: color.brand,
  flagged: color.warning,
  info_requested: color.warning,
  approved: color.success,
  settled: color.success,
  rejected: color.error,
};

export function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation();
  // An unrecognised status is shown as itself rather than hidden or guessed:
  // one this build has not been taught about is still a fact about the row.
  const key = `approvals.status_${status}`;
  const translated = t(key);
  const label = translated === key ? status : translated;
  return (
    <View style={styles.pill} accessible accessibilityLabel={label}>
      <View style={[styles.dot, { backgroundColor: DOT[status] ?? color.textTertiary }]} />
      <Text style={styles.text} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    paddingLeft: space.sm,
    paddingRight: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceMuted,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { ...type.micro, color: color.textBody },
});
