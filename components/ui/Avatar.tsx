import { Pressable, StyleSheet, Text, View } from 'react-native';

import { color, font, hit } from '@/constants/design';

/** "Ana Ruiz" -> "AR"; "ana.ruiz@x.com" -> "AR"; "" -> "". */
export function initialsOf(nameOrEmail: string | null | undefined): string {
  const raw = (nameOrEmail ?? '').split('@')[0].trim();
  if (!raw) return '';
  const parts = raw.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2);
  return letters.toUpperCase();
}

export function Avatar({
  initials,
  size = hit.min,
  onPress,
  accessibilityLabel,
}: {
  initials: string;
  size?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const box = { width: size, height: size, borderRadius: size / 2 };
  const label = <Text style={[styles.text, { fontSize: size * 0.32 }]}>{initials}</Text>;
  if (!onPress) return <View style={[styles.base, box]}>{label}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.base, styles.button, box, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
    >
      {label}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', backgroundColor: color.surfaceMuted },
  button: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.border },
  pressed: { backgroundColor: color.surfaceMuted },
  text: { fontFamily: font.semibold, color: color.textPrimary },
});
