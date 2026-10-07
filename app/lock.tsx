import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AdminBadge } from '@/components/AdminBadge';
import { color, radius, space, type } from '@/constants/design';
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
        <AdminBadge />
        <Text style={styles.title} accessibilityRole="header">
          {t('lock.title')}
        </Text>
        <Text style={styles.sub}>{t('lock.body')}</Text>
        <Pressable
          onPress={() => unlock()}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel={t('lock.unlock')}
        >
          <Text style={styles.buttonText}>{t('lock.unlock')}</Text>
        </Pressable>
        <Pressable
          onPress={() => signOut()}
          style={styles.link}
          accessibilityRole="button"
          accessibilityLabel={t('lock.sign_out')}
        >
          <Text style={styles.linkText}>{t('lock.sign_out')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.background },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md },
  title: { ...type.title, color: color.textPrimary, textAlign: 'center' },
  sub: { ...type.body, color: color.textSecondary, textAlign: 'center' },
  button: {
    backgroundColor: color.brand,
    borderRadius: radius.md,
    minHeight: 52,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.lg,
  },
  buttonText: { ...type.body, fontWeight: '700', color: color.onBrand },
  link: { minHeight: 48, justifyContent: 'center' },
  linkText: { ...type.label, color: color.brand },
});
