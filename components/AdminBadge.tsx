// The marker that keeps this app from being mistaken for the Customer app.
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { color, radius, space } from '@/constants/design';

export function AdminBadge() {
  const { t } = useTranslation();
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{t('auth.admin_badge')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'center',
    backgroundColor: color.adminBadge,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  text: { color: color.onAdminBadge, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
});
