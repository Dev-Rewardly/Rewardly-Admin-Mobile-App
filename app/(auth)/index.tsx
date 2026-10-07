// Admin login: the Customer login's look (navy button, soft inputs, centred
// header) with an "Admin" badge, email + password, no social login and no
// "create account" path: admin accounts are provisioned by the coalition.
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AdminBadge } from '@/components/AdminBadge';
import { color, radius, space, type } from '@/constants/design';
import { KEYCLOAK_URLS } from '@/constants/keycloak';
import { useAuth } from '@/context/AuthContext';
import { AuthError } from '@/lib/auth/keycloak';

export default function AdminLogin() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setErrorKey(null);
    try {
      await signIn(email, password);
    } catch (e) {
      const code = e instanceof AuthError ? e.code : 'SERVER';
      setErrorKey(`auth.error.${code.toLowerCase()}`);
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Image source={require('@/assets/images/icon.png')} style={styles.logo} accessibilityIgnoresInvertColors />
            <AdminBadge />
            <Text style={styles.title} accessibilityRole="header">
              {t('auth.title')}
            </Text>
            <Text style={styles.subtitle}>{t('auth.subtitle')}</Text>
          </View>

          <Text style={styles.label}>{t('auth.email')}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
            accessibilityLabel={t('auth.email')}
          />

          <Text style={styles.label}>{t('auth.password')}</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="current-password"
              autoCorrect={false}
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
              accessibilityLabel={t('auth.password')}
            />
            <Pressable
              onPress={() => setShowPassword(v => !v)}
              style={styles.toggle}
              accessibilityRole="button"
              accessibilityLabel={t(showPassword ? 'auth.hide_password' : 'auth.show_password')}
            >
              <Text style={styles.toggleText}>{t(showPassword ? 'auth.hide_password' : 'auth.show_password')}</Text>
            </Pressable>
          </View>

          {errorKey && (
            <View style={styles.error} accessibilityLiveRegion="polite">
              <Text style={styles.errorText}>{t(errorKey)}</Text>
            </View>
          )}

          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit, busy }}
            accessibilityLabel={t('auth.sign_in')}
          >
            {busy ? (
              <ActivityIndicator color={color.onBrand} accessibilityLabel={t('auth.signing_in')} />
            ) : (
              <Text style={styles.buttonText}>{t('auth.sign_in')}</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => Linking.openURL(KEYCLOAK_URLS.resetPassword).catch(() => {})}
            style={styles.link}
            accessibilityRole="link"
            accessibilityLabel={t('auth.forgot_password')}
          >
            <Text style={styles.linkText}>{t('auth.forgot_password')}</Text>
          </Pressable>

          <Text style={styles.hint}>{t('auth.no_account_hint')}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: color.background },
  content: { flexGrow: 1, paddingHorizontal: space.xl, paddingVertical: space.xl, justifyContent: 'center' },
  header: { alignItems: 'center', gap: space.md, marginBottom: space.xl },
  logo: { width: 72, height: 72, borderRadius: radius.lg },
  title: { ...type.title, color: color.textPrimary, textAlign: 'center' },
  subtitle: { ...type.body, color: color.textSecondary, textAlign: 'center' },
  label: { ...type.label, color: color.textPrimary, marginBottom: space.xs, marginTop: space.md },
  input: {
    backgroundColor: color.surface,
    borderColor: color.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 48,
    ...type.body,
    color: color.textPrimary,
    textAlign: 'auto',
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  passwordInput: { flex: 1 },
  toggle: { minHeight: 48, justifyContent: 'center', paddingHorizontal: space.sm },
  toggleText: { ...type.label, color: color.brand },
  error: { backgroundColor: color.errorSurface, borderRadius: radius.md, padding: space.md, marginTop: space.lg },
  errorText: { ...type.caption, color: color.error },
  button: {
    backgroundColor: color.brand,
    borderRadius: radius.md,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xl,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { ...type.body, fontWeight: '700', color: color.onBrand },
  link: { alignSelf: 'center', minHeight: 48, justifyContent: 'center', marginTop: space.sm },
  linkText: { ...type.label, color: color.brand },
  hint: { ...type.caption, color: color.textTertiary, textAlign: 'center', marginTop: space.lg },
});
