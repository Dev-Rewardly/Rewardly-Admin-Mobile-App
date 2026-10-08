// Admin login: the Customer login's look (navy button, soft inputs, centred
// header) with an "Admin" badge, email + password, no social login and no
// "create account" path: admin accounts are provisioned by the coalition.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
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
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);
  const passwordRef = useRef<TextInput>(null);

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
          <View style={[styles.field, focused === 'email' && styles.fieldFocused]}>
            <Ionicons
              name="mail-outline"
              size={20}
              color={focused === 'email' ? color.brand : color.textTertiary}
              style={styles.fieldIcon}
            />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              submitBehavior="submit"
              accessibilityLabel={t('auth.email')}
            />
          </View>

          <Text style={styles.label}>{t('auth.password')}</Text>
          {/* The show/hide control sits INSIDE the field, so both fields are the
              same width and the form reads as one column. */}
          <View style={[styles.field, focused === 'password' && styles.fieldFocused]}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={focused === 'password' ? color.brand : color.textTertiary}
              style={styles.fieldIcon}
            />
            <TextInput
              ref={passwordRef}
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
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
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t(showPassword ? 'auth.hide_password' : 'auth.show_password')}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={color.textSecondary}
              />
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
  logo: { width: 88, height: 88, borderRadius: radius.lg, marginBottom: space.xs },
  title: { ...type.title, color: color.textPrimary, textAlign: 'center' },
  subtitle: { ...type.body, color: color.textSecondary, textAlign: 'center', paddingHorizontal: space.md },
  label: { ...type.label, color: color.textPrimary, marginBottom: space.xs, marginTop: space.lg },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surface,
    borderColor: color.border,
    borderWidth: 1,
    borderRadius: radius.md,
    minHeight: 52,
    paddingHorizontal: space.md,
  },
  fieldFocused: { borderColor: color.brand, backgroundColor: color.background },
  fieldIcon: { marginRight: space.sm },
  input: {
    flex: 1,
    paddingVertical: space.md,
    ...type.body,
    color: color.textPrimary,
    textAlign: 'auto',
  },
  toggle: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
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
