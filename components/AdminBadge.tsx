// The marker that keeps this app from being mistaken for the Customer app.
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { color, radius, type } from '@/constants/design';

// Left-aligned by default; `centred` for a centred column such as the lock
// screen, where flex-start would pull the badge to the left edge alone.
export function AdminBadge({ size = 'sm', centred = false }: { size?: 'sm' | 'md'; centred?: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.badge, size === 'md' && styles.md, centred && styles.centred]}>
      <Text style={[styles.text, size === 'md' && styles.textMd]}>{t('auth.admin_badge')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: color.adminBadge,
    borderRadius: radius.xs,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  md: { paddingHorizontal: 8, paddingVertical: 4 },
  centred: { alignSelf: 'center' },
  text: { ...type.badge, fontSize: 10, color: color.onAdminBadge },
  textMd: { fontSize: 10.5 },
});
