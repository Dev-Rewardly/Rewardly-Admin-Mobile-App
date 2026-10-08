// Placeholder until milestone 4 (KPIs). It shows the session is real: who is
// signed in, and that sign-out works. No figure is shown, so none can be wrong.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { CoalitionHeader } from '@/components/CoalitionHeader';
import { Avatar, initialsOf } from '@/components/ui/Avatar';
import { color, hit, radius, space, type } from '@/constants/design';
import { useAuth } from '@/context/AuthContext';

export default function Dashboard() {
  const { t } = useTranslation();
  const { claims, signOut } = useAuth();
  const who = claims?.name ?? claims?.email ?? '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <CoalitionHeader />
        <Text style={styles.title} accessibilityRole="header">
          {t('dashboard.title')}
        </Text>
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          {who !== '' && (
            <View style={styles.who} accessible accessibilityLabel={t('dashboard.signed_in_as', { who })}>
              <Avatar initials={initialsOf(who)} />
              <View style={styles.whoText}>
                <Text style={styles.whoLabel}>{t('dashboard.signed_in_label')}</Text>
                <Text style={styles.whoName} numberOfLines={1}>
                  {who}
                </Text>
              </View>
            </View>
          )}
          <Pressable
            onPress={() => signOut()}
            style={({ pressed }) => [styles.signOut, who !== '' && styles.signOutDivided, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('dashboard.sign_out')}
          >
            <Text style={styles.signOutText}>{t('dashboard.sign_out')}</Text>
          </Pressable>
        </View>

        <View style={styles.placeholder}>
          <Ionicons name="grid-outline" size={28} color={color.textTertiary} />
          <Text style={styles.placeholderText}>{t('dashboard.coming_soon')}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const H = space.xl - 4;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.background },
  header: { paddingHorizontal: H, paddingTop: space.sm - 2, paddingBottom: space.md, gap: 14 },
  title: { ...type.largeTitle, color: color.textPrimary },
  body: { flex: 1, paddingHorizontal: H, paddingTop: space.sm, paddingBottom: H, gap: space.lg },
  card: { borderWidth: 1, borderColor: color.border, borderRadius: radius.lg, overflow: 'hidden' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: space.lg },
  whoText: { flex: 1, gap: 2 },
  whoLabel: { ...type.caption, color: color.textSecondary },
  whoName: { ...type.headline, color: color.textPrimary },
  signOut: { minHeight: hit.comfortable, alignItems: 'center', justifyContent: 'center' },
  signOutDivided: { borderTopWidth: 1, borderTopColor: color.divider },
  pressed: { backgroundColor: color.errorHover },
  signOutText: { ...type.button, color: color.error },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: space.xxl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.borderStrong,
    borderRadius: radius.lg,
  },
  placeholderText: { ...type.bodySmall, color: color.textSecondary, textAlign: 'center', maxWidth: 260 },
});
