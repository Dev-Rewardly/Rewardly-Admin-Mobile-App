// Placeholder until milestone 4 (KPIs). It shows the session is real: who is
// signed in, and that sign-out works. No figure is shown, so none can be wrong.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { CoalitionHeader } from '@/components/CoalitionHeader';
import { color, radius, space, type } from '@/constants/design';
import { useAuth } from '@/context/AuthContext';

export default function Dashboard() {
  const { t } = useTranslation();
  const { claims, signOut } = useAuth();
  const who = claims?.name ?? claims?.email ?? '';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <CoalitionHeader align="center" />
        <Text style={styles.title} accessibilityRole="header">
          {t('dashboard.title')}
        </Text>
        {who !== '' && <Text style={styles.sub}>{t('dashboard.signed_in_as', { who })}</Text>}
        <Text style={styles.sub}>{t('dashboard.coming_soon')}</Text>
        <Pressable
          onPress={() => signOut()}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel={t('dashboard.sign_out')}
        >
          <Text style={styles.buttonText}>{t('dashboard.sign_out')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.background },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md },
  title: { ...type.title, color: color.textPrimary },
  sub: { ...type.body, color: color.textSecondary, textAlign: 'center' },
  button: {
    borderColor: color.border,
    borderWidth: 1,
    borderRadius: radius.md,
    minHeight: 48,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.lg,
  },
  buttonText: { ...type.label, color: color.brand },
});
