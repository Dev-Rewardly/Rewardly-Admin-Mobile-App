import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AdminBadge } from '@/components/AdminBadge';
import { Button } from '@/components/ui/Button';
import { color, space, type } from '@/constants/design';
import { useAuth } from '@/context/AuthContext';

export default function LockScreen() {
  const { t } = useTranslation();
  const { unlock, signOut } = useAuth();

  // Ask straight away; the button is there for a cancelled or failed attempt.
  useEffect(() => {
    unlock();
  }, [unlock]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <View style={styles.tile}>
          <Ionicons name="lock-closed-outline" size={30} color={color.textPrimary} />
        </View>
        <AdminBadge size="md" centred />
        <View style={styles.text}>
          <Text style={styles.title} accessibilityRole="header">
            {t('lock.title')}
          </Text>
          <Text style={styles.sub}>{t('lock.body')}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Button label={t('lock.unlock')} size="lg" onPress={() => unlock()} />
        <Button label={t('lock.sign_out')} variant="ghost" onPress={() => signOut()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.background },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xxl },
  tile: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  text: { alignItems: 'center', gap: 6 },
  title: { ...type.title, fontSize: 24, lineHeight: 30, color: color.textPrimary, textAlign: 'center' },
  sub: { ...type.bodySmall, color: color.textSecondary, textAlign: 'center' },
  actions: { paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.xs },
});
