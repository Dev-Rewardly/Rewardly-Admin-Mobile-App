import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { color, hit, radius, space, type } from '@/constants/design';

type Variant = 'primary' | 'secondary' | 'destructive' | 'destructiveQuiet' | 'ghost';
type Size = 'md' | 'lg';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  /** Shows a spinner instead of the label. Use for sign-in; in-card actions pass a "Working…" label instead. */
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  flex?: boolean;
}

const fg: Record<Variant, string> = {
  primary: color.onBrand,
  secondary: color.textBody,
  destructive: color.onBrand,
  destructiveQuiet: color.error,
  ghost: color.brand,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  accessibilityLabel,
  style,
  flex,
}: Props) {
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: off, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        styles[variant],
        pressed && pressedStyle[variant],
        disabled && (variant === 'primary' ? styles.primaryDisabled : styles.disabled),
        flex && styles.flex,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg[variant]} />
      ) : (
        <Text
          style={[
            size === 'lg' ? type.buttonLarge : type.button,
            { color: disabled && variant === 'primary' ? color.textTertiary : fg[variant] },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg, borderRadius: radius.md },
  md: { minHeight: hit.min },
  lg: { minHeight: hit.large },
  flex: { flex: 1 },
  primary: { backgroundColor: color.brand },
  secondary: { backgroundColor: color.background, borderWidth: 1, borderColor: color.borderStrong },
  destructive: { backgroundColor: color.error },
  destructiveQuiet: { backgroundColor: color.background, borderWidth: 1, borderColor: color.borderStrong },
  ghost: { backgroundColor: 'transparent', minHeight: hit.comfortable },
  primaryDisabled: { backgroundColor: color.surfaceMuted },
  disabled: { opacity: 0.5 },
});

const pressedStyle = StyleSheet.create({
  primary: { backgroundColor: color.brandPressed },
  secondary: { backgroundColor: color.surface },
  destructive: { backgroundColor: color.errorPressed },
  destructiveQuiet: { backgroundColor: color.errorHover },
  ghost: { opacity: 0.6 },
});
