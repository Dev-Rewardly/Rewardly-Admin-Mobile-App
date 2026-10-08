// Admin login. Left-aligned header, outlined inputs with a focus ring, inline
// error banner. Same behaviour as before: email + password, no social login
// and no "create account" path -- admin accounts are provisioned by the coalition.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import {
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
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { color, hit, radius, space, type } from '@/constants/design';
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
            <View style={styles.headerText}>
              <AdminBadge size="md" />
              <Text style={styles.title} accessibilityRole="header">
                {t('auth.title')}
              </Text>
              <Text style={styles.subtitle}>{t('auth.subtitle')}</Text>
            </View>
          </View>

          <View style={styles.form}>
            <View style={styles.group}>
              <Text style={styles.label}>{t('auth.email')}</Text>
              <View style={[styles.field, focused === 'email' && styles.fieldFocused]}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={focused === 'email' ? color.brand : color.textTertiary}
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
            </View>

            <View style={styles.group}>
              <Text style={styles.label}>{t('auth.password')}</Text>
              {/* The show/hide control sits INSIDE the field, so both fields are the
                  same width and the form reads as one column. */}
              <View style={[styles.field, styles.fieldWithToggle, focused === 'password' && styles.fieldFocused]}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={focused === 'password' ? color.brand : color.textTertiary}
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
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.toggle}
                  accessibilityRole="button"
                  accessibilityLabel={t(showPassword ? 'auth.hide_password' : 'auth.show_password')}
                >
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={color.textSecondary} />
                </Pressable>
              </View>
            </View>

            {errorKey && <Banner tone="error" message={t(errorKey)} />}
          </View>

          <Button
            label={t('auth.sign_in')}
            accessibilityLabel={busy ? t('auth.signing_in') : t('auth.sign_in')}
            size="lg"
            onPress={submit}
            disabled={!canSubmit && !busy}
            loading={busy}
            style={styles.submit}
          />

          <Pressable
            onPress={() => Linking.openURL(KEYCLOAK_URLS.resetPassword).catch(() => {})}
            style={styles.link}
            accessibilityRole="link"
            accessibilityLabel={t('auth.forgot_password')}
          >
            <Text style={styles.linkText}>{t('auth.forgot_password')}</Text>
          </Pressable>

          <View style={styles.spacer} />
          <Text style={styles.hint}>{t('auth.no_account_hint')}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: color.background },
  content: { flexGrow: 1, paddingHorizontal: space.xl, paddingTop: space.xxxl, paddingBottom: space.xl },
  header: { gap: space.xl - 4 },
  logo: { width: 56, height: 56, borderRadius: 14 },
  headerText: { gap: space.sm },
  title: { ...type.title, color: color.textPrimary },
  subtitle: { ...type.bodySmall, color: color.textSecondary },
  form: { gap: 18, marginTop: 36 },
  group: { gap: space.sm },
  label: { ...type.label, color: color.textPrimary },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: hit.large,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: color.borderStrong,
    borderRadius: radius.md,
    backgroundColor: color.background,
  },
  fieldWithToggle: { paddingRight: space.xs },
  // Focus ring: stronger border, plus a soft halo on iOS ONLY.
  //
  // On Android, adding shadow props to this View when the input gains focus
  // rebuilds the native view around the TextInput, which drops focus at once:
  // tap Email -> focus -> blur -> focus jumps to Password -> blur, and nothing
  // can be typed (reproduced on the emulator, 2026-10-08). Border-only changes
  // do not do this.
  fieldFocused: {
    borderColor: color.brand,
    borderWidth: 1.5,
    ...Platform.select({
      ios: {
        shadowColor: color.brand,
        shadowOpacity: 0.12,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 0 },
      },
      default: {},
    }),
  },
  input: { flex: 1, paddingVertical: space.md, ...type.body, color: color.textPrimary, textAlign: 'auto' },
  toggle: { minHeight: hit.min, minWidth: hit.min, alignItems: 'center', justifyContent: 'center' },
  submit: { marginTop: space.xl + 4 },
  link: { alignSelf: 'center', minHeight: hit.comfortable, justifyContent: 'center', paddingHorizontal: space.md, marginTop: space.sm },
  linkText: { ...type.label, color: color.brand },
  spacer: { flex: 1, minHeight: space.xl },
  hint: { ...type.caption, color: color.textSecondary, textAlign: 'center', paddingHorizontal: space.lg },
});
